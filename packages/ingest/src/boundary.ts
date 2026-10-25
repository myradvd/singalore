import { destinationPoint, type GeoJsonPolygon, type GeoPoint } from '@singalore/shared';

function cross(origin: GeoPoint, a: GeoPoint, b: GeoPoint): number
{
  return (a.lng - origin.lng) * (b.lat - origin.lat) - (a.lat - origin.lat) * (b.lng - origin.lng);
}

export function convexHull(points: readonly GeoPoint[]): GeoPoint[]
{
  const sorted = [...points].sort((a, b) => (a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng));
  if (sorted.length <= 2)
  {
    return sorted;
  }
  const lower: GeoPoint[] = [];
  for (const point of sorted)
  {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as GeoPoint, lower[lower.length - 1] as GeoPoint, point) <= 0)
    {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: GeoPoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1)
  {
    const point = sorted[index] as GeoPoint;
    while (upper.length >= 2 && cross(upper[upper.length - 2] as GeoPoint, upper[upper.length - 1] as GeoPoint, point) <= 0)
    {
      upper.pop();
    }
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

export function bufferedHullPolygon(points: readonly GeoPoint[], bufferMeters: number): GeoJsonPolygon | null
{
  if (points.length === 0)
  {
    return null;
  }
  const expanded: GeoPoint[] = [];
  for (const point of points)
  {
    for (let bearing = 0; bearing < 360; bearing += 30)
    {
      expanded.push(destinationPoint(point, bearing, bufferMeters));
    }
  }
  const hull = convexHull(expanded);
  const ring: [number, number][] = hull.map((point) => [roundCoordinate(point.lng), roundCoordinate(point.lat)]);
  const first = ring[0];
  if (first === undefined)
  {
    return null;
  }
  ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

function roundCoordinate(value: number): number
{
  return Math.round(value * 1e6) / 1e6;
}
