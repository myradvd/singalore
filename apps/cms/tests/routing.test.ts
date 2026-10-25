import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { decodePolyline6 } from '@singalore/shared';
import { hashClientKey } from '@/server/rateLimit';
import { handleRouting } from '@/server/routeHandlers';
import { createOsrmProvider, mapOsrmRoute, mapOsrmTable, RoutingProviderError, type RoutingProvider } from '@/server/routingProvider';

const routeFixture: unknown = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'osrm-route.json'), 'utf8'));
const tableFixture: unknown = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'osrm-table.json'), 'utf8'));
const points = [{ lat: 1.29516, lng: 103.85193 }, { lat: 1.29486, lng: 103.85441 }];

describe('OSRM mapping (recorded FOSSGIS fixtures)', () =>
{
  it('maps a route with steps and polyline6 geometry', () =>
  {
    const route = mapOsrmRoute(routeFixture, 'routing.openstreetmap.de');
    expect(route.legs).toHaveLength(2);
    expect(route.distanceM).toBeGreaterThan(1000);
    expect(route.legs[0]?.steps[0]?.maneuver.type).toBe('depart');
    const line = decodePolyline6(route.geometryPolyline6);
    expect(line.length).toBeGreaterThan(5);
    expect(line[0]?.lat).toBeCloseTo(1.295, 2);
  });

  it('maps a duration table', () =>
  {
    const table = mapOsrmTable(tableFixture, 'x');
    expect(table.durationsS).toHaveLength(3);
    expect(table.durationsS[0]?.[0]).toBe(0);
  });

  it('rejects provider errors', () =>
  {
    expect(() => mapOsrmRoute({ code: 'NoRoute' }, 'x')).toThrow(RoutingProviderError);
    expect(() => mapOsrmTable({ code: 'Ok' }, 'x')).toThrow(RoutingProviderError);
  });

  it('retries once on a 5xx and builds lng,lat URLs', async () =>
  {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(routeFixture)));
    const provider = createOsrmProvider('https://routing.example/routed-foot', 'foot', fetchMock);
    await provider.route(points);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/route/v1/foot/103.851930,1.295160;103.854410,1.294860?overview=full&geometries=polyline6&steps=true');
  });
});

function provider(overrides: Partial<RoutingProvider> = {}): RoutingProvider
{
  return {
    route: async () => mapOsrmRoute(routeFixture, 'x'),
    table: async () => mapOsrmTable(tableFixture, 'x'),
    ...overrides,
  };
}

const allow = { allow: async () => true };
const post = (body: unknown) => new Request('https://api.test/api/v1/route', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '203.0.113.9' } });

describe('route proxy handler', () =>
{
  it('returns a route and logs status and latency only', async () =>
  {
    const log = vi.fn();
    const response = await handleRouting(post({ coordinates: points }), 'route', provider(), allow, log);
    expect(response.status).toBe(200);
    expect(log).toHaveBeenCalledWith({ kind: 'route', status: 200, latencyMs: expect.any(Number) });
    expect(JSON.stringify(log.mock.calls)).not.toContain('103.85');
  });

  it('validates region, coordinate count and body shape', async () =>
  {
    const outside = await handleRouting(post({ coordinates: [points[0], { lat: 51.5, lng: -0.1 }] }), 'route', provider(), allow, () => undefined);
    expect(outside.status).toBe(422);
    expect((await outside.json()).error.code).toBe('out_of_region');
    const tooMany = await handleRouting(post({ coordinates: Array.from({ length: 13 }, () => points[0]) }), 'table', provider(), allow, () => undefined);
    expect((await tooMany.json()).error.code).toBe('too_many_coordinates');
    const garbage = await handleRouting(new Request('https://api.test', { method: 'POST', body: 'nope' }), 'route', provider(), allow, () => undefined);
    expect(garbage.status).toBe(400);
  });

  it('maps upstream failures to the SRS message and rate limits', async () =>
  {
    const failing = provider({ route: async () =>
    {
      throw new RoutingProviderError('upstream_timeout', 'slow');
    } });
    const timeout = await handleRouting(post({ coordinates: points }), 'route', failing, allow, () => undefined);
    expect(timeout.status).toBe(504);
    expect((await timeout.json()).error.message).toBe('Unable to calculate route. Please try again later.');
    const limited = await handleRouting(post({ coordinates: points }), 'route', provider(), { allow: async () => false }, () => undefined);
    expect(limited.status).toBe(429);
  });

  it('hashes client addresses with a salt', () =>
  {
    expect(hashClientKey('203.0.113.9', 's')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashClientKey('203.0.113.9', 's')).not.toBe(hashClientKey('203.0.113.9', 't'));
  });
});
