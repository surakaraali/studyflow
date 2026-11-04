/**
 * POST /functions/v1/support   (US-66, FR-ADM-01; also the public web form for account
 * deletion and parent/KVKK requests, US-13 / STORE-03)
 * Body (app, src/features/support/send.ts):
 *   { id, email, topic, message, app_version, os, os_version }
 * Body (web form): { email, topic: 'account_deletion' | 'privacy' | 'parent' | 'other', message }
 *
 * Stores a support ticket and e-mails the team (SUPPORT_TEAM_EMAIL) with Reply-To set to the
 * user's address. The only personal data asked for is the reply address (US-66); the app adds
 * its version automatically. The app's row id becomes the ticket id, so a retried call (or the
 * synced feedback copy) never creates a second ticket. Signed-in calls are linked to the account;
 * every address is limited to 5 tickets a day.
 *
 * 200 { ok: true, id }   422 { error: 'invalid_email' | 'invalid_message' }   429 { error: 'rate_limited' }
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { adminClient } from '../_shared/admin.ts';
import { optionalUser } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { supportTicketEmail } from '../_shared/email-templates.ts';
import { errorResponse, HttpError, json, normalizeEmail, readJson, requireMethod } from '../_shared/http.ts';

const TOPICS = ['account', 'subscription', 'ai', 'plan', 'bug', 'other', 'account_deletion', 'privacy', 'parent'] as const;
type Topic = (typeof TOPICS)[number];

const DAILY_LIMIT = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requireMethod(req, 'POST');
    const body = await readJson<{
      id: unknown;
      email: unknown;
      message: unknown;
      topic: unknown;
      app_version: unknown;
      os: unknown;
      os_version: unknown;
    }>(req);

    const user = await optionalUser(req);
    const email = normalizeEmail(body.email) ?? (user?.email ? normalizeEmail(user.email) : null);
    if (!email) throw new HttpError(422, 'invalid_email');

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 5 || message.length > 5000) throw new HttpError(422, 'invalid_message');

    const topic: Topic = TOPICS.includes(body.topic as Topic) ? (body.topic as Topic) : 'other';
    const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : crypto.randomUUID();

    const admin = adminClient();
    const { data: existing } = await admin.from('support_tickets').select('id').eq('id', id).maybeSingle();
    if (existing) return json({ ok: true, id, duplicate: true });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count ?? 0) >= DAILY_LIMIT) throw new HttpError(429, 'rate_limited');

    const ticket = {
      id,
      user_id: user?.id ?? null,
      email,
      topic,
      message,
      app_version: shortText(body.app_version, 40),
      platform: shortText(body.os, 20),
      os_version: shortText(body.os_version, 40),
    };
    const { error } = await admin.from('support_tickets').insert(ticket);
    if (error) throw error;

    const team = Deno.env.get('SUPPORT_TEAM_EMAIL');
    if (team) {
      await sendEmail(
        supportTicketEmail({
          to: team,
          replyTo: email,
          ticketId: id,
          topic,
          message,
          appVersion: ticket.app_version,
          platform: ticket.platform,
          osVersion: ticket.os_version,
          signedIn: user != null,
        }),
      ).catch((mailError) => console.error('support email failed', mailError instanceof Error ? mailError.message : ''));
    }

    return json({ ok: true, id });
  } catch (error) {
    return errorResponse(error);
  }
});
