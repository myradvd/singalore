import type { ApiErrorCode } from '@singalore/shared';

export function apiError(code: ApiErrorCode, message: string, status: number, headers: Record<string, string> = {}): Response
{
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export const CACHEABLE_SNAPSHOT_HEADERS = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
} as const;

export function etagMatches(ifNoneMatch: string | null, etag: string): boolean
{
  if (ifNoneMatch === null)
  {
    return false;
  }
  return ifNoneMatch.split(',').map((value) => value.trim().replace(/^W\//, '')).some((value) => value === etag || value === '*');
}

export function snapshotResponse(request: Request, etag: string, body: unknown): Response
{
  const headers = { ...CACHEABLE_SNAPSHOT_HEADERS, ETag: etag };
  if (etagMatches(request.headers.get('if-none-match'), etag))
  {
    return new Response(null, { status: 304, headers });
  }
  return Response.json(body, { status: 200, headers });
}
