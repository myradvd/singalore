import { createHash } from 'node:crypto';

/** Decides whether a client may make another routing request in the current time window. */
export interface RateLimiter
{
  allow(clientKey: string): Promise<boolean>;
}
/**
 * Identifies the caller by IP address from proxy headers.
 * @returns First x-forwarded-for address, else x-real-ip, else 'unknown'.
 */
export function clientKeyFromRequest(request: Request): string
{
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded ?? request.headers.get('x-real-ip') ?? 'unknown';
}
/**
 * Hashes a client key with a secret salt so raw IP addresses are never stored.
 * @returns SHA-256 hex digest of salt and key.
 */
export function hashClientKey(clientKey: string, salt: string): string
{
  return createHash('sha256').update(`${salt}:${clientKey}`).digest('hex');
}
/**
 * Creates a rate limiter backed by the Postgres function rate_limit_hit().
 * Stored in the database because in-memory counters do not work across serverless instances.
 * @param rpc - Calls rate_limit_hit with the hashed key and returns whether the request is allowed.
 * @param salt - Secret salt for hashing client keys.
 */
export function createPostgresRateLimiter(rpc: (keyHash: string) => Promise<boolean>, salt: string): RateLimiter
{
  return {
    allow: async (clientKey) => rpc(hashClientKey(clientKey, salt)),
  };
}
