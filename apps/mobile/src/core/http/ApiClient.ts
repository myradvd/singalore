import { ApiError, COORDINATE_BEARING_PATHS } from '@singalore/shared';
import type { z } from 'zod';
import type { AppEventBus, NetworkRequestRecord } from '../appEvents';
import type { Clock } from '../clock';
import { localizeLoopbackUrl, localizeLoopbackUrls, loopbackReplacementHost } from './loopbackUrls';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid_response' | 'privacy_violation';
/** API failure with a kind: network, timeout, http, invalid_response or privacy_violation. */
export class ApiRequestError extends Error
{
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly apiCode: string | null = null,
  )
  {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export type GetResult<T> =
  | { status: 'ok'; data: T; etag: string | null }
  | { status: 'not_modified' };

export interface ApiClientOptions
{
  baseUrl: () => string;
  fetchImplementation: typeof fetch;
  clock: Clock;
  events: AppEventBus;
  defaultTimeoutMs?: number;
}

const COORDINATE_KEYS = new Set(['lat', 'lng', 'lon', 'latitude', 'longitude', 'coordinates']);
/** @returns True if a request body contains location fields (lat, lng, coordinates and similar). */
export function containsCoordinates(value: unknown, depth = 0): boolean
{
  if (depth > 8 || value === null || typeof value !== 'object')
  {
    return false;
  }
  if (Array.isArray(value))
  {
    return value.some((item) => containsCoordinates(item, depth + 1));
  }
  return Object.entries(value).some(([key, nested]) => COORDINATE_KEYS.has(key.toLowerCase()) || containsCoordinates(nested, depth + 1));
}
/**
 * The app's only connection to the server (/api/v1). The app never talks to the database directly.
 * Validates every response with a zod schema and logs each call for the debug network log.
 */
export class ApiClient
{
  private nextRequestId = 1;

  constructor(private readonly options: ApiClientOptions)
  {
  }

  localizeMediaUrl(url: string): string
  {
    const replacementHost = loopbackReplacementHost(this.options.baseUrl());
    return replacementHost === null ? url : localizeLoopbackUrl(url, replacementHost);
  }
/**
 * Sends a GET request.
 * @param path - API path, for example /api/v1/catalog.
 * @param schema - Zod schema the response must match.
 * @param init - ifNoneMatch sends a saved ETag; timeoutMs sets a time limit.
 * @returns not_modified for HTTP 304, otherwise ok with the parsed data and new ETag.
 */
  async get<Schema extends z.ZodType>(path: string, schema: Schema, init: { ifNoneMatch?: string | null; timeoutMs?: number } = {}): Promise<GetResult<z.infer<Schema>>>
  {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.ifNoneMatch !== undefined && init.ifNoneMatch !== null)
    {
      headers['If-None-Match'] = init.ifNoneMatch;
    }
    const response = await this.send('GET', path, { headers }, init.timeoutMs);
    if (response.status === 304)
    {
      return { status: 'not_modified' };
    }
    const data = await this.parse(response, schema, 'GET', path);
    return { status: 'ok', data, etag: response.headers.get('etag') };
  }
/**
 * Sends a POST request.
 * Privacy rule: refuses to send coordinates to any endpoint except the two route endpoints.
 * @returns The parsed response.
 * @throws ApiRequestError on failure, including privacy_violation.
 */
  async post<Schema extends z.ZodType>(path: string, body: unknown, schema: Schema, init: { timeoutMs?: number } = {}): Promise<z.infer<Schema>>
  {
    if (containsCoordinates(body) && !COORDINATE_BEARING_PATHS.includes(path))
    {
      throw new ApiRequestError('privacy_violation', `Coordinates may only be sent to route endpoints, not ${path}`);
    }
    const response = await this.send('POST', path, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, init.timeoutMs);
    return this.parse(response, schema, 'POST', path);
  }

  private async send(method: 'GET' | 'POST', path: string, init: RequestInit, timeoutMs?: number): Promise<Response>
  {
    const id = this.nextRequestId++;
    const started = this.options.clock.now();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() =>
    {
      timedOut = true;
      controller.abort();
    }, timeoutMs ?? this.options.defaultTimeoutMs ?? 10000);
    try
    {
      const response = await this.options.fetchImplementation(`${this.options.baseUrl()}${path}`, { ...init, method, signal: controller.signal });
      if (!response.ok && response.status !== 304)
      {
        const apiError = ApiError.safeParse(await response.json().catch(() => null));
        this.record({ id, method, path, status: response.status, started, outcome: 'http_error' });
        throw new ApiRequestError(
          'http',
          apiError.success ? apiError.data.error.message : `Request failed with status ${response.status}`,
          response.status,
          apiError.success ? apiError.data.error.code : null,
        );
      }
      this.record({ id, method, path, status: response.status, started, outcome: response.status === 304 ? 'not_modified' : 'ok' });
      return response;
    }
    catch (error)
    {
      if (error instanceof ApiRequestError)
      {
        throw error;
      }
      const kind = timedOut ? 'timeout' : 'network';
      this.record({ id, method, path, status: null, started, outcome: timedOut ? 'timeout' : 'network_error' });
      throw new ApiRequestError(kind, timedOut ? 'The request timed out' : 'The network request failed');
    }
    finally
    {
      clearTimeout(timer);
    }
  }

  private async parse<Schema extends z.ZodType>(response: Response, schema: Schema, method: 'GET' | 'POST', path: string): Promise<z.infer<Schema>>
  {
    let json: unknown;
    try
    {
      json = await response.json();
    }
    catch
    {
      this.options.events.emit('diagnostics/recorded', { level: 'error', code: 'api_invalid_json' });
      throw new ApiRequestError('invalid_response', `Invalid JSON from ${method} ${path}`, response.status);
    }
    const parsed = schema.safeParse(localizeLoopbackUrls(json, loopbackReplacementHost(this.options.baseUrl())));
    if (!parsed.success)
    {
      this.options.events.emit('diagnostics/recorded', { level: 'error', code: 'api_schema_mismatch' });
      throw new ApiRequestError('invalid_response', `Unexpected response shape from ${method} ${path}`, response.status);
    }
    return parsed.data;
  }

  private record(input: { id: number; method: 'GET' | 'POST'; path: string; status: number | null; started: number; outcome: NetworkRequestRecord['outcome'] }): void
  {
    const now = this.options.clock.now();
    this.options.events.emit('network/request', {
      id: input.id,
      method: input.method,
      path: input.path,
      status: input.status,
      latencyMs: now - input.started,
      outcome: input.outcome,
      at: now,
    });
  }
}
