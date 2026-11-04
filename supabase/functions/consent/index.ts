/**
 * Parent consent page API (public, no account; US-16, FR-CON-02, FR-CON-04, PRIV-06).
 * The link token from the e-mail is the only credential; it is compared by its SHA-256.
 *
 * GET  ?token=…  → what the page needs, nothing more:
 *   { state: 'pending' | 'granted' | 'revoked' | 'expired' | 'invalid', nickname, purposes,
 *     grantedPurposes, textVersion, expiresAt }
 * POST { token, action: 'grant' | 'revoke', purposes: ('ai' | 'notifications')[] }
 *   → appends a consent record, updates the student's consent_status, tells the student and
 *     e-mails the parent a confirmation with the "Onayımı geri al" link.
 *
 * A link can grant only within 7 days (BR-04). Once used, the same link keeps working for
 * changing the purposes or revoking, as long as it belongs to the parent the student named last.
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { adminClient, type SupabaseClient } from '../_shared/admin.ts';
import {
  ageFromBirthYear,
  type ConsentTokenRow,
  consentPageUrl,
  consentTextVersion,
  hashToken,
  parsePurposes,
  PURPOSES,
} from '../_shared/consent.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { consentDecisionEmail, PURPOSE_LABELS, type Purpose } from '../_shared/email-templates.ts';
import { clientIp, errorResponse, HttpError, json, readJson } from '../_shared/http.ts';
import { notifyStudent } from '../_shared/push.ts';

type Profile = {
  id: string;
  nickname: string | null;
  birth_year: number | null;
  consent_status: 'not_required' | 'pending' | 'granted' | 'revoked';
};

type Resolved =
  | { state: 'invalid' }
  | { state: 'expired'; token: ConsentTokenRow }
  | { state: 'usable'; token: ConsentTokenRow; profile: Profile };

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

async function resolve(admin: SupabaseClient, rawToken: unknown, now: Date): Promise<Resolved> {
  if (typeof rawToken !== 'string' || !TOKEN_RE.test(rawToken)) return { state: 'invalid' };
  const { data: token } = await admin
    .from('consent_tokens')
    .select('id, user_id, parent_email, source, created_at, expires_at, used_at, superseded_at')
    .eq('token_hash', await hashToken(rawToken))
    .maybeSingle<ConsentTokenRow>();
  if (!token) return { state: 'invalid' };

  const { data: profile } = await admin
    .from('profiles')
    .select('id, nickname, birth_year, consent_status')
    .eq('id', token.user_id)
    .maybeSingle<Profile>();
  if (!profile) return { state: 'invalid' };

  // Only the parent the student named last may decide. The latest link says who that is
  // (profiles.parent_email is editable by the device, consent_tokens is not).
  const { data: latest } = await admin
    .from('consent_tokens')
    .select('parent_email')
    .eq('user_id', token.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ parent_email: string }>();
  const sameParent = latest?.parent_email.toLowerCase() === token.parent_email.toLowerCase();

  if (token.used_at) {
    return sameParent ? { state: 'usable', token, profile } : { state: 'invalid' };
  }
  if (token.superseded_at || !sameParent) return { state: 'invalid' };
  if (new Date(token.expires_at).getTime() <= now.getTime()) return { state: 'expired', token };
  return { state: 'usable', token, profile };
}

async function latestPurposes(admin: SupabaseClient, userId: string): Promise<Purpose[]> {
  const { data } = await admin
    .from('consent_records')
    .select('action, purposes')
    .eq('user_id', userId)
    .in('action', ['granted', 'revoked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ action: string; purposes: unknown }>();
  if (!data || data.action !== 'granted') return [];
  return parsePurposes(data.purposes) ?? [];
}

function pageState(profile: Profile): 'pending' | 'granted' | 'revoked' {
  if (profile.consent_status === 'granted') return 'granted';
  if (profile.consent_status === 'revoked') return 'revoked';
  return 'pending';
}

const purposeList = PURPOSES.map((key) => ({ key, label: PURPOSE_LABELS[key] }));

async function handleGet(req: Request): Promise<Response> {
  const admin = adminClient();
  const token = new URL(req.url).searchParams.get('token');
  const result = await resolve(admin, token, new Date());
  const base = { purposes: purposeList, textVersion: consentTextVersion() };

  if (result.state === 'invalid') return json({ ...base, state: 'invalid' }, 404);
  if (result.state === 'expired') return json({ ...base, state: 'expired', expiresAt: result.token.expires_at }, 410);

  const { token: row, profile } = result;
  return json({
    ...base,
    state: pageState(profile),
    nickname: profile.nickname?.trim() || null,
    grantedPurposes: profile.consent_status === 'granted' ? await latestPurposes(admin, profile.id) : [],
    expiresAt: row.used_at ? null : row.expires_at,
  });
}

async function handlePost(req: Request): Promise<Response> {
  const body = await readJson<{ token: unknown; action: unknown; purposes: unknown }>(req);
  const action = body.action;
  if (action !== 'grant' && action !== 'revoke') throw new HttpError(422, 'invalid_action');

  let purposes: Purpose[];
  if (action === 'grant') {
    const parsed = parsePurposes(body.purposes ?? []);
    if (!parsed) throw new HttpError(422, 'invalid_purposes');
    purposes = parsed;
  } else {
    // Revoking withdraws every purpose.
    purposes = [...PURPOSES];
  }

  const admin = adminClient();
  const now = new Date();
  const result = await resolve(admin, body.token, now);
  if (result.state === 'invalid') throw new HttpError(404, 'invalid');
  if (result.state === 'expired') throw new HttpError(410, 'expired');
  const { token, profile } = result;

  // 1. The legal record first (append-only).
  const { error: recordError } = await admin.from('consent_records').insert({
    user_id: profile.id,
    parent_email: token.parent_email,
    action: action === 'grant' ? 'granted' : 'revoked',
    purposes,
    text_version: consentTextVersion(),
    ip: clientIp(req),
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300) || null,
    source: 'web',
  });
  if (recordError) throw recordError;

  // 2. The account state the app reads (access level, BR-02/BR-03).
  // Notifications the parent did not allow are switched off, like the app's local stand-in.
  const status = action === 'grant' ? 'granted' : 'revoked';
  const notificationsOff =
    action === 'grant' && !purposes.includes('notifications')
      ? { notif_plan: 0, notif_exam: 0, notif_homework: 0, notif_ai: 0 }
      : {};
  const { error: profileError } = await admin
    .from('profiles')
    .update({ consent_status: status, parent_email: token.parent_email, ...notificationsOff })
    .eq('id', profile.id);
  if (profileError) throw profileError;

  if (!token.used_at) {
    await admin.from('consent_tokens').update({ used_at: now.toISOString() }).eq('id', token.id);
  }

  // 3. Tell the student (US-16 "Velin onayladı"). Best effort.
  const age = ageFromBirthYear(profile.birth_year, now);
  const message =
    action === 'grant'
      ? {
          kind: 'consent' as const,
          title: 'Velin onayladı',
          body: purposes.includes('ai')
            ? "StudyFlow'un tüm özelliklerini artık kullanabilirsin."
            : 'Hesabın açıldı. Yapay zekâ özellikleri velin izin verene kadar kapalı.',
          url: '/',
        }
      : {
          kind: 'consent' as const,
          title: 'Velin onayını geri aldı',
          body: 'Yapay zekâ ve bildirim özellikleri kapandı. Velinle konuşabilirsin.',
          url: '/consent',
        };
  await notifyStudent(admin, profile.id, message, { age, now }).catch((error) =>
    console.error('notify failed', error instanceof Error ? error.message : ''),
  );

  // 4. Confirmation to the parent, with the link to change or revoke.
  const rawToken = body.token as string;
  await sendEmail(
    consentDecisionEmail({
      to: token.parent_email,
      nickname: profile.nickname,
      action: status,
      purposes,
      manageLink: consentPageUrl(rawToken),
    }),
  ).catch((error) => console.error('confirmation email failed', error instanceof Error ? error.message : ''));

  return json({ ok: true, state: status, grantedPurposes: action === 'grant' ? purposes : [] });
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
    if (req.method === 'GET') return await handleGet(req);
    if (req.method === 'POST') return await handlePost(req);
    throw new HttpError(405, 'method_not_allowed');
  } catch (error) {
    return errorResponse(error);
  }
});
