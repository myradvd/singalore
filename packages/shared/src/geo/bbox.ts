import type { BoundingBox } from '../constants';
import type { GeoPoint } from './types';

export function isInsideBoundingBox(point: GeoPoint, box: BoundingBox): boolean
{
  return point.lat >= box.minLat && point.lat <= box.maxLat && point.lng >= box.minLng && point.lng <= box.maxLng;
}

export function boundingBoxOf(points: readonly GeoPoint[]): BoundingBox | null
{
  if (points.length === 0)
  {
    return null;
  }
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const point of points)
  {
    minLat = Math.min(minLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLat = Math.max(maxLat, point.lat);
    maxLng = Math.max(maxLng, point.lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}
