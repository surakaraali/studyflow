import { aiGate } from '../gate';
import { canRetry, displayStatus, estimatedProgress } from '../status';

const accepted = { consent_status: 'granted' as const, ai_notice_accepted_at: '2026-11-01T10:00:00.000Z' };
const room = { used: 1, limit: 3, full: false };
const on = { allowed: true, reason: null };

describe('aiGate', () => {
  it('turns AI off without full access and says why (BR-03, BR-16)', () => {
    const off = { allowed: false, reason: 'consent' as const };
    expect(aiGate({ ...accepted, consent_status: 'pending' }, off, room)).toEqual({ kind: 'consent', reason: 'pending' });
    expect(aiGate({ ...accepted, consent_status: 'revoked' }, off, room)).toEqual({ kind: 'consent', reason: 'revoked' });
  });

  it('turns AI off when the parent left the AI purpose unticked (US-16)', () => {
    expect(aiGate(accepted, { allowed: false, reason: 'purpose' }, room)).toEqual({ kind: 'consent', reason: 'purpose' });
  });

  it('asks for the AI notice before the first upload (US-18)', () => {
    expect(aiGate({ ...accepted, ai_notice_accepted_at: null }, on, room)).toEqual({ kind: 'notice' });
  });

  it('stops at the monthly quota (BR-14)', () => {
    expect(aiGate(accepted, on, { used: 3, limit: 3, full: true })).toEqual({ kind: 'quota', used: 3, limit: 3 });
  });

  it('lets the upload through otherwise', () => {
    expect(aiGate(accepted, on, room)).toEqual({ kind: 'ok' });
  });
});

describe('displayStatus', () => {
  const doc = { status: 'queued' as const, error_code: null, next_attempt_at: null };

  it('maps job states to what the student sees', () => {
    expect(displayStatus(doc, true)).toBe('queued');
    expect(displayStatus({ ...doc, status: 'processing' }, true)).toBe('processing');
    expect(displayStatus({ ...doc, error_code: 'network', next_attempt_at: '2026-11-04T10:00:00Z' }, true)).toBe('retrying');
    expect(displayStatus({ ...doc, status: 'ready' }, true)).toBe('ready');
    expect(displayStatus({ ...doc, status: 'error' }, true)).toBe('error');
  });

  it('shows waiting while AI is off', () => {
    expect(displayStatus(doc, false)).toBe('waiting');
    expect(displayStatus({ ...doc, status: 'ready' }, false)).toBe('ready');
  });
});

describe('canRetry', () => {
  it('allows a retry for passing problems but not for unsuitable or missing files', () => {
    expect(canRetry({ status: 'error', error_code: 'provider_unavailable' })).toBe(true);
    expect(canRetry({ status: 'error', error_code: 'expired' })).toBe(true);
    expect(canRetry({ status: 'error', error_code: 'inappropriate' })).toBe(false);
    expect(canRetry({ status: 'error', error_code: 'file_missing' })).toBe(false);
    expect(canRetry({ status: 'ready', error_code: null })).toBe(false);
  });
});

describe('estimatedProgress', () => {
  it('grows over time but never claims to be done', () => {
    const early = estimatedProgress(5_000, 20);
    const late = estimatedProgress(600_000, 20);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThanOrEqual(0.95);
    expect(estimatedProgress(-10, 20)).toBe(0);
  });
});
