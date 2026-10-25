import { describe, expect, it } from 'vitest';
import { CatalogLandmark, GeoJsonPolygon, MAX_ROUTE_COORDINATES, RouteRequest, TableRequest } from '../src';

const tanjongPagar = { lat: 1.2765, lng: 103.8384 };

describe('RouteRequest', () =>
{
  it('accepts two Singapore coordinates', () =>
  {
    expect(RouteRequest.safeParse({ coordinates: [tanjongPagar, { lat: 1.2847, lng: 103.8435 }] }).success).toBe(true);
  });

  it('rejects a single coordinate', () =>
  {
    expect(RouteRequest.safeParse({ coordinates: [tanjongPagar] }).success).toBe(false);
  });

  it('rejects coordinates outside the region', () =>
  {
    const result = RouteRequest.safeParse({ coordinates: [tanjongPagar, { lat: 51.5, lng: -0.1 }] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('out_of_region');
  });

  it('caps the number of coordinates', () =>
  {
    const coordinates = Array.from({ length: MAX_ROUTE_COORDINATES + 1 }, () => tanjongPagar);
    expect(TableRequest.safeParse({ coordinates }).success).toBe(false);
    expect(TableRequest.safeParse({ coordinates: coordinates.slice(1) }).success).toBe(true);
  });
});

describe('CatalogLandmark', () =>
{
  const base = {
    id: '6f1b8a0e-3c2d-4b5a-9e8f-1a2b3c4d5e6f',
    parkId: '7a1b8a0e-3c2d-4b5a-9e8f-1a2b3c4d5e6f',
    slug: 'chijmes',
    name: 'Chijmes',
    aliases: ['CHIJMES'],
    category: 'religious',
    position: { lat: 1.29516, lng: 103.85193 },
    geofenceRadiusM: 30,
    shortDescription: 'Former convent',
    thumbnailUrl: null,
    builtYear: 1904,
    architecturalStyle: 'Gothic Revival',
    sortOrder: 1,
    attribution: 'Wikidata Q1074224',
  };

  it('accepts a valid landmark', () =>
  {
    expect(CatalogLandmark.safeParse(base).success).toBe(true);
  });

  it('rejects radius outside 15 to 100 m and unknown categories', () =>
  {
    expect(CatalogLandmark.safeParse({ ...base, geofenceRadiusM: 10 }).success).toBe(false);
    expect(CatalogLandmark.safeParse({ ...base, geofenceRadiusM: 101 }).success).toBe(false);
    expect(CatalogLandmark.safeParse({ ...base, category: 'castle' }).success).toBe(false);
  });
});

describe('GeoJsonPolygon', () =>
{
  it('requires closed rings', () =>
  {
    const open = { type: 'Polygon', coordinates: [[[103.8, 1.3], [103.81, 1.3], [103.81, 1.31], [103.8, 1.31]]] };
    const closed = { type: 'Polygon', coordinates: [[[103.8, 1.3], [103.81, 1.3], [103.81, 1.31], [103.8, 1.3]]] };
    expect(GeoJsonPolygon.safeParse(open).success).toBe(false);
    expect(GeoJsonPolygon.safeParse(closed).success).toBe(true);
  });
});
