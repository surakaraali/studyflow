export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthError =
  | 'email_exists'
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'invalid_email'
  | 'weak_password'
  | 'same_password'
  | 'network'
  | 'cancelled'
  | 'unavailable'
  | 'unknown';

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: AuthError };
export type SignUpResult = { ok: true; needsVerification: boolean } | { ok: false; error: AuthError };
export type SimpleResult = { ok: true } | { ok: false; error: AuthError };
export type EmailChangeResult = { ok: true; needsVerification: boolean } | { ok: false; error: AuthError };

/** How this account can sign in. Apple-only accounts have no password or editable email. */
export type SignInMethods = { password: boolean; apple: boolean };

export type DeleteAccountOptions = {
  /**
   * A fresh Sign in with Apple authorization code. The server trades it for a refresh token
   * and revokes it at Apple (App Store rule 5.1.1(v)); Supabase doesn't keep Apple's tokens.
   */
  appleAuthorizationCode?: string | null;
};

export interface AuthAdapter {
  restore(): Promise<AuthUser | null>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  /** identityToken comes from expo-apple-authentication. */
  signInWithApple(identityToken: string, appleUser: string, email: string | null): Promise<AuthResult>;
  resendVerification(email: string): Promise<SimpleResult>;
  sendPasswordReset(email: string): Promise<SimpleResult>;
  signOut(): Promise<void>;
  /** Removes the account on the server (or device). Local data is removed by the caller. */
  deleteAccount(options?: DeleteAccountOptions): Promise<SimpleResult>;
  signInMethods(): Promise<SignInMethods>;
  /**
   * Sets a new password for the signed-in account (also right after a reset link).
   * `currentPassword` is passed along when the server can check it too.
   */
  updatePassword(newPassword: string, currentPassword?: string): Promise<SimpleResult>;
  /**
   * Starts an email change. Supabase keeps the old address until the link sent to the new
   * one (and, with secure email change, the old one) is opened; local mode changes it at once.
   */
  updateEmail(newEmail: string): Promise<EmailChangeResult>;
}
