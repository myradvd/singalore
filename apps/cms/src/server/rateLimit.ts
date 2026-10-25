import { createHash } from 'node:crypto';

export interface RateLimiter
{
  allow(clientKey: string): Promise<boolean>;
}

export function clientKeyFromRequest(request: Request): string
{
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded ?? request.headers.get('x-real-ip') ?? 'unknown';
}

export function hashClientKey(clientKey: string, salt: string): string
{
  return createHash('sha256').update(`${salt}:${clientKey}`).digest('hex');
}

export function createPostgresRateLimiter(rpc: (keyHash: string) => Promise<boolean>, salt: string): RateLimiter
{
  return {
    allow: async (clientKey) => rpc(hashClientKey(clientKey, salt)),
  };
}
