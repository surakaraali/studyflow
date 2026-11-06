import type { AuthError as SupabaseAuthError, User } from '@supabase/supabase-js';

import { requireSupabase } from '@/services/supabase';
import type { AuthAdapter, AuthError, SignInMethods } from './types';

function mapError(error: SupabaseAuthError | Error | null): AuthError {
  if (!error) return 'unknown';
  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = error.message.toLowerCase();
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return 'email_exists';
  }
  if (code === 'invalid_credentials' || message.includes('invalid login')) return 'invalid_credentials';
  if (code === 'email_not_confirmed') return 'email_not_verified';
  if (code === 'weak_password') return 'weak_password';
  if (code === 'same_password') return 'same_password';
  if (code === 'email_address_invalid') return 'invalid_email';
  // Secure password change wants a recent sign-in; the app re-checks the password first,
  // so this only happens when that check was skipped.
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return 'invalid_credentials';
  if (message.includes('network') || message.includes('fetch')) return 'network';
  return 'unknown';
}

/** Every e-mail link (verify, reset, email change) comes back here: src/app/auth/callback.tsx. */
export const AUTH_REDIRECT_URL = 'studyflow://auth/callback';

function methodsOf(user: User | null | undefined): SignInMethods {
  const fromMetadata = user?.app_metadata?.providers;
  const providers: string[] = Array.isArray(fromMetadata)
    ? fromMetadata.map(String)
    : (user?.identities ?? []).map((identity) => identity.provider);
  return { password: providers.includes('email'), apple: providers.includes('apple') };
}

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
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
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
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  async sendPasswordReset(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: AUTH_REDIRECT_URL,
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  async signOut() {
    await requireSupabase().auth.signOut();
  },

  async deleteAccount(options = {}) {
    const { error } = await requireSupabase().functions.invoke('delete-account', {
      method: 'POST',
      body: options.appleAuthorizationCode ? { appleAuthorizationCode: options.appleAuthorizationCode } : {},
    });
    if (error) return { ok: false, error: mapError(error) };
    await requireSupabase().auth.signOut();
    return { ok: true };
  },

  async signInMethods() {
    const sb = requireSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session?.user) return methodsOf(data.session.user);
    const { data: fresh } = await sb.auth.getUser();
    return methodsOf(fresh.user);
  },

  async updatePassword(newPassword, currentPassword) {
    const { error } = await requireSupabase().auth.updateUser(
      currentPassword ? { password: newPassword, current_password: currentPassword } : { password: newPassword },
    );
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  async updateEmail(newEmail) {
    const { data, error } = await requireSupabase().auth.updateUser(
      { email: newEmail.trim().toLowerCase() },
      { emailRedirectTo: AUTH_REDIRECT_URL },
    );
    if (error) return { ok: false, error: mapError(error) };
    // Until the link is opened the new address waits in `new_email` and `email` is unchanged.
    return { ok: true, needsVerification: data.user?.email?.toLowerCase() !== newEmail.trim().toLowerCase() };
  },
};
