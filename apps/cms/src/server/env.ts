import { z } from 'zod';

const ServerEnv = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PUBLIC_MEDIA_BASE_URL: z.url().optional(),
  ROUTING_BASE_URL: z.url().default('https://routing.openstreetmap.de/routed-foot'),
  ROUTING_PROFILE: z.string().default('foot'),
  RATE_LIMIT_SALT: z.string().min(16),
  RATE_LIMIT_MAX_PER_MINUTE: z.coerce.number().int().positive().default(30),
  APP_VERSION: z.string().default('0.1.0'),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

// Hosting dashboards often keep a variable with an empty value, so blank counts as not set and defaults apply.
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv
{
  const withoutBlanks = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value.trim().length > 0));
  return ServerEnv.parse(withoutBlanks);
}

export function serverEnv(): ServerEnv
{
  if (cached === null)
  {
    cached = parseServerEnv(process.env);
  }
  return cached;
}

export function mediaBaseUrl(env: ServerEnv): string
{
  return (env.PUBLIC_MEDIA_BASE_URL ?? `${env.SUPABASE_URL}/storage/v1/object/public/media`).replace(/\/+$/, '');
}
