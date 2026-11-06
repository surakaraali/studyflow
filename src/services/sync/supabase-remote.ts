import type { SupabaseClient } from '@supabase/supabase-js';

import type { Remote, RemoteResult, RemoteRow } from './types';

type PostgrestLike = { error: { message: string; code?: string } | null; status: number };

/**
 * PostgREST answers 401 when the JWT is missing, expired or invalid (PGRST301–PGRST303) and
 * 403 for a JWT it can't use; plain 403 (42501) is a row-level refusal of the data.
 */
export function isAuthFailure(response: PostgrestLike): boolean {
  if (!response.error) return false;
  if (response.status === 401) return true;
  if (response.status !== 403) return false;
  const { code = '', message } = response.error;
  return code.startsWith('PGRST30') || /\bjwt\b/i.test(message);
}

/**
 * Network errors come back with status 0. Those, timeouts, rate limits and 5xx are retried
 * later. Auth failures stop the run until the session is fixed (US-77); any other 4xx means
 * the server refuses this data.
 */
export function classify(response: PostgrestLike): RemoteResult {
  if (!response.error) return { ok: true };
  const { status } = response;
  const message = `${status} ${response.error.code ?? ''} ${response.error.message}`.trim();
  if (isAuthFailure(response)) return { ok: false, retryable: false, auth: true, message };
  const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
  return { ok: false, retryable, message };
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      return classify(await client.from(table).upsert(rows, { onConflict: 'id' }));
    },
    async insertMissing(table, rows) {
      return classify(await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
    },
    async softDelete(table, id, changes) {
      return classify(await client.from(table).update(changes).eq('id', id));
    },
    async pull(table, since, limit) {
      let query = client.from(table).select('*');
      if (since) query = query.gt('synced_at', since);
      const response = await query.order('synced_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
      const result = classify(response);
      if (!result.ok) return result;
      return { ok: true, rows: (response.data ?? []) as RemoteRow[] };
    },
  };
}
