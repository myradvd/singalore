import { adjustedWalkSeconds, pathLengthMeters, straightLineWalkSeconds, totalTourSeconds, type GeoPoint, type WalkingPace } from '@singalore/shared';

export interface RouteEstimate
{
  stops: number;
  distanceM: number;
  walkSeconds: number;
  totalSeconds: number;
  approximate: boolean;
}

export function estimateFromStops(origin: GeoPoint | null, stops: readonly GeoPoint[], podcastSeconds: readonly number[], pace: WalkingPace): RouteEstimate
{
  const points = origin === null ? [...stops] : [origin, ...stops];
  const distanceM = pathLengthMeters(points);
  const walkSeconds = straightLineWalkSeconds(distanceM, pace);
  return { stops: stops.length, distanceM, walkSeconds, totalSeconds: totalTourSeconds(walkSeconds, podcastSeconds), approximate: true };
}

export function estimateFromRoute(distanceM: number, providerDurationS: number, stopCount: number, podcastSeconds: readonly number[], pace: WalkingPace, approximate: boolean): RouteEstimate
{
  const walkSeconds = adjustedWalkSeconds(providerDurationS, pace);
  return { stops: stopCount, distanceM, walkSeconds, totalSeconds: totalTourSeconds(walkSeconds, podcastSeconds), approximate };
}
