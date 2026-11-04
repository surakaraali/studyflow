/**
 * POST /functions/v1/consent-request   (signed-in student; FR-CON-02, US-16, US-17)
 * Body: { parentEmail: string }
 *
 * Sends the parent a consent link. The link token is random; only its SHA-256 is stored and it
 * expires after 7 days (BR-04). The first link is free; after that 3 sends per Türkiye day (US-17,
 * same rule as resendsLeft in src/features/consent/logic.ts).
 *
 * 200 { ok: true, expiresAt, resendsLeft }
 * 4xx { error: 'invalid_email' | 'same_email' | 'not_required' | 'already_granted' | 'rate_limited' | 'unauthorized' }
 * 502 { error: 'email_failed' }
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  ageFromBirthYear,
  CONSENT_RESENDS_PER_DAY,
  consentPageUrl,
  istanbulDayStart,
  issueConsentToken,
} from '../_shared/consent.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { consentRequestEmail } from '../_shared/email-templates.ts';
import { errorResponse, HttpError, json, maskEmail, normalizeEmail, readJson, requireMethod } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requireMethod(req, 'POST');
    const user = await requireUser(req);
    const body = await readJson<{ parentEmail: unknown }>(req);

    const parentEmail = normalizeEmail(body.parentEmail);
    if (!parentEmail) throw new HttpError(422, 'invalid_email');
    if (user.email && parentEmail === user.email.trim().toLowerCase()) throw new HttpError(422, 'same_email');

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('nickname, birth_year, consent_status')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) throw new HttpError(404, 'profile_missing');

    const age = ageFromBirthYear(profile.birth_year as number | null);
    if (age != null && age >= 18) throw new HttpError(409, 'not_required');
    if (profile.consent_status === 'granted') throw new HttpError(409, 'already_granted');

    // US-17: the very first link does not count; then 3 sends per day.
    const now = new Date();
    const dayStart = istanbulDayStart(now);
    const { data: sent, error: sentError } = await admin
      .from('consent_tokens')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('source', 'student')
      .order('created_at', { ascending: true });
    if (sentError) throw sentError;
    const times = (sent ?? []).map((row) => new Date(row.created_at as string));
    const resendsToday = times.slice(1).filter((t) => t >= dayStart).length;
    if (times.length > 0 && resendsToday >= CONSENT_RESENDS_PER_DAY) throw new HttpError(429, 'rate_limited');

    const { token, id, expiresAt } = await issueConsentToken(admin, {
      userId: user.id,
      parentEmail,
      source: 'student',
      now,
    });

    try {
      await sendEmail(
        consentRequestEmail({
          to: parentEmail,
          nickname: (profile.nickname as string | null) ?? null,
          link: consentPageUrl(token),
          expiresAt,
          under13: age != null && age < 13,
        }),
      );
    } catch (error) {
      // Give the attempt back: the parent never got this link.
      await admin.from('consent_tokens').delete().eq('id', id);
      console.error('consent email failed', maskEmail(parentEmail), error instanceof Error ? error.message : '');
      throw new HttpError(502, 'email_failed');
    }

    // The account waits for this parent now. Server writes move updated_at forward, so
    // the device takes the new parent_email/consent_status on its next pull.
    const { error: updateError } = await admin
      .from('profiles')
      .update({ parent_email: parentEmail, consent_status: 'pending' })
      .eq('id', user.id);
    if (updateError) throw updateError;

    // The app appends the 'requested' consent record itself (src/features/consent/service.ts).

    const used = times.length === 0 ? 0 : resendsToday + 1;
    return json({
      ok: true,
      expiresAt: expiresAt.toISOString(),
      resendsLeft: Math.max(0, CONSENT_RESENDS_PER_DAY - used),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
