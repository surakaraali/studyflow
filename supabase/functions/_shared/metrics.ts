/**
 * Counts every Edge Function response per minute by status class (private.function_requests),
 * for the backend error-rate alert in ops-alerts (OBS-03). Only the function name and the status
 * class are stored. Counting is best effort and never changes the response.
 *
 *   Deno.serve(withMetrics('support', async (req) => { ... }));
 */

import { adminClient } from './admin.ts';

type Handler = (req: Request) => Response | Promise<Response>;
type EdgeRuntimeLike = { waitUntil(promise: Promise<unknown>): void };

function record(name: string, status: number) {
  const work = (async () => {
    try {
      const { error } = await adminClient().rpc('ops_record_request', { p_function: name, p_status: status });
      if (error) console.warn('[metrics] could not count the response', error.message);
    } catch (error) {
      console.warn('[metrics] could not count the response', error instanceof Error ? error.message : '');
    }
  })();
  // Lets the response go out first; the count finishes in the background.
  (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime?.waitUntil(work);
}

export function withMetrics(name: string, handler: Handler): (req: Request) => Promise<Response> {
  return async (req) => {
    let status = 500;
    try {
      const response = await handler(req);
      status = response.status;
      return response;
    } finally {
      // Browser preflights are not real calls.
      if (req.method !== 'OPTIONS') record(name, status);
    }
  };
}
