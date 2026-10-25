import type { GeoPoint } from './types';

export const EARTH_RADIUS_M = 6371008.8;

const DEGREES_TO_RADIANS = Math.PI / 180;

export function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number): number
{
  const deltaLat = (toLat - fromLat) * DEGREES_TO_RADIANS;
  const deltaLng = (toLng - fromLng) * DEGREES_TO_RADIANS;
  const sinHalfLat = Math.sin(deltaLat / 2);
  const sinHalfLng = Math.sin(deltaLng / 2);
  const a = sinHalfLat * sinHalfLat
    + Math.cos(fromLat * DEGREES_TO_RADIANS) * Math.cos(toLat * DEGREES_TO_RADIANS) * sinHalfLng * sinHalfLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function distanceBetween(from: GeoPoint, to: GeoPoint): number
{
  return haversineDistanceMeters(from.lat, from.lng, to.lat, to.lng);
}

export function pathLengthMeters(points: readonly GeoPoint[]): number
{
  let total = 0;
  for (let index = 1; index < points.length; index += 1)
  {
    const previous = points[index - 1];
    const current = points[index];
    if (previous !== undefined && current !== undefined)
    {
      total += distanceBetween(previous, current);
    }
  }
  return total;
}

export function destinationPoint(origin: GeoPoint, bearingDegrees: number, distanceMeters: number): GeoPoint
{
  const angularDistance = distanceMeters / EARTH_RADIUS_M;
  const bearing = bearingDegrees * DEGREES_TO_RADIANS;
  const lat1 = origin.lat * DEGREES_TO_RADIANS;
  const lng1 = origin.lng * DEGREES_TO_RADIANS;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance)
    + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: lat2 / DEGREES_TO_RADIANS, lng: lng2 / DEGREES_TO_RADIANS };
}

export function circlePolygonRing(center: GeoPoint, radiusMeters: number, segments = 48): [number, number][]
{
  const ring: [number, number][] = [];
  for (let index = 0; index < segments; index += 1)
  {
    const point = destinationPoint(center, (index * 360) / segments, radiusMeters);
    ring.push([point.lng, point.lat]);
  }
  const first = ring[0];
  if (first !== undefined)
  {
    ring.push([first[0], first[1]]);
  }
  return ring;
}
