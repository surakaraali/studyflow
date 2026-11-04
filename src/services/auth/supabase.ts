import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

import { requireSupabase } from '@/services/supabase';
import type { AuthAdapter, AuthError } from './types';

function mapError(error: SupabaseAuthError | Error | null): AuthError {
  if (!error) return 'unknown';
  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = error.message.toLowerCase();
  if (code === 'user_already_exists' || message.includes('already registered')) return 'email_exists';
  if (code === 'invalid_credentials' || message.includes('invalid login')) return 'invalid_credentials';
  if (code === 'email_not_confirmed') return 'email_not_verified';
  if (code === 'weak_password') return 'weak_password';
  if (code === 'email_address_invalid') return 'invalid_email';
  if (message.includes('network') || message.includes('fetch')) return 'network';
  return 'unknown';
}

const redirectTo = 'studyflow://auth/callback';

export const supabaseAuth: AuthAdapter = {
  async restore() {
    const { data } = await requireSupabase().auth.getSession();
    const user = data.session?.user;
    return user ? { id: user.id, email: user.email ?? null } : null;
  },

  async signUp(email, password) {
    const { data, error } = await requireSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return { ok: false, error: mapError(error) };
    // Supabase hides existing accounts by returning a user without identities.
    if (data.user && data.user.identities?.length === 0) return { ok: false, error: 'email_exists' };
    return { ok: true, needsVerification: !data.session };
  },

  async signIn(email, password) {
    const { data, error } = await requireSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) return { ok: false, error: mapError(error) };
    return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
  },

  async signInWithApple(identityToken) {
    const { data, error } = await requireSupabase().auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });
    if (error || !data.user) return { ok: false, error: mapError(error) };
    return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
  },

  async resendVerification(email) {
    const { error } = await requireSupabase().auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  async sendPasswordReset(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  async signOut() {
    await requireSupabase().auth.signOut();
  },

  async deleteAccount() {
    const { error } = await requireSupabase().functions.invoke('delete-account', { method: 'POST' });
    if (error) return { ok: false, error: mapError(error) };
    await requireSupabase().auth.signOut();
    return { ok: true };
  },
};
