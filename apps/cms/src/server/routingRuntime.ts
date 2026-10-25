import 'server-only';
import { serverEnv } from './env';
import { createPostgresRateLimiter } from './rateLimit';
import { createOsrmProvider } from './routingProvider';
import { supabaseAdmin } from './supabaseAdmin';

export function routingRuntime()
{
  const env = serverEnv();
  const provider = createOsrmProvider(env.ROUTING_BASE_URL, env.ROUTING_PROFILE);
  const limiter = createPostgresRateLimiter(async (keyHash) =>
  {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', { p_key_hash: keyHash, p_window_seconds: 60, p_max: env.RATE_LIMIT_MAX_PER_MINUTE });
    return error !== null ? true : data === true;
  }, env.RATE_LIMIT_SALT);
  const log = (entry: { kind: string; status: number; latencyMs: number }) => console.info('routing', entry.kind, entry.status, `${entry.latencyMs}ms`);
  return { provider, limiter, log };
}
