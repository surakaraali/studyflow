/**
 * US-71: turns an e-mail link (studyflow://auth/callback) into a Supabase session and says
 * what the link did. The callback screen shows the result; nothing here navigates.
 */

import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';
import { useSession } from '@/stores/session';

import { setAccountNotice } from './account-notice';
import {
  callbackErrorReason,
  callbackOutcome,
  type AuthCallback,
  type CallbackErrorReason,
  type CallbackType,
} from './auth-callback';
import { applyEmailLocally, signOut } from './service';

export type CallbackResult =
  /** Local mode has no e-mail links. */
  | { kind: 'local' }
  | { kind: 'recovery' }
  /** `hasSession`: the link signed this device in, so "Devam et" can open the app. */
  | { kind: 'verified'; hasSession: boolean }
  | { kind: 'email_changed'; hasSession: boolean }
  /** Secure email change: the other address has its own link to open. */
  | { kind: 'confirm_other' }
  /** The link was for another account than the one signed in here; we signed out. */
  | { kind: 'other_account' }
  | { kind: 'error'; reason: CallbackErrorReason };

type Exchanged = { session: Session | null; type: CallbackType | null; redirectType: string | null };

async function exchange(link: AuthCallback & { kind: 'code' | 'token_hash' | 'tokens' }): Promise<
  { ok: true; value: Exchanged } | { ok: false; reason: CallbackErrorReason }
> {
  const sb = supabase();
  if (!sb) return { ok: false, reason: 'invalid' };

  if (link.kind === 'code') {
    const { data, error } = await sb.auth.exchangeCodeForSession(link.code);
    if (error) return { ok: false, reason: callbackErrorReason(error.code, error.message) };
    // auth-js returns redirectType ('recovery' for a reset) but its types leave it out.
    const redirectType = (data as { redirectType?: string | null }).redirectType ?? null;
    return { ok: true, value: { session: data.session, type: link.type, redirectType } };
  }
  if (link.kind === 'token_hash') {
    const { data, error } = await sb.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
    if (error) return { ok: false, reason: callbackErrorReason(error.code, error.message) };
    return { ok: true, value: { session: data.session, type: link.type, redirectType: null } };
  }
  const { data, error } = await sb.auth.setSession({
    access_token: link.accessToken,
    refresh_token: link.refreshToken,
  });
  if (error) return { ok: false, reason: callbackErrorReason(error.code, error.message) };
  return { ok: true, value: { session: data.session, type: link.type, redirectType: null } };
}

export async function handleAuthCallback(link: AuthCallback): Promise<CallbackResult> {
  if (!supabase()) return { kind: 'local' };
  if (link.kind === 'error') return link;
  if (link.kind === 'empty') return { kind: 'error', reason: 'invalid' };
  if (link.kind === 'message') return { kind: 'confirm_other' };

  let result: Awaited<ReturnType<typeof exchange>>;
  try {
    result = await exchange(link);
  } catch (error) {
    console.warn('Auth link could not be used', error);
    return { kind: 'error', reason: 'invalid' };
  }
  if (!result.ok) return { kind: 'error', reason: result.reason };

  const { session, type, redirectType } = result.value;
  const app = useSession.getState();
  const appSignedIn = app.status === 'signedIn';
  const linkUser = session?.user ?? null;

  // Never mix two accounts on one device: the link replaced the signed-in account's session.
  if (appSignedIn && linkUser && app.user && linkUser.id !== app.user.id) {
    setAccountNotice('link_other_account');
    await signOut().catch(() => undefined);
    return { kind: 'other_account' };
  }

  const outcome = callbackOutcome({ type, redirectType, appSignedIn });
  if (outcome === 'recovery') {
    return session ? { kind: 'recovery' } : { kind: 'error', reason: 'invalid' };
  }
  if (outcome === 'email_changed') {
    if (!session) return { kind: 'confirm_other' };
    if (appSignedIn && linkUser?.email) await applyEmailLocally(linkUser.email.toLowerCase());
    return { kind: 'email_changed', hasSession: true };
  }
  return { kind: 'verified', hasSession: session != null };
}
