import { CONSENT_RESENDS_PER_DAY } from '@/domain/rules';

import {
  consentDeadlinePassed,
  daysUntilConsentDeadline,
  grantedPurposes,
  isRequestExpired,
  latestDecisionDeniesAi,
  linkExpiresAt,
  parsePurposes,
  resendsLeft,
} from '../logic';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('consent link expiry (BR-04)', () => {
  it('lives for 7 days', () => {
    const created = new Date(2026, 10, 1, 9);
    const expires = linkExpiresAt(created);
    expect(expires.getTime() - created.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    const request = { expires_at: expires.toISOString() };
    expect(isRequestExpired(request, new Date(2026, 10, 8, 8))).toBe(false);
    expect(isRequestExpired(request, new Date(2026, 10, 8, 10))).toBe(true);
  });
});

describe('resendsLeft (US-17)', () => {
  const now = new Date(2026, 10, 4, 18);

  it('gives the full allowance before anything was sent', () => {
    expect(resendsLeft([], now)).toBe(CONSENT_RESENDS_PER_DAY);
  });

  it('does not count the first link from onboarding', () => {
    expect(resendsLeft([at(2026, 11, 4, 9)], now)).toBe(3);
  });

  it('counts today’s resends only', () => {
    const sent = [at(2026, 11, 1), at(2026, 11, 3), at(2026, 11, 3), at(2026, 11, 4, 10)];
    expect(resendsLeft(sent, now)).toBe(2);
  });

  it('stops at three a day', () => {
    const sent = [at(2026, 11, 4, 8), at(2026, 11, 4, 9), at(2026, 11, 4, 10), at(2026, 11, 4, 11)];
    expect(resendsLeft(sent, now)).toBe(0);
    expect(resendsLeft([...sent, at(2026, 11, 4, 12)], now)).toBe(0);
    // A new day brings the allowance back.
    expect(resendsLeft(sent, new Date(2026, 10, 5, 8))).toBe(3);
  });
});

describe('under-13 deadline (BR-04)', () => {
  const created = new Date(2026, 9, 1, 12).toISOString();

  it('passes 30 days after the account was created', () => {
    expect(consentDeadlinePassed(created, new Date(2026, 9, 31, 11))).toBe(false);
    expect(consentDeadlinePassed(created, new Date(2026, 9, 31, 12))).toBe(true);
  });

  it('counts the days left', () => {
    expect(daysUntilConsentDeadline(created, new Date(2026, 9, 1, 12))).toBe(30);
    expect(daysUntilConsentDeadline(created, new Date(2026, 9, 25, 13))).toBe(6);
    expect(daysUntilConsentDeadline(created, new Date(2026, 10, 30))).toBe(0);
  });
});

describe('purposes', () => {
  it('parses only known purposes', () => {
    expect(parsePurposes('["ai","notifications","ads"]')).toEqual(['ai', 'notifications']);
    expect(parsePurposes('not json')).toEqual([]);
    expect(parsePurposes(null)).toEqual([]);
  });

  it('follows the latest decision', () => {
    const records = [
      { action: 'requested' as const, purposes: '[]', created_at: '2026-11-01T10:00:00.000Z' },
      { action: 'granted' as const, purposes: '["ai","notifications"]', created_at: '2026-11-02T10:00:00.000Z' },
    ];
    expect(grantedPurposes(records)).toEqual(['ai', 'notifications']);
    const revoked = [...records, { action: 'revoked' as const, purposes: '[]', created_at: '2026-11-03T10:00:00.000Z' }];
    expect(grantedPurposes(revoked)).toEqual([]);
    const regranted = [
      ...revoked,
      { action: 'granted' as const, purposes: '["notifications"]', created_at: '2026-11-04T10:00:00.000Z' },
    ];
    expect(grantedPurposes(regranted)).toEqual(['notifications']);
  });

  it('denies AI only when the latest grant leaves it out', () => {
    expect(latestDecisionDeniesAi([])).toBe(false);
    const grantAll = { action: 'granted' as const, purposes: '["ai"]', created_at: '2026-11-02T10:00:00.000Z' };
    const grantNotifications = { action: 'granted' as const, purposes: '["notifications"]', created_at: '2026-11-03T10:00:00.000Z' };
    expect(latestDecisionDeniesAi([grantAll])).toBe(false);
    expect(latestDecisionDeniesAi([grantAll, grantNotifications])).toBe(true);
    expect(latestDecisionDeniesAi([grantNotifications, grantAll])).toBe(true);
  });
});
