import { API_PATHS, RouteResponse, TableResponse, autoOrder, decodePolyline6, distanceBetween, pathLengthMeters, projectOntoPolyline, type GeoPoint } from '@singalore/shared';
import type { Clock } from '@/core/clock';
import { ApiRequestError, type ApiClient } from '@/core/http/ApiClient';
import type { PlannedRoute, PlannedStep, RouteStop } from './routeTypes';

export const ROUTE_CLIENT_TIMEOUT_MS = 20000;
export const ROUTE_UNAVAILABLE_MESSAGE = 'Unable to calculate route. Please try again later.';

export type PlanResult =
  | { kind: 'planned'; route: PlannedRoute; autoOrdered: boolean }
  | { kind: 'failed'; message: string; fallback: PlannedRoute };
/**
 * Fallback route when the routing server fails: straight lines between stops,
 * marked approximate, with no turn-by-turn steps. Time assumes 4.5 km/h.
 */
export function straightLineRoute(origin: GeoPoint, stops: readonly RouteStop[], plannedAt: number): PlannedRoute
{
  const line = [origin, ...stops.map((stop) => stop.position)];
  const distanceM = pathLengthMeters(line);
  return { stopIds: stops.map((stop) => stop.landmarkId), line, distanceM, providerDurationS: distanceM / (4.5 / 3.6), steps: [], approximate: true, plannedAt };
}

export function flattenSteps(response: RouteResponse, line: readonly GeoPoint[]): PlannedStep[]
{
  const steps: PlannedStep[] = [];
  response.legs.forEach((leg, legIndex) =>
  {
    for (const step of leg.steps)
    {
      const projection = projectOntoPolyline(step.maneuver.location, line);
      steps.push({ legIndex, distanceM: step.distanceM, durationS: step.durationS, name: step.name, maneuver: step.maneuver, startAlongM: projection?.distanceAlongMeters ?? 0 });
    }
  });
  return steps;
}
/** Plans walking routes through the server's route endpoints (RouteOptimizer in the design). */
export class RoutePlanner
{
  constructor(private readonly api: ApiClient, private readonly clock: Clock)
  {
  }
/**
 * Auto-Order: fetches the walking-time matrix and returns the stops in the fastest order.
 * @param origin - Walker's current position.
 * @param stops - Stops in the itinerary.
 */
  async orderStops(origin: GeoPoint, stops: readonly RouteStop[]): Promise<RouteStop[]>
  {
    if (stops.length < 2)
    {
      return [...stops];
    }
    const coordinates = [origin, ...stops.map((stop) => stop.position)];
    const table = await this.api.post(API_PATHS.routeTable, { coordinates }, TableResponse, { timeoutMs: ROUTE_CLIENT_TIMEOUT_MS });
    const order = autoOrder(table.durationsS);
    return order.stopOrder.map((index) => stops[index - 1]).filter((stop): stop is RouteStop => stop !== undefined);
  }
/**
 * Plans a walking route from the walker through all stops.
 * @param options - autoOrder reorders the stops first.
 * @returns The planned route, or a failure message with a straight-line fallback route.
 */
  async plan(origin: GeoPoint, stops: readonly RouteStop[], options: { autoOrder: boolean }): Promise<PlanResult>
  {
    const now = this.clock.now();
    let ordered = [...stops];
    let autoOrdered = false;
    try
    {
      if (options.autoOrder && stops.length > 1)
      {
        ordered = await this.orderStops(origin, stops);
        autoOrdered = true;
      }
      const coordinates = [origin, ...ordered.map((stop) => stop.position)];
      const response = await this.api.post(API_PATHS.route, { coordinates }, RouteResponse, { timeoutMs: ROUTE_CLIENT_TIMEOUT_MS });
      const line = decodePolyline6(response.geometryPolyline6);
      return {
        kind: 'planned',
        autoOrdered,
        route: { stopIds: ordered.map((stop) => stop.landmarkId), line, distanceM: response.distanceM, providerDurationS: response.durationS, steps: flattenSteps(response, line), approximate: false, plannedAt: now },
      };
    }
    catch (error)
    {
      const message = error instanceof ApiRequestError && error.kind === 'privacy_violation' ? error.message : ROUTE_UNAVAILABLE_MESSAGE;
      return { kind: 'failed', message, fallback: straightLineRoute(origin, ordered, now) };
    }
  }
}

export function distanceToStop(origin: GeoPoint, stop: RouteStop): number
{
  return distanceBetween(origin, stop.position);
}
