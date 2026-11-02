import { destinationPoint } from '@singalore/shared';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { GeofenceEngine } from '@/modules/geofence/GeofenceEngine';
import { wireArrivalNotifications } from './arrivalNotifyWiring';

const CENTER = { lat: 1.2951, lng: 103.8519 };
const chijmes: GeofenceTarget = { landmarkId: 'chijmes', name: 'CHIJMES', latitude: CENTER.lat, longitude: CENTER.lng, radiusMeters: 30, hasPodcast: true };
const overlapping: GeofenceTarget = { ...chijmes, landmarkId: 'overlapping', name: 'Overlapping' };

// Builds a device fix the given distance north of the test landmark.
function fixAt(metersNorth: number, timestamp: number): LocationFix
{
  const point = destinationPoint(CENTER, 0, metersNorth);
  return { latitude: point.lat, longitude: point.lng, accuracyMeters: 10, timestamp, source: 'device' };
}

// Builds a real engine with a fake notifier wired to a switchable app state.
function createWiredEngine(targets: readonly GeofenceTarget[] = [chijmes])
{
  const events = createAppEventBus();
  const notifications: { title: string; body: string; data: Record<string, string> | undefined }[] = [];
  const appState = { active: false };
  const engine = new GeofenceEngine({
    events,
    clock: new ManualClock(0),
    diagnostics: { record: async () => undefined },
    targets: () => targets,
    settings: () => ({ geofenceTriggersEnabled: true, autoplayEnabled: false }),
    playback: { isPlaying: () => false, currentLandmarkId: () => null },
    osGeofencer: { setRegions: async () => undefined, clear: async () => undefined },
  });
  engine.start();
  const unsubscribe = wireArrivalNotifications({
    geofence: engine,
    notifier: {
      permission: async () => 'granted',
      requestPermission: async () => 'granted',
      notify: async (_category, title, body, data) =>
      {
        notifications.push({ title, body, data });
        return true;
      },
    },
    isAppActive: () => appState.active,
  });
  return { engine, events, notifications, appState, unsubscribe };
}

describe('wireArrivalNotifications (UC 1.3.2.3)', () =>
{
  it('10 fixes, inactive, one prompt: notifies exactly once with the arrival text', () =>
  {
    const { events, notifications } = createWiredEngine();
    for (let second = 1; second <= 10; second += 1)
    {
      events.emit('location/fix', fixAt(5, second * 1000));
    }
    expect(notifications).toEqual([{ title: 'You have reached CHIJMES', body: 'A podcast about this site is available. Tap to listen.', data: { landmarkId: 'chijmes' } }]);
  });

  it('10 fixes, active (valid EC, no action): sends no notification', () =>
  {
    const { events, notifications, appState } = createWiredEngine();
    appState.active = true;
    for (let second = 1; second <= 10; second += 1)
    {
      events.emit('location/fix', fixAt(5, second * 1000));
    }
    expect(notifications).toEqual([]);
  });

  it('prompt raised while active, then backgrounded for 5 fixes: notifies once', () =>
  {
    const { events, notifications, appState } = createWiredEngine();
    appState.active = true;
    events.emit('location/fix', fixAt(5, 1000));
    appState.active = false;
    for (let second = 2; second <= 6; second += 1)
    {
      events.emit('location/fix', fixAt(5, second * 1000));
    }
    expect(notifications).toHaveLength(1);
  });

  it('exit then re-entry while inactive: a new prompt notifies a second time', () =>
  {
    const { events, notifications } = createWiredEngine();
    events.emit('location/fix', fixAt(5, 1000));
    events.emit('location/fix', fixAt(80, 2000));
    events.emit('location/fix', fixAt(80, 3000));
    events.emit('location/fix', fixAt(5, 4000));
    expect(notifications).toHaveLength(2);
  });

  it('two sites entered on one fix: each prompt notifies once', () =>
  {
    const { events, notifications } = createWiredEngine([chijmes, overlapping]);
    events.emit('location/fix', fixAt(5, 1000));
    events.emit('location/fix', fixAt(5, 2000));
    expect(notifications.map((notification) => notification.data?.landmarkId)).toEqual(['chijmes', 'overlapping']);
  });

  it('notification tap before the app state turns active, prompt pending: no second notification', () =>
  {
    const { engine, events, notifications } = createWiredEngine();
    events.emit('location/fix', fixAt(5, 1000));
    engine.presentPrompt('chijmes');
    expect(notifications).toHaveLength(1);
  });

  it('notification tap before the app state turns active, no prompt pending: sends no notification', () =>
  {
    const { engine, notifications } = createWiredEngine();
    engine.presentPrompt('chijmes');
    expect(engine.getState().prompt?.landmarkId).toBe('chijmes');
    expect(notifications).toEqual([]);
  });

  it('after unsubscribing: a new prompt sends no notification', () =>
  {
    const { events, notifications, unsubscribe } = createWiredEngine();
    unsubscribe();
    events.emit('location/fix', fixAt(5, 1000));
    expect(notifications).toEqual([]);
  });
});
