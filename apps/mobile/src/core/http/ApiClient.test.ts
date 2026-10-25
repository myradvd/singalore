import { API_PATHS, Health } from '@singalore/shared';
import { z } from 'zod';
import { createAppEventBus, type NetworkRequestRecord } from '../appEvents';
import { ManualClock } from '../clock';
import { ApiClient, ApiRequestError, containsCoordinates } from './ApiClient';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response
{
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function setup(fetchImplementation: typeof fetch)
{
  const events = createAppEventBus();
  const records: NetworkRequestRecord[] = [];
  events.on('network/request', (record) => records.push(record));
  const client = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation, clock: new ManualClock(1000), events, defaultTimeoutMs: 50 });
  return { client, records };
}

const healthBody = { status: 'ok', serverTime: '2026-10-12T00:00:00.000Z', version: '0.1.0' };

describe('ApiClient', () =>
{
  it('parses a GET response, returns the etag and records the request', async () =>
  {
    const fetchMock = jest.fn(async () => jsonResponse(healthBody, 200, { ETag: '"abc"' }));
    const { client, records } = setup(fetchMock);
    const result = await client.get(API_PATHS.health, Health);
    expect(result).toEqual({ status: 'ok', data: healthBody, etag: '"abc"' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/health', expect.objectContaining({ method: 'GET' }));
    expect(records[0]).toMatchObject({ path: '/api/v1/health', status: 200, outcome: 'ok' });
  });

  it('sends If-None-Match and reports 304 as not modified', async () =>
  {
    const fetchMock = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
    {
      expect((init?.headers as Record<string, string>)['If-None-Match']).toBe('"abc"');
      return new Response(null, { status: 304 });
    });
    const { client, records } = setup(fetchMock);
    expect(await client.get(API_PATHS.catalog, z.object({}), { ifNoneMatch: '"abc"' })).toEqual({ status: 'not_modified' });
    expect(records[0]?.outcome).toBe('not_modified');
  });

  it('maps API error bodies to typed errors', async () =>
  {
    const { client, records } = setup(async () => jsonResponse({ error: { code: 'rate_limited', message: 'Slow down' } }, 429));
    await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'http', status: 429, apiCode: 'rate_limited', message: 'Slow down' });
    expect(records[0]?.outcome).toBe('http_error');
  });

  it('reports schema mismatches as invalid responses', async () =>
  {
    const { client } = setup(async () => jsonResponse({ status: 'broken' }));
    await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('reports network failures and timeouts', async () =>
  {
    const failing = setup(async () =>
    {
      throw new TypeError('Network request failed');
    });
    await expect(failing.client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'network' });
    expect(failing.records[0]?.outcome).toBe('network_error');

    const hanging = setup((_url, init) => new Promise((_resolve, reject) =>
    {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    await expect(hanging.client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'timeout' });
    expect(hanging.records[0]?.outcome).toBe('timeout');
  });
});

describe('privacy rule (NFR 3.2)', () =>
{
  it('detects coordinates anywhere in a body', () =>
  {
    expect(containsCoordinates({ coordinates: [] })).toBe(true);
    expect(containsCoordinates({ a: [{ b: { latitude: 1 } }] })).toBe(true);
    expect(containsCoordinates({ parkId: 'x', bytes: 3 })).toBe(false);
    expect(containsCoordinates(null)).toBe(false);
  });

  it('allows coordinates only to the route and table endpoints', async () =>
  {
    const fetchMock = jest.fn(async () => jsonResponse({}));
    const { client } = setup(fetchMock);
    const body = { coordinates: [{ lat: 1.29, lng: 103.85 }, { lat: 1.3, lng: 103.86 }] };
    await expect(client.post(API_PATHS.route, body, z.object({}))).resolves.toEqual({});
    await expect(client.post(API_PATHS.routeTable, body, z.object({}))).resolves.toEqual({});
    await expect(client.post(API_PATHS.catalog, body, z.object({}))).rejects.toBeInstanceOf(ApiRequestError);
    await expect(client.post('/api/v1/anything', { position: { lat: 1, lng: 2 } }, z.object({}))).rejects.toMatchObject({ kind: 'privacy_violation' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never puts coordinates in GET URLs', async () =>
  {
    const urls: string[] = [];
    const { client } = setup(async (url) =>
    {
      urls.push(String(url));
      return jsonResponse(healthBody);
    });
    await client.get(API_PATHS.health, Health);
    expect(urls.every((url) => !/(-?\d+\.\d{3,}),\s*(-?\d+\.\d{3,})/.test(url))).toBe(true);
  });
});
