/**
 * POST /functions/v1/delete-account   (signed-in user; US-13, US-72, FR-ACC-06, BR-18, STORE-03)
 *
 * Body (optional): { appleAuthorizationCode?: string } — a fresh Sign in with Apple code the
 * app gets when an Apple account confirms deletion. It is traded for a token and revoked at
 * Apple first (App Store 5.1.1(v)); see ./apple.ts for why Supabase has no stored token.
 *
 * Then removes the caller's documents from Storage immediately and deletes the auth user, which
 * cascades to every table. Consent and payment records are copied to server-only retention
 * tables by a database trigger first — see _shared/account.ts for why we copy instead of
 * anonymising. Finally the user gets a "Hesabın silindi" e-mail.
 * The app (src/services/auth/supabase.ts) signs out and removes the device database afterwards.
 *
 * An active store subscription is not cancelled by this; the app tells the user how to cancel
 * it in App Store settings before calling this function.
 *
 * 200 { ok: true, appleRevoked: boolean }   401 { error: 'unauthorized' }   500 { error: 'internal' }
 */

import 'jsr:@supabase/functions-js@2.118.0/edge-runtime.d.ts';

import { deleteAccountCompletely } from '../_shared/account.ts';
import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { accountDeletedEmail } from '../_shared/email-templates.ts';
import { errorResponse, json, readJson, requireMethod } from '../_shared/http.ts';
import { revokeAppleSignIn, type RevokeResult } from './apple.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requireMethod(req, 'POST');
    const user = await requireUser(req);
    const email = user.email ?? null;

    type Body = { appleAuthorizationCode: unknown };
    // An empty or unreadable body is fine: only Apple accounts send a code.
    const body: Partial<Body> = await readJson<Body>(req).catch(() => ({}));
    const code = typeof body.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode : null;

    // Deletion goes ahead whatever Apple says; a skipped revoke is logged for follow-up.
    let apple: RevokeResult;
    try {
      apple = await revokeAppleSignIn(user, code);
    } catch (error) {
      console.error('apple revoke error', error instanceof Error ? error.message : '');
      apple = 'failed';
    }
    if (apple !== 'not_apple' && apple !== 'revoked') console.warn('apple revoke skipped', apple);

    await deleteAccountCompletely(adminClient(), user.id);

    if (email) {
      await sendEmail(accountDeletedEmail({ to: email, reason: 'user' })).catch((error) =>
        console.error('deletion email failed', error instanceof Error ? error.message : ''),
      );
    }
    return json({ ok: true, appleRevoked: apple === 'revoked' });
  } catch (error) {
    return errorResponse(error);
  }
});
