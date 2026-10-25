import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ContentRepository } from './contentRepository';
import { serverEnv } from './env';
import { supabaseAdmin } from './supabaseAdmin';

export const NOT_A_MANAGER_MESSAGE = 'This account is not a content manager.';

export async function supabaseForRequest(): Promise<SupabaseClient>
{
  const env = serverEnv();
  const store = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) =>
      {
        try
        {
          for (const { name, value, options } of cookiesToSet)
          {
            store.set(name, value, options);
          }
        }
        catch
        {
          // Server Components cannot write cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

const ManagerRow = z.object({ display_name: z.string(), role: z.enum(['editor', 'admin']) });

export interface Manager
{
  userId: string;
  displayName: string;
  content: ContentRepository;
}

export async function isContentManager(userId: string): Promise<boolean>
{
  const { data, error } = await supabaseAdmin().from('content_managers').select('display_name, role').eq('user_id', userId).maybeSingle();
  return error === null && ManagerRow.safeParse(data).success;
}

export async function requireManager(): Promise<Manager>
{
  const supabase = await supabaseForRequest();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (user === null)
  {
    redirect('/cms/login');
  }
  const { data: row } = await supabaseAdmin().from('content_managers').select('display_name, role').eq('user_id', user.id).maybeSingle();
  const manager = ManagerRow.safeParse(row);
  if (!manager.success)
  {
    await supabase.auth.signOut();
    redirect(`/cms/login?error=${encodeURIComponent(NOT_A_MANAGER_MESSAGE)}`);
  }
  return { userId: user.id, displayName: manager.data.display_name, content: new ContentRepository(supabaseAdmin(), user.id) };
}
