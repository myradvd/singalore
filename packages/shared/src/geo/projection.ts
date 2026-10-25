import { distanceBetween, haversineDistanceMeters } from './haversine';
import type { GeoPoint } from './types';

export interface PolylineProjection
{
  point: GeoPoint;
  segmentIndex: number;
  distanceFromLineMeters: number;
  distanceAlongMeters: number;
}

const METERS_PER_DEGREE_LAT = 111320;

export function projectOntoPolyline(target: GeoPoint, line: readonly GeoPoint[]): PolylineProjection | null
{
  if (line.length === 0)
  {
    return null;
  }
  const first = line[0];
  if (line.length === 1 && first !== undefined)
  {
    return {
      point: first,
      segmentIndex: 0,
      distanceFromLineMeters: distanceBetween(target, first),
      distanceAlongMeters: 0,
    };
  }
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((target.lat * Math.PI) / 180);
  let best: PolylineProjection | null = null;
  let travelled = 0;
  for (let index = 0; index < line.length - 1; index += 1)
  {
    const start = line[index];
    const end = line[index + 1];
    if (start === undefined || end === undefined)
    {
      continue;
    }
    const segmentX = (end.lng - start.lng) * metersPerDegreeLng;
    const segmentY = (end.lat - start.lat) * METERS_PER_DEGREE_LAT;
    const targetX = (target.lng - start.lng) * metersPerDegreeLng;
    const targetY = (target.lat - start.lat) * METERS_PER_DEGREE_LAT;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    const fraction = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (targetX * segmentX + targetY * segmentY) / segmentLengthSquared));
    const projected: GeoPoint = {
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction,
    };
    const distanceFromLine = haversineDistanceMeters(target.lat, target.lng, projected.lat, projected.lng);
    const segmentLength = distanceBetween(start, end);
    if (best === null || distanceFromLine < best.distanceFromLineMeters)
    {
      best = {
        point: projected,
        segmentIndex: index,
        distanceFromLineMeters: distanceFromLine,
        distanceAlongMeters: travelled + segmentLength * fraction,
      };
    }
    travelled += segmentLength;
  }
  return best;
}
