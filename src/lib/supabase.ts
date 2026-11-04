import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/** Worker sign-in. Uses Supabase's default storage key, which the Stock module also reads. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Admin sign-in, stored separately so the Mobile Demo can sign in a worker
 *  in the same browser without signing the admin out. */
export const adminSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'mantap-admin-auth' },
});

/** Call one of this portal's Edge Functions; throws Error(code) on failure. */
export async function callFunction<T>(client: SupabaseClient, name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    let code = 'err_network';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) code = (await ctx.json()).error ?? code;
    } catch { /* keep default */ }
    throw new Error(code);
  }
  return data as T;
}
