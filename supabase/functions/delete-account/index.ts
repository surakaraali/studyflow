/**
 * POST /functions/v1/delete-account   (signed-in user; US-13, FR-ACC-06, BR-18, STORE-03)
 *
 * Removes the caller's documents from Storage immediately, then deletes the auth user, which
 * cascades to every table. Consent and payment records are copied to server-only retention
 * tables by a database trigger first — see _shared/account.ts for why we copy instead of
 * anonymising. Finally the user gets a "Hesabın silindi" e-mail.
 * The app (src/services/auth/supabase.ts) signs out and removes the device database afterwards.
 *
 * An active store subscription is not cancelled by this; the app tells the user how to cancel
 * it in App Store settings before calling this function.
 *
 * 200 { ok: true }   401 { error: 'unauthorized' }   500 { error: 'internal' }
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { deleteAccountCompletely } from '../_shared/account.ts';
import { adminClient } from '../_shared/admin.ts';
import { requireUser } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';
import { accountDeletedEmail } from '../_shared/email-templates.ts';
import { errorResponse, json, requireMethod } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requireMethod(req, 'POST');
    const user = await requireUser(req);
    const email = user.email ?? null;

    await deleteAccountCompletely(adminClient(), user.id);

    if (email) {
      await sendEmail(accountDeletedEmail({ to: email, reason: 'user' })).catch((error) =>
        console.error('deletion email failed', error instanceof Error ? error.message : ''),
      );
    }
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
