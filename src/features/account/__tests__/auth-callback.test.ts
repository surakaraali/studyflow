import {
  callbackErrorReason,
  callbackOutcome,
  parseAuthCallback,
  parseParamString,
  urlParams,
} from '../auth-callback';

describe('urlParams', () => {
  it('splits query and fragment and decodes values', () => {
    expect(urlParams('studyflow://auth/callback?code=a%20b&x=1#type=recovery&y=c+d')).toEqual({
      query: { code: 'a b', x: '1' },
      fragment: { type: 'recovery', y: 'c d' },
    });
  });

  it('copes with a missing query, empty parts and bad escapes', () => {
    expect(urlParams('studyflow://auth/callback')).toEqual({ query: {}, fragment: {} });
    expect(parseParamString('&a=1&&b=%E0%A4%A&a=2')).toEqual({ a: '1', b: '%E0%A4%A' });
  });
});

describe('parseAuthCallback (US-71)', () => {
  it('reads a PKCE code from the URL', () => {
    expect(parseAuthCallback('studyflow://auth/callback?code=abc')).toEqual({
      kind: 'code',
      code: 'abc',
      type: null,
    });
  });

  it('falls back to router params when the URL is missing', () => {
    expect(parseAuthCallback(null, { code: ['abc', 'x'], type: 'signup' })).toEqual({
      kind: 'code',
      code: 'abc',
      type: 'signup',
    });
  });

  it("reads the fragment expo-router passes as params['#']", () => {
    expect(parseAuthCallback(null, { '#': 'access_token=at&refresh_token=rt&type=signup' })).toEqual({
      kind: 'tokens',
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'signup',
    });
  });

  it('prefers the router params over an older linking URL', () => {
    expect(parseAuthCallback('studyflow://auth/callback?code=old', { code: 'new' })).toEqual({
      kind: 'code',
      code: 'new',
      type: null,
    });
  });

  it('ignores a URL that is not the callback (an older launch link)', () => {
    expect(parseAuthCallback('studyflow://today?code=old', {})).toEqual({ kind: 'empty' });
  });

  it('reads implicit-flow tokens from the fragment', () => {
    const url =
      'studyflow://auth/callback#access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=recovery';
    expect(parseAuthCallback(url)).toEqual({
      kind: 'tokens',
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'recovery',
    });
  });

  it('reads a token hash link, which needs a type', () => {
    expect(parseAuthCallback('studyflow://auth/callback?token_hash=h&type=email_change')).toEqual({
      kind: 'token_hash',
      tokenHash: 'h',
      type: 'email_change',
    });
    expect(parseAuthCallback('studyflow://auth/callback?token_hash=h')).toEqual({
      kind: 'error',
      reason: 'invalid',
    });
  });

  it('Gherkin: an expired link becomes a clear "expired" error', () => {
    const url =
      'studyflow://auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallback(url)).toEqual({ kind: 'error', reason: 'expired' });
    expect(parseAuthCallback('studyflow://auth/callback?error=server_error')).toEqual({
      kind: 'error',
      reason: 'invalid',
    });
  });

  it('an error wins over a code', () => {
    expect(parseAuthCallback('studyflow://auth/callback?code=abc&error_code=otp_expired')).toEqual({
      kind: 'error',
      reason: 'expired',
    });
  });

  it('recognises the first link of a secure email change', () => {
    const url =
      'studyflow://auth/callback#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email';
    expect(parseAuthCallback(url)).toEqual({ kind: 'message' });
  });

  it('drops unknown types and returns empty with no parameters', () => {
    expect(parseAuthCallback('studyflow://auth/callback?code=abc&type=hack')).toEqual({
      kind: 'code',
      code: 'abc',
      type: null,
    });
    expect(parseAuthCallback('studyflow://auth/callback')).toEqual({ kind: 'empty' });
  });
});

describe('callbackErrorReason', () => {
  it('maps verifier, expiry and other errors', () => {
    expect(callbackErrorReason('pkce_code_verifier_not_found')).toBe('other_device');
    expect(callbackErrorReason(undefined, 'PKCE code verifier not found in storage.')).toBe('other_device');
    expect(callbackErrorReason('otp_expired')).toBe('expired');
    expect(callbackErrorReason('flow_state_expired')).toBe('expired');
    expect(callbackErrorReason('bad_code_verifier')).toBe('invalid');
    expect(callbackErrorReason(null, null)).toBe('invalid');
  });
});

describe('callbackOutcome', () => {
  it('a password reset opens the new password screen', () => {
    expect(callbackOutcome({ type: null, redirectType: 'recovery', appSignedIn: false })).toBe('recovery');
    expect(callbackOutcome({ type: 'recovery', appSignedIn: true })).toBe('recovery');
  });

  it('a typed link says what it confirmed', () => {
    expect(callbackOutcome({ type: 'signup', appSignedIn: false })).toBe('verified');
    expect(callbackOutcome({ type: 'email_change', appSignedIn: false })).toBe('email_changed');
  });

  it('without a type, signed in means an email change, signed out a new account', () => {
    expect(callbackOutcome({ type: null, redirectType: null, appSignedIn: true })).toBe('email_changed');
    expect(callbackOutcome({ type: null, redirectType: null, appSignedIn: false })).toBe('verified');
  });
});
