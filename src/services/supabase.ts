import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { backendMode, config } from './config';

let client: SupabaseClient | null = null;

/** The Supabase client, or null in local mode. */
export function supabase(): SupabaseClient | null {
  if (backendMode !== 'supabase') return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // E-mail links come back through studyflow://auth/callback; PKCE keeps the code useless
        // without the verifier stored on this device.
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const sb = supabase();
  if (!sb) throw new Error('Supabase is not configured');
  return sb;
}
