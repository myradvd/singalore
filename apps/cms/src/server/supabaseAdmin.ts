import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient
{
  if (client === null)
  {
    const env = serverEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
