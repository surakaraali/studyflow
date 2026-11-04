/**
 * Service-role Supabase client. It bypasses RLS, so use it only after the function has checked
 * who is calling, and never return its raw query results to the caller.
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by the Edge runtime.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

let client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!client) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

export type { SupabaseClient };
