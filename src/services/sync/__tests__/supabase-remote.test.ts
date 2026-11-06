import { classify, isAuthFailure } from '../supabase-remote';

function response(status: number, code?: string, message = 'failed') {
  return { status, error: { code, message } };
}

describe('classify (US-77)', () => {
  it('passes a successful response', () => {
    expect(classify({ status: 201, error: null })).toEqual({ ok: true });
  });

  it('treats 401 as a session problem that is not retried', () => {
    const result = classify(response(401, 'PGRST303', 'JWT expired'));
    expect(result).toMatchObject({ ok: false, retryable: false, auth: true });
    expect(result.ok ? '' : result.message).toBe('401 PGRST303 JWT expired');
  });

  it('treats a 403 about the JWT as a session problem', () => {
    expect(isAuthFailure(response(403, 'PGRST301', 'Expected 3 parts in JWT; got 1'))).toBe(true);
    expect(isAuthFailure(response(403, undefined, 'invalid JWT'))).toBe(true);
    expect(classify(response(403, '', 'Invalid JWT'))).toMatchObject({ auth: true, retryable: false });
  });

  it('treats a row-level 403 as refused data, not a session problem', () => {
    const result = classify(response(403, '42501', 'new row violates row-level security policy'));
    expect(result).toEqual({
      ok: false,
      retryable: false,
      message: '403 42501 new row violates row-level security policy',
    });
  });

  it('retries network errors, timeouts, rate limits and server errors', () => {
    for (const status of [0, 408, 429, 500, 503]) {
      expect(classify(response(status))).toMatchObject({ ok: false, retryable: true });
      expect(isAuthFailure(response(status))).toBe(false);
    }
  });

  it('does not retry other client errors', () => {
    expect(classify(response(400, '23514', 'check violation'))).toMatchObject({ ok: false, retryable: false });
    expect(classify(response(409, '23505', 'duplicate key'))).not.toHaveProperty('auth');
  });
});
