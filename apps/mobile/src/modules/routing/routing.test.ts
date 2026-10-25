import { destinationPoint } from '@singalore/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createAppEventBus } from '@/core/appEvents';
import { ManualClock } from '@/core/clock';
import { ApiClient } from '@/core/http/ApiClient';
import { AUTODETECT_RADIUS_M, computeProgress, OFF_ROUTE_DURATION_MS, OffRouteDetector, shouldAutoStart } from './progress';
import { ROUTE_UNAVAILABLE_MESSAGE, RoutePlanner, straightLineRoute } from './RoutePlanner';

type OsrmFixture = { routes: { distance: number; duration: number; geometry: string; legs: { distance: number; duration: number; steps: { distance: number; duration: number; name: string; maneuver: { type: string; modifier?: string; location: [number, number]; bearing_before: number; bearing_after: number } }[] }[] }[] };
const osrmRoute = JSON.parse(readFileSync(path.join(__dirname, '../../../test/fixtures/osrm-route.json'), 'utf8')) as OsrmFixture;
const osrmTable = JSON.parse(readFileSync(path.join(__dirname, '../../../test/fixtures/osrm-table.json'), 'utf8')) as { durations: number[][] };
const first = osrmRoute.routes[0];
if (first === undefined)
{
  throw new Error('fixture has no route');
}
const routeBody = {
  distanceM: first.distance,
  durationS: first.duration,
  geometryPolyline6: first.geometry,
  provider: 'routing.openstreetmap.de',
  legs: first.legs.map((leg) => ({
    distanceM: leg.distance,
    durationS: leg.duration,
    steps: leg.steps.map((step) => ({
      distanceM: step.distance,
      durationS: step.duration,
      name: step.name,
      maneuver: { type: step.maneuver.type, ...(step.maneuver.modifier === undefined ? {} : { modifier: step.maneuver.modifier }), location: { lng: step.maneuver.location[0], lat: step.maneuver.location[1] }, bearingBefore: step.maneuver.bearing_before, bearingAfter: step.maneuver.bearing_after },
    })),
  })),
};
const origin = { lat: 1.29516, lng: 103.85193 };
const stops = [
  { landmarkId: 'b', position: { lat: 1.2875, lng: 103.8515 } },
  { landmarkId: 'a', position: { lat: 1.29486, lng: 103.85441 } },
];

function planner(responder: (url: string) => Response | Promise<Response>)
{
  const calls: string[] = [];
  const api = new ApiClient({
    baseUrl: () => 'https://api.test',
    fetchImplementation: async (url) =>
    {
      calls.push(String(url));
      return responder(String(url));
    },
    clock: new ManualClock(0),
    events: createAppEventBus(),
  });
  return { planner: new RoutePlanner(api, new ManualClock(1000)), calls };
}

describe('RoutePlanner (UC 1.5.2)', () =>
{
  it('auto-orders with the duration table, then plans the route with steps', async () =>
  {
    const permutation = [0, 2, 1];
    const reordered = permutation.map((row) => permutation.map((column) => osrmTable.durations[row]?.[column] ?? null));
    const { planner: routePlanner, calls } = planner((url) => new Response(JSON.stringify(url.endsWith('/table') ? { durationsS: reordered, provider: 'x' } : routeBody)));
    const result = await routePlanner.plan(origin, stops, { autoOrder: true });
    expect(calls).toEqual(['https://api.test/api/v1/route/table', 'https://api.test/api/v1/route']);
    expect(result.kind).toBe('planned');
    if (result.kind === 'planned')
    {
      expect(result.route.stopIds).toEqual(['a', 'b']);
      expect(result.autoOrdered).toBe(true);
      expect(result.route.steps.length).toBeGreaterThan(5);
      expect(result.route.line.length).toBeGreaterThan(5);
      expect(result.route.approximate).toBe(false);
    }
  });

  it('keeps the chosen order without Auto-Order', async () =>
  {
    const { planner: routePlanner, calls } = planner(() => new Response(JSON.stringify(routeBody)));
    const result = await routePlanner.plan(origin, stops, { autoOrder: false });
    expect(calls).toEqual(['https://api.test/api/v1/route']);
    expect(result.kind === 'planned' && result.route.stopIds).toEqual(['b', 'a']);
  });

  it('fails with the SRS message and offers an approximate straight line (UC 1.5.2.1)', async () =>
  {
    const { planner: routePlanner } = planner(() => new Response(JSON.stringify({ error: { code: 'upstream_timeout', message: 'x' } }), { status: 504 }));
    const result = await routePlanner.plan(origin, stops, { autoOrder: false });
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed')
    {
      expect(result.message).toBe(ROUTE_UNAVAILABLE_MESSAGE);
      expect(result.fallback.approximate).toBe(true);
      expect(result.fallback.steps).toEqual([]);
      expect(result.fallback.line).toHaveLength(3);
    }
  });

  it('builds a straight line with walking time at 4.5 km/h', () =>
  {
    const route = straightLineRoute(origin, stops.slice(0, 1), 0);
    expect(route.providerDurationS).toBeCloseTo(route.distanceM / 1.25, 5);
  });
});

describe('progress and off-route (UC 1.5.4, 1.5.4.1)', () =>
{
  const route = straightLineRoute(origin, [{ landmarkId: 'x', position: destinationPoint(origin, 90, 1000) }], 0);

  it('projects the position on the route and reports remaining distance', () =>
  {
    const progress = computeProgress(route, destinationPoint(origin, 90, 400));
    expect(progress?.alongM).toBeCloseTo(400, -1);
    expect(progress?.remainingM).toBeCloseTo(600, -1);
    expect(progress?.distanceFromLineM).toBeLessThan(1);
  });

  it('reports the next maneuver on a real route', async () =>
  {
    const { planner: routePlanner } = planner(() => new Response(JSON.stringify(routeBody)));
    const result = await routePlanner.plan(origin, stops, { autoOrder: false });
    if (result.kind !== 'planned')
    {
      throw new Error('expected a route');
    }
    const progress = computeProgress(result.route, origin);
    expect(progress?.nextStep).not.toBeNull();
    expect(progress?.distanceToNextManeuverM).toBeGreaterThanOrEqual(0);
  });

  it('raises off-route after more than 40 m for 5 s, once, and resets on return', () =>
  {
    const detector = new OffRouteDetector();
    expect(detector.update(50, 0)).toBe(false);
    expect(detector.update(55, OFF_ROUTE_DURATION_MS - 1)).toBe(false);
    expect(detector.update(60, OFF_ROUTE_DURATION_MS)).toBe(true);
    expect(detector.update(60, OFF_ROUTE_DURATION_MS + 1000)).toBe(false);
    detector.update(10, 9000);
    expect(detector.update(45, 9500)).toBe(false);
    expect(detector.update(45, 15000)).toBe(true);
    expect(detector.update(40, 16000)).toBe(false);
  });

  it('auto-starts within 50 m of the first stop when Autodetect is on', () =>
  {
    const near = destinationPoint(origin, 0, AUTODETECT_RADIUS_M - 1);
    expect(shouldAutoStart(near, origin, true)).toBe(true);
    expect(shouldAutoStart(near, origin, false)).toBe(false);
    expect(shouldAutoStart(destinationPoint(origin, 0, 80), origin, true)).toBe(false);
    expect(shouldAutoStart(null, origin, true)).toBe(false);
  });
});
