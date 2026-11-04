/**
 * CORS for functions that a browser calls (the parent consent page lives on its own origin).
 * Set CORS_ALLOWED_ORIGIN to the consent page origin in staging/prod; '*' is the fallback
 * because these endpoints use no cookies.
 */

const allowedOrigin = Deno.env.get('CORS_ALLOWED_ORIGIN') ?? '*';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

/** Answers the browser's preflight request; returns null for every other method. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders });
}
