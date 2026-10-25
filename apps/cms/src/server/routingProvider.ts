import { RouteResponse, TableResponse, type LatLng } from '@singalore/shared';
import { z } from 'zod';

const OsrmManeuver = z.object({
  type: z.string(),
  modifier: z.string().optional(),
  location: z.tuple([z.number(), z.number()]),
  bearing_before: z.number(),
  bearing_after: z.number(),
  exit: z.number().int().optional(),
});
const OsrmStep = z.object({ distance: z.number(), duration: z.number(), name: z.string().default(''), maneuver: OsrmManeuver });
const OsrmRoute = z.object({
  code: z.string(),
  routes: z.array(z.object({
    distance: z.number(),
    duration: z.number(),
    geometry: z.string(),
    legs: z.array(z.object({ distance: z.number(), duration: z.number(), steps: z.array(OsrmStep) })),
  })).optional(),
});
const OsrmTable = z.object({ code: z.string(), durations: z.array(z.array(z.number().nullable())).optional() });

export class RoutingProviderError extends Error
{
  constructor(readonly code: 'upstream_timeout' | 'upstream_error', message: string)
  {
    super(message);
    this.name = 'RoutingProviderError';
  }
}

export interface RoutingProvider
{
  route(points: LatLng[]): Promise<RouteResponse>;
  table(points: LatLng[]): Promise<TableResponse>;
}

export const UPSTREAM_TIMEOUT_MS = 8000;

function coordinatePath(points: LatLng[]): string
{
  return points.map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`).join(';');
}

export function mapOsrmRoute(raw: unknown, provider: string): RouteResponse
{
  const parsed = OsrmRoute.safeParse(raw);
  const route = parsed.success ? parsed.data.routes?.[0] : undefined;
  if (!parsed.success || parsed.data.code !== 'Ok' || route === undefined)
  {
    throw new RoutingProviderError('upstream_error', 'The routing provider returned no route.');
  }
  return RouteResponse.parse({
    distanceM: route.distance,
    durationS: route.duration,
    geometryPolyline6: route.geometry,
    provider,
    legs: route.legs.map((leg) => ({
      distanceM: leg.distance,
      durationS: leg.duration,
      steps: leg.steps.map((step) => ({
        distanceM: step.distance,
        durationS: step.duration,
        name: step.name,
        maneuver: {
          type: step.maneuver.type,
          ...(step.maneuver.modifier === undefined ? {} : { modifier: step.maneuver.modifier }),
          location: { lng: step.maneuver.location[0], lat: step.maneuver.location[1] },
          bearingBefore: step.maneuver.bearing_before,
          bearingAfter: step.maneuver.bearing_after,
          ...(step.maneuver.exit === undefined ? {} : { exit: step.maneuver.exit }),
        },
      })),
    })),
  });
}

export function mapOsrmTable(raw: unknown, provider: string): TableResponse
{
  const parsed = OsrmTable.safeParse(raw);
  if (!parsed.success || parsed.data.code !== 'Ok' || parsed.data.durations === undefined)
  {
    throw new RoutingProviderError('upstream_error', 'The routing provider returned no duration table.');
  }
  return TableResponse.parse({ durationsS: parsed.data.durations, provider });
}

export function createOsrmProvider(baseUrl: string, profile: string, fetchImplementation: typeof fetch = fetch): RoutingProvider
{
  const host = new URL(baseUrl).host;
  async function call(url: string): Promise<unknown>
  {
    let lastError: RoutingProviderError = new RoutingProviderError('upstream_error', 'Routing failed');
    for (let attempt = 0; attempt < 2; attempt += 1)
    {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try
      {
        const response = await fetchImplementation(url, { signal: controller.signal, headers: { 'User-Agent': 'Singalore/0.1 route proxy' } });
        if (response.status >= 500 || response.status === 429)
        {
          lastError = new RoutingProviderError('upstream_error', `Routing provider status ${response.status}`);
          continue;
        }
        return await response.json();
      }
      catch (error)
      {
        lastError = controller.signal.aborted
          ? new RoutingProviderError('upstream_timeout', 'The routing provider timed out.')
          : new RoutingProviderError('upstream_error', error instanceof Error ? error.message : 'Routing failed');
      }
      finally
      {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
  const root = baseUrl.replace(/\/+$/, '');
  return {
    route: async (points) => mapOsrmRoute(await call(`${root}/route/v1/${profile}/${coordinatePath(points)}?overview=full&geometries=polyline6&steps=true`), host),
    table: async (points) => mapOsrmTable(await call(`${root}/table/v1/${profile}/${coordinatePath(points)}?annotations=duration`), host),
  };
}
