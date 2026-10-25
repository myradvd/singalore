import { describe, expect, it } from 'vitest';
import {
  boundingBoxOf,
  circlePolygonRing,
  decodePolyline6,
  destinationPoint,
  distanceBetween,
  encodePolyline6,
  haversineDistanceMeters,
  isInsideBoundingBox,
  pathLengthMeters,
  projectOntoPolyline,
  SINGAPORE_BBOX,
} from '../src';

describe('haversineDistanceMeters', () =>
{
  it('returns zero for identical points', () =>
  {
    expect(haversineDistanceMeters(1.29, 103.85, 1.29, 103.85)).toBe(0);
  });

  it('matches a known distance across central Singapore within 0.5 percent', () =>
  {
    const chijmesToRafflesHotel = haversineDistanceMeters(1.29516, 103.85193, 1.29486, 103.85441);
    expect(chijmesToRafflesHotel).toBeGreaterThan(270);
    expect(chijmesToRafflesHotel).toBeLessThan(285);
  });

  it('one degree of latitude is about 111.2 km', () =>
  {
    const meters = haversineDistanceMeters(0, 0, 1, 0);
    expect(Math.abs(meters - 111195) / 111195).toBeLessThan(0.005);
  });
});

describe('destinationPoint', () =>
{
  it('round trips with the haversine distance', () =>
  {
    const origin = { lat: 1.2847, lng: 103.8435 };
    for (const bearing of [0, 45, 90, 180, 270])
    {
      const target = destinationPoint(origin, bearing, 250);
      expect(distanceBetween(origin, target)).toBeCloseTo(250, 3);
    }
  });
});

describe('circlePolygonRing', () =>
{
  it('is closed and every vertex lies on the radius', () =>
  {
    const center = { lat: 1.3, lng: 103.8 };
    const ring = circlePolygonRing(center, 40, 24);
    expect(ring).toHaveLength(25);
    expect(ring[0]).toEqual(ring[24]);
    for (const [lng, lat] of ring)
    {
      expect(distanceBetween(center, { lat, lng })).toBeCloseTo(40, 3);
    }
  });
});

describe('bounding boxes', () =>
{
  it('detects points inside and outside Singapore', () =>
  {
    expect(isInsideBoundingBox({ lat: 1.29, lng: 103.85 }, SINGAPORE_BBOX)).toBe(true);
    expect(isInsideBoundingBox({ lat: 51.5, lng: -0.12 }, SINGAPORE_BBOX)).toBe(false);
  });

  it('computes the bounding box of points and null for none', () =>
  {
    expect(boundingBoxOf([])).toBeNull();
    expect(boundingBoxOf([{ lat: 1, lng: 2 }, { lat: -1, lng: 5 }])).toEqual({ minLat: -1, minLng: 2, maxLat: 1, maxLng: 5 });
  });
});

describe('polyline6', () =>
{
  it('decodes the OSRM documentation example', () =>
  {
    const decoded = decodePolyline6('_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI');
    expect(decoded).toHaveLength(3);
    expect(decoded[0]?.lat).toBeCloseTo(38.5, 6);
    expect(decoded[0]?.lng).toBeCloseTo(-120.2, 6);
    expect(decoded[2]?.lat).toBeCloseTo(43.252, 6);
    expect(decoded[2]?.lng).toBeCloseTo(-126.453, 6);
  });

  it('round trips Singapore coordinates', () =>
  {
    const points = [{ lat: 1.284123, lng: 103.843456 }, { lat: 1.285, lng: 103.8441 }, { lat: 1.2799, lng: 103.8501 }];
    const decoded = decodePolyline6(encodePolyline6(points));
    decoded.forEach((point, index) =>
    {
      expect(point.lat).toBeCloseTo(points[index]?.lat ?? 0, 6);
      expect(point.lng).toBeCloseTo(points[index]?.lng ?? 0, 6);
    });
  });

  it('rejects truncated input', () =>
  {
    expect(() => decodePolyline6('_izlhA~')).toThrow('Malformed polyline');
  });
});

describe('projectOntoPolyline', () =>
{
  const line = [{ lat: 1.3, lng: 103.8 }, { lat: 1.3, lng: 103.801 }, { lat: 1.301, lng: 103.801 }];

  it('returns null for an empty line', () =>
  {
    expect(projectOntoPolyline({ lat: 1.3, lng: 103.8 }, [])).toBeNull();
  });

  it('projects onto the nearest segment and measures distance along', () =>
  {
    const target = destinationPoint({ lat: 1.3, lng: 103.8005 }, 0, 20);
    const projection = projectOntoPolyline(target, line);
    expect(projection?.segmentIndex).toBe(0);
    expect(projection?.distanceFromLineMeters).toBeCloseTo(20, 0);
    expect(projection?.distanceAlongMeters).toBeCloseTo(pathLengthMeters(line.slice(0, 2)) / 2, 0);
  });

  it('clamps to segment ends', () =>
  {
    const target = { lat: 1.302, lng: 103.801 };
    const projection = projectOntoPolyline(target, line);
    expect(projection?.segmentIndex).toBe(1);
    expect(projection?.distanceAlongMeters).toBeCloseTo(pathLengthMeters(line), 0);
  });
});
