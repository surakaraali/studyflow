import type { SupabaseClient } from '@supabase/supabase-js';

import type { Remote, RemoteResult, RemoteRow } from './types';

type PostgrestLike = { error: { message: string; code?: string } | null; status: number };

/**
 * Network errors come back with status 0. Those, auth (401, session refresh), timeouts, rate
 * limits and 5xx are retried later; any other 4xx means the server refuses this data.
 */
export function classify(response: PostgrestLike): RemoteResult {
  if (!response.error) return { ok: true };
  const { status } = response;
  const retryable = status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
  return { ok: false, retryable, message: `${status} ${response.error.code ?? ''} ${response.error.message}`.trim() };
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
