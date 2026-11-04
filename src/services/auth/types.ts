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
  | 'network'
  | 'cancelled'
  | 'unavailable'
  | 'unknown';

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: AuthError };
export type SignUpResult = { ok: true; needsVerification: boolean } | { ok: false; error: AuthError };
export type SimpleResult = { ok: true } | { ok: false; error: AuthError };

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
  deleteAccount(): Promise<SimpleResult>;
}
