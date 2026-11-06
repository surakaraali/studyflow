/**
 * Sign in with Apple revocation on account deletion (US-72, App Store Review Guideline 5.1.1(v)).
 *
 * Apple's POST https://appleid.apple.com/auth/revoke needs
 *   - client_id: the app's bundle id (native sign-in codes are issued to it),
 *   - client_secret: an ES256 JWT signed with the team's Sign in with Apple key (.p8),
 *   - token + token_type_hint: a refresh or access token Apple issued to this app.
 *
 * Why the app sends an authorization code: the app signs in natively (expo-apple-authentication
 * → supabase.auth.signInWithIdToken), and Supabase Auth only verifies Apple's identity token. It
 * never receives or stores an Apple refresh token for that flow (provider tokens are only
 * returned once, to the client, for web OAuth, and are not kept in auth.identities). So there
 * is no stored token to revoke. Instead the app asks Apple for a fresh authorization code when
 * the student confirms deletion; we trade it at /auth/token for a refresh token (codes are
 * single-use and valid for 5 minutes) and revoke that.
 *
 * Edge Function secrets:
 *   APPLE_TEAM_ID      Apple Developer team id
 *   APPLE_KEY_ID       id of the Sign in with Apple key
 *   APPLE_PRIVATE_KEY  contents of the .p8 file (PEM; literal "\n" escapes are accepted)
 *   APPLE_CLIENT_ID    the iOS bundle id, com.cobanov.studyflow
 * Without them, or without a code, the account is still deleted and the skip is logged:
 * deletion must never depend on Apple being reachable.
 */

import type { User } from 'npm:@supabase/supabase-js@2.118.0';

const APPLE = 'https://appleid.apple.com';

export type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };

export type RevokeResult = 'revoked' | 'not_apple' | 'not_configured' | 'no_code' | 'wrong_account' | 'failed';

export function appleConfig(): AppleConfig | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  return teamId && keyId && privateKey && clientId ? { teamId, keyId, privateKey, clientId } : null;
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return atob(padded);
}

async function signingKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** The client secret Apple expects: ES256 JWT, short-lived (Apple allows up to 6 months). */
export async function appleClientSecret(config: AppleConfig, now: number = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = { iss: config.teamId, iat, exp: iat + 300, aud: APPLE, sub: config.clientId };
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // WebCrypto returns the raw r||s signature, which is the JWS ES256 format.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey(config.privateKey),
    new TextEncoder().encode(input),
  );
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

/** True when the account has a Sign in with Apple identity. */
export function usesApple(user: User): boolean {
  if (user.identities?.some((identity) => identity.provider === 'apple')) return true;
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes('apple');
}

/** Apple's user id ("sub") that Supabase stored with the identity, when it is there. */
function appleSubject(user: User): string | null {
  const identity = user.identities?.find((item) => item.provider === 'apple');
  const sub = identity?.identity_data?.sub ?? identity?.id;
  return typeof sub === 'string' && sub ? sub : null;
}

function jwtSubject(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(base64urlDecode(token.split('.')[1] ?? '')) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

async function postForm(url: string, fields: Record<string, string>, fetcher: typeof fetch): Promise<Response> {
  return await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
}

/** Trades the app's fresh authorization code for a token and revokes it at Apple. */
export async function revokeAppleSignIn(
  user: User,
  authorizationCode: string | null,
  fetcher: typeof fetch = fetch,
): Promise<RevokeResult> {
  if (!usesApple(user)) return 'not_apple';
  const config = appleConfig();
  if (!config) return 'not_configured';
  if (!authorizationCode) return 'no_code';

  const clientSecret = await appleClientSecret(config);
  const tokenResponse = await postForm(
    `${APPLE}/auth/token`,
    { client_id: config.clientId, client_secret: clientSecret, code: authorizationCode, grant_type: 'authorization_code' },
    fetcher,
  );
  if (!tokenResponse.ok) {
    console.error('apple token exchange failed', tokenResponse.status);
    return 'failed';
  }
  const tokens = (await tokenResponse.json()) as { refresh_token?: string; access_token?: string; id_token?: string };

  // The code must belong to this account's Apple ID: never revoke someone else's sign-in.
  // (The id_token comes straight from Apple over TLS, so reading its claims is enough here.)
  const expected = appleSubject(user);
  if (expected && jwtSubject(tokens.id_token) !== expected) return 'wrong_account';

  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) return 'failed';
  const revokeResponse = await postForm(
    `${APPLE}/auth/revoke`,
    {
      client_id: config.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
    },
    fetcher,
  );
  if (!revokeResponse.ok) {
    console.error('apple revoke failed', revokeResponse.status);
    return 'failed';
  }
  return 'revoked';
}
