/**
 * POST /functions/v1/telemetry   (ADR-006; US-06, OBS-01, OBS-04, PRIV-04, SEC-06)
 * Authorization: Bearer <user JWT>   (src/services/telemetry sends it; anonymous calls get 401)
 *
 * Body: { items: [...] }, at most 50 items and 64 KB.
 *   { type: 'event', name, props, app_version, platform, os_major }
 *   { type: 'crash', name, message, stack, fatal, app_version, platform, os_major }
 *
 * Events and props are checked against the server copy of the event dictionary
 * (_shared/telemetry.ts); unknown events and props are skipped, crash text is scrubbed again.
 * Nothing that identifies the caller is stored: the JWT only feeds the rate limit, whose key is
 * HMAC(TELEMETRY_HASH_SALT, user id + hour) and is deleted after 2 hours.
 *
 * 200 { ok: true, accepted, skipped }   401 unauthorized   413 too_large | too_many_items
 * 422 invalid_batch   429 rate_limited (300 items per user and hour)   500 not_configured
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, readJson, requireMethod } from '../_shared/http.ts';
import { withMetrics } from '../_shared/metrics.ts';
import { HOURLY_LIMIT, MAX_BODY_BYTES, parseBatch } from '../_shared/telemetry.ts';

const encoder = new TextEncoder();

/** Hex HMAC-SHA256 of "<user id>:<UTC hour>". A new hour gives an unrelated key. */
async function rateKey(salt: string, userId: string, now: Date): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const hour = now.toISOString().slice(0, 13);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${userId}:${hour}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(
  withMetrics('telemetry', async (req) => {
    try {
      requireMethod(req, 'POST');
      const user = await requireUser(req);
      const salt = Deno.env.get('TELEMETRY_HASH_SALT');
      if (!salt || salt.length < 16) throw new HttpError(500, 'not_configured');

      const batch = parseBatch(await readJson(req, MAX_BODY_BYTES));
      if (!batch.ok) throw new HttpError(batch.status, batch.code);

      const accepted = batch.events.length + batch.crashes.length;
      if (accepted === 0) return json({ ok: true, accepted: 0, skipped: batch.skipped });

      const { data, error } = await adminClient().rpc('telemetry_ingest', {
        p_rate_key: await rateKey(salt, user.id, new Date()),
        p_hourly_limit: HOURLY_LIMIT,
        p_events: batch.events,
        p_crashes: batch.crashes,
      });
      if (error) throw error;
      if ((data as { limited?: boolean } | null)?.limited) throw new HttpError(429, 'rate_limited');

      return json({ ok: true, accepted, skipped: batch.skipped });
    } catch (error) {
      return errorResponse(error);
    }
  }),
);
