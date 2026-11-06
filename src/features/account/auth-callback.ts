/**
 * US-71: reading the link from a verification, password-reset or email-change e-mail
 * (studyflow://auth/callback). Pure functions, unit tested.
 *
 * Supabase can send three shapes, depending on the client's flow type and the e-mail template:
 *   - PKCE:        ?code=<code>                      → exchangeCodeForSession
 *   - token hash:  ?token_hash=<hash>&type=<type>    → verifyOtp
 *   - implicit:    #access_token=…&refresh_token=…&type=<type> → setSession
 * A failed link comes back as ?error=…&error_code=otp_expired&error_description=…
 * (query or fragment). With "secure email change" the first of the two links only says
 * "now confirm the other address" in a `message` parameter.
 */

export type CallbackType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

const TYPES: readonly CallbackType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export type CallbackErrorReason = 'expired' | 'invalid' | 'other_device';

export type AuthCallback =
  | { kind: 'code'; code: string; type: CallbackType | null }
  | { kind: 'token_hash'; tokenHash: string; type: CallbackType }
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: CallbackType | null }
  | { kind: 'error'; reason: CallbackErrorReason }
  | { kind: 'message' }
  | { kind: 'empty' };

type Params = Record<string, string | string[] | undefined>;

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** "a=1&b=2" → { a: '1', b: '2' }. The first value of a repeated key wins. */
export function parseParamString(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split('&')) {
    if (!part) continue;
    const index = part.indexOf('=');
    const key = decode(index >= 0 ? part.slice(0, index) : part);
    const value = decode(index >= 0 ? part.slice(index + 1) : '');
    if (key && !(key in out)) out[key] = value;
  }
  return out;
}

/** Query and fragment parameters of a URL, without relying on the URL global. */
export function urlParams(url: string): { query: Record<string, string>; fragment: Record<string, string> } {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  return { query: parseParamString(query), fragment: parseParamString(fragment) };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asType(value: string | undefined): CallbackType | null {
  return value && (TYPES as readonly string[]).includes(value) ? (value as CallbackType) : null;
}

/** Maps Supabase error codes/messages from the link or from the exchange call. */
export function callbackErrorReason(code?: string | null, message?: string | null): CallbackErrorReason {
  const c = (code ?? '').toLowerCase();
  const m = (message ?? '').toLowerCase();
  if (c === 'pkce_code_verifier_not_found' || m.includes('code verifier')) return 'other_device';
  if (c === 'otp_expired' || c === 'flow_state_expired' || m.includes('expired')) return 'expired';
  return 'invalid';
}

const LINK_KEYS = ['code', 'token_hash', 'access_token', 'error', 'error_code', 'error_description', 'message'];

/**
 * Reads the callback from the router's params (expo-router puts the #fragment in params['#'])
 * and, only when those carry no link, from the linking URL. The router's params always belong
 * to this screen, while the linking URL can still be an older launch link; a URL that doesn't
 * point at auth/callback is never used.
 */
export function parseAuthCallback(url: string | null | undefined, routeParams: Params = {}): AuthCallback {
  const route: Record<string, string> = {};
  let routeFragment: Record<string, string> = {};
  for (const [key, value] of Object.entries(routeParams)) {
    const v = first(value);
    if (v == null) continue;
    if (key === '#') routeFragment = parseParamString(v);
    else route[key] = v;
  }
  // The fragment beats the query (implicit flow puts the tokens there).
  const fromRoute = { ...route, ...routeFragment };
  const fromUrl =
    !LINK_KEYS.some((key) => fromRoute[key]) && url && /auth\/callback/.test(url) ? urlParams(url) : null;
  const p: Record<string, string> = fromUrl ? { ...fromRoute, ...fromUrl.query, ...fromUrl.fragment } : fromRoute;
  const type = asType(p.type);

  if (p.error || p.error_code || p.error_description) {
    return { kind: 'error', reason: callbackErrorReason(p.error_code, p.error_description) };
  }
  if (p.code) return { kind: 'code', code: p.code, type };
  if (p.token_hash) {
    return type ? { kind: 'token_hash', tokenHash: p.token_hash, type } : { kind: 'error', reason: 'invalid' };
  }
  if (p.access_token && p.refresh_token) {
    return { kind: 'tokens', accessToken: p.access_token, refreshToken: p.refresh_token, type };
  }
  if (p.message) return { kind: 'message' };
  return { kind: 'empty' };
}

export type CallbackOutcome = 'recovery' | 'verified' | 'email_changed';

/**
 * What a successful link did. PKCE links carry no type, but the client remembers a password
 * reset (redirectType 'recovery'). Without a type, a link opened while signed in is an
 * email change; otherwise it confirms a new account.
 */
export function callbackOutcome(input: {
  type: CallbackType | null;
  redirectType?: string | null;
  appSignedIn: boolean;
}): CallbackOutcome {
  if (input.type === 'recovery' || input.redirectType === 'recovery') return 'recovery';
  if (input.type === 'email_change') return 'email_changed';
  if (input.type) return 'verified';
  return input.appSignedIn ? 'email_changed' : 'verified';
}
