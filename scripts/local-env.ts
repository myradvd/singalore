import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const StatusEnv = z.object({
  API_URL: z.string(),
  ANON_KEY: z.string(),
  SERVICE_ROLE_KEY: z.string(),
});

const target = path.resolve(import.meta.dirname, '..', 'apps', 'cms', '.env.local');

function existingValue(key: string): string | null
{
  if (!existsSync(target))
  {
    return null;
  }
  const line = readFileSync(target, 'utf8').split('\n').find((entry) => entry.startsWith(`${key}=`));
  return line === undefined ? null : line.slice(key.length + 1);
}

const status = StatusEnv.parse(JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' })));
const values: Record<string, string> = {
  SUPABASE_URL: status.API_URL,
  SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  PUBLIC_MEDIA_BASE_URL: existingValue('PUBLIC_MEDIA_BASE_URL') ?? `${status.API_URL}/storage/v1/object/public/media`,
  ROUTING_BASE_URL: existingValue('ROUTING_BASE_URL') ?? 'https://routing.openstreetmap.de/routed-foot',
  RATE_LIMIT_SALT: existingValue('RATE_LIMIT_SALT') ?? randomBytes(24).toString('hex'),
  RATE_LIMIT_MAX_PER_MINUTE: existingValue('RATE_LIMIT_MAX_PER_MINUTE') ?? '30',
  SEED_ADMIN_EMAIL: existingValue('SEED_ADMIN_EMAIL') ?? 'admin@singalore.local',
  SEED_ADMIN_PASSWORD: existingValue('SEED_ADMIN_PASSWORD') ?? randomBytes(12).toString('base64url'),
};
writeFileSync(target, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
console.log(`Wrote ${target} (gitignored). Local admin: ${values.SEED_ADMIN_EMAIL}, password in that file.`);
