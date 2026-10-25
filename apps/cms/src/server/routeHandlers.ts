import { RouteRequest, TableRequest } from '@singalore/shared';
import type { z } from 'zod';
import { apiError } from './http';
import { clientKeyFromRequest, type RateLimiter } from './rateLimit';
import { RoutingProviderError, type RoutingProvider } from './routingProvider';

async function readBody(request: Request): Promise<unknown>
{
  try
  {
    return await request.json();
  }
  catch
  {
    return null;
  }
}

function validationError(error: z.ZodError): Response
{
  const outOfRegion = error.issues.some((issue) => issue.message === 'out_of_region');
  const tooMany = error.issues.some((issue) => issue.code === 'too_big');
  if (outOfRegion)
  {
    return apiError('out_of_region', 'All coordinates must be in Singapore.', 422);
  }
  if (tooMany)
  {
    return apiError('too_many_coordinates', 'At most 12 coordinates are allowed.', 422);
  }
  return apiError('invalid_request', 'The request body is not a valid route request.', 400);
}

export async function handleRouting(
  request: Request,
  kind: 'route' | 'table',
  provider: RoutingProvider,
  limiter: RateLimiter,
  log: (entry: { kind: string; status: number; latencyMs: number }) => void,
): Promise<Response>
{
  const started = Date.now();
  const respond = (response: Response): Response =>
  {
    log({ kind, status: response.status, latencyMs: Date.now() - started });
    return response;
  };
  if (!(await limiter.allow(clientKeyFromRequest(request))))
  {
    return respond(apiError('rate_limited', 'Too many routing requests. Please wait a minute.', 429, { 'Retry-After': '60' }));
  }
  const body = await readBody(request);
  const parsed = (kind === 'route' ? RouteRequest : TableRequest).safeParse(body);
  if (!parsed.success)
  {
    return respond(validationError(parsed.error));
  }
  try
  {
    const result = kind === 'route' ? await provider.route(parsed.data.coordinates) : await provider.table(parsed.data.coordinates);
    return respond(Response.json(result, { headers: { 'Cache-Control': 'no-store' } }));
  }
  catch (error)
  {
    if (error instanceof RoutingProviderError)
    {
      return respond(apiError(error.code, 'Unable to calculate route. Please try again later.', error.code === 'upstream_timeout' ? 504 : 502));
    }
    return respond(apiError('internal', 'Unable to calculate route. Please try again later.', 500));
  }
}
