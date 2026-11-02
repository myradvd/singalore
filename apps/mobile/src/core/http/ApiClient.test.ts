import { API_PATHS, Health } from '@singalore/shared';
import { z } from 'zod';
import { createAppEventBus, type NetworkRequestRecord } from '../appEvents';
import { ManualClock } from '../clock';
import type { DiagnosticsLevel, DiagnosticsRecorder } from '../diagnostics';
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

type RecordedRow = { level: DiagnosticsLevel; code: string; detail?: string };

// Builds a client whose failures are written to an in-memory list of rows.
function setupWithDiagnostics(fetchImplementation: typeof fetch)
{
  const events = createAppEventBus();
  const rows: RecordedRow[] = [];
  const diagnostics: DiagnosticsRecorder = {
    record: async (level, code, detail) =>
    {
      rows.push({ level, code, detail });
    },
  };
  const client = new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation, clock: new ManualClock(1000), events, diagnostics, defaultTimeoutMs: 50 });
  return { client, rows, events };
}

// Fetch that only settles when the client aborts it.
const fetchThatHangsUntilAborted: typeof fetch = (_url, init) => new Promise((_resolve, reject) =>
{
  init?.signal?.addEventListener('abort', () => reject(new Error('aborted at 1.2903,103.8515')));
});

const failureKinds: { name: string; fetchImplementation: typeof fetch; code: string; status: string }[] = [
  { name: 'http 500', fetchImplementation: async () => jsonResponse({ error: { code: 'upstream', message: 'failed near 1.2903,103.8515' } }, 500), code: 'api_http_error', status: '500' },
  { name: 'timeout', fetchImplementation: fetchThatHangsUntilAborted, code: 'api_timeout', status: 'none' },
  { name: 'network', fetchImplementation: async () =>
  {
    throw new TypeError('Network request failed at 1.2903,103.8515');
  }, code: 'api_network_error', status: 'none' },
  { name: 'bad JSON', fetchImplementation: async () => new Response('not json 1.2903,103.8515'), code: 'api_invalid_json', status: '200' },
  { name: 'schema', fetchImplementation: async () => jsonResponse({ echoed: { lat: 1.2903, lng: 103.8515 } }), code: 'api_schema_mismatch', status: '200' },
];

describe('API failure diagnostics (NFR 6.2)', () =>
{
  it.each(failureKinds)('writes exactly one row with method, path and status for $name', async ({ fetchImplementation, code, status }) =>
  {
    const { client, rows } = setupWithDiagnostics(fetchImplementation);
    await expect(client.get(API_PATHS.health, Health)).rejects.toBeInstanceOf(ApiRequestError);
    expect(rows).toEqual([{ level: 'error', code, detail: `GET /api/v1/health status=${status}` }]);
  });

  it.each(failureKinds)('keeps coordinates out of the row when a route POST fails by $name', async ({ fetchImplementation, code, status }) =>
  {
    const { client, rows } = setupWithDiagnostics(fetchImplementation);
    const body = { coordinates: [{ lat: 1.2903, lng: 103.8515 }, { lat: 1.3001, lng: 103.8602 }] };
    await expect(client.post(API_PATHS.route, body, Health)).rejects.toBeInstanceOf(ApiRequestError);
    expect(rows).toEqual([{ level: 'error', code, detail: `POST /api/v1/route status=${status}` }]);
  });

  it('drops a query string carrying coordinates from the row', async () =>
  {
    const { client, rows } = setupWithDiagnostics(async () => jsonResponse(null, 500));
    await expect(client.get('/api/v1/health?lat=1.2903&lng=103.8515', Health)).rejects.toMatchObject({ kind: 'http' });
    expect(rows[0]?.detail).toBe('GET /api/v1/health status=500');
  });

  it.each([
    ['200', () => jsonResponse({})],
    ['299', () => jsonResponse({}, 299)],
    ['304', () => jsonResponse(null, 304)],
  ])('valid EC, no row for a successful status %s', async (_status, respond) =>
  {
    const { client, rows } = setupWithDiagnostics(async () => respond());
    await client.get(API_PATHS.catalog, z.object({}));
    expect(rows).toEqual([]);
  });

  it.each([300, 303, 305, 400])('writes one row for the failing status %i', async (status) =>
  {
    const { client, rows } = setupWithDiagnostics(async () => jsonResponse(null, status));
    await expect(client.get(API_PATHS.catalog, z.object({}))).rejects.toMatchObject({ kind: 'http', status });
    expect(rows).toEqual([{ level: 'error', code: 'api_http_error', detail: `GET /api/v1/catalog status=${status}` }]);
  });

  it('writes no row for a privacy block, because no request was sent', async () =>
  {
    const fetchMock = jest.fn(async () => jsonResponse({}));
    const { client, rows } = setupWithDiagnostics(fetchMock);
    await expect(client.post(API_PATHS.catalog, { lat: 1, lng: 2 }, z.object({}))).rejects.toMatchObject({ kind: 'privacy_violation' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });

  it('leaves the diagnostics/recorded event to the recorder, so a parse failure does not announce a row twice', async () =>
  {
    const { client, events } = setupWithDiagnostics(async () => jsonResponse({ status: 'broken' }));
    const announced: string[] = [];
    events.on('diagnostics/recorded', (entry) => announced.push(entry.code));
    await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'invalid_response' });
    expect(announced).toEqual([]);
  });

  describe.each<[string, DiagnosticsRecorder['record']]>([
    ['throws', () =>
    {
      throw new Error('disk full');
    }],
    ['rejects', () => Promise.reject(new Error('disk full'))],
    ['never settles', () => new Promise<void>(() => undefined)],
  ])('when the recorder %s', (_behaviour, record) =>
  {
    // Builds a client whose recorder misbehaves.
    function clientWithBrokenRecorder(fetchImplementation: typeof fetch): ApiClient
    {
      return new ApiClient({ baseUrl: () => 'https://api.test', fetchImplementation, clock: new ManualClock(1000), events: createAppEventBus(), diagnostics: { record }, defaultTimeoutMs: 50 });
    }

    it('still reports the http error', async () =>
    {
      const client = clientWithBrokenRecorder(async () => jsonResponse(null, 500));
      await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'http', status: 500 });
    });

    it('still reports the network error', async () =>
    {
      const client = clientWithBrokenRecorder(async () =>
      {
        throw new TypeError('Network request failed');
      });
      await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'network' });
    });

    it('still reports the invalid response', async () =>
    {
      const client = clientWithBrokenRecorder(async () => jsonResponse({ status: 'broken' }));
      await expect(client.get(API_PATHS.health, Health)).rejects.toMatchObject({ kind: 'invalid_response' });
    });
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
