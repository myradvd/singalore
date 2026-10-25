import { destinationPoint } from '@singalore/shared';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { migrate } from '@/core/db/migrations';
import { ApiClient } from '@/core/http/ApiClient';
import { createMemoryDb } from '@test/support/betterSqliteAdapter';
import { RouteNavigator } from './RouteNavigator';
import { RoutePlanner } from './RoutePlanner';

const origin = { lat: 1.29, lng: 103.85 };
const stop = { landmarkId: 'x', position: destinationPoint(origin, 90, 800) };

async function setup(responder: () => Response)
{
  const db = createMemoryDb();
  await migrate(db);
  const events = createAppEventBus();
  const api = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation: async () => responder(), clock: new ManualClock(0), events });
  return { navigator: new RouteNavigator(new RoutePlanner(api, new ManualClock(0)), events, db), events, db };
}

describe('RouteNavigator', () =>
{
  it('stores a failure with a fallback, uses it, persists and restores it (NFR 2.1, 2.3)', async () =>
  {
    const { navigator, db, events } = await setup(() => new Response('{}', { status: 502 }));
    await navigator.plan(origin, [stop], false);
    expect(navigator.getState()).toMatchObject({ status: 'failed', failureMessage: 'Unable to calculate route. Please try again later.' });
    await navigator.useFallback();
    expect(navigator.getState().route?.approximate).toBe(true);
    const restored = new RouteNavigator(new RoutePlanner(new ApiClient({ baseUrl: () => 'x', fetchImplementation: fetch, clock: new ManualClock(0), events }), new ManualClock(0)), events, db);
    await restored.restore();
    expect(restored.getState().route?.stopIds).toEqual(['x']);
    await restored.clear();
    const again = new RouteNavigator(new RoutePlanner(new ApiClient({ baseUrl: () => 'x', fetchImplementation: fetch, clock: new ManualClock(0), events }), new ManualClock(0)), events, db);
    await again.restore();
    expect(again.getState().route).toBeNull();
  });

  it('tracks progress from location fixes only while navigating', async () =>
  {
    const { navigator, events } = await setup(() => new Response('{}', { status: 502 }));
    await navigator.plan(origin, [stop], false);
    await navigator.useFallback();
    const halfway = destinationPoint(origin, 90, 400);
    events.emit('location/fix', { latitude: halfway.lat, longitude: halfway.lng, accuracyMeters: 5, timestamp: 1, source: 'device' });
    expect(navigator.getState().progress).toBeNull();
    navigator.setNavigating(true);
    events.emit('location/fix', { latitude: halfway.lat, longitude: halfway.lng, accuracyMeters: 5, timestamp: 2, source: 'device' });
    expect(navigator.getState().progress?.remainingM).toBeCloseTo(400, -1);
    navigator.setNavigating(false);
  });
});
