import type { ConsentRecord } from '@/db/types';

import {
  latestConsentDecision,
  notificationBlockReason,
  notificationsAllowed,
} from '../rules';

const NOW = new Date(2026, 10, 5, 12, 0);

function student(birthYear: number | null, consent: 'not_required' | 'pending' | 'granted' | 'revoked') {
  return { birth_year: birthYear, consent_status: consent };
}

function record(
  action: ConsentRecord['action'],
  purposes: string[],
  createdAt: string,
): Pick<ConsentRecord, 'action' | 'purposes' | 'created_at'> {
  return { action, purposes: JSON.stringify(purposes), created_at: createdAt };
}

const grantedBoth = record('granted', ['ai', 'notifications'], '2026-11-02T10:00:00.000Z');
const grantedAiOnly = record('granted', ['ai'], '2026-11-02T10:00:00.000Z');

describe('notificationsAllowed (US-76)', () => {
  it('lets adults get notifications without any consent record', () => {
    expect(notificationsAllowed(student(2000, 'not_required'), null, NOW)).toBe(true);
    expect(notificationBlockReason(student(2008, 'pending'), null, NOW)).toBeNull(); // turns 18 this year
  });

  it('does not limit an account before onboarding (no birth year yet)', () => {
    expect(notificationsAllowed(student(null, 'not_required'), null, NOW)).toBe(true);
  });

  it('blocks a 13–17 student while consent is pending', () => {
    expect(notificationsAllowed(student(2011, 'pending'), null, NOW)).toBe(false);
    expect(notificationBlockReason(student(2011, 'pending'), null, NOW)).toBe('consent');
  });

  it('blocks after the parent revoked consent', () => {
    const revoked = record('revoked', [], '2026-11-03T10:00:00.000Z');
    expect(notificationBlockReason(student(2011, 'revoked'), revoked, NOW)).toBe('consent');
  });

  it('allows when the parent granted the notifications purpose', () => {
    expect(notificationsAllowed(student(2011, 'granted'), grantedBoth, NOW)).toBe(true);
    expect(notificationsAllowed(student(2016, 'granted'), grantedBoth, NOW)).toBe(true);
  });

  it('blocks when the parent approved the account but not notifications', () => {
    expect(notificationsAllowed(student(2011, 'granted'), grantedAiOnly, NOW)).toBe(false);
    expect(notificationBlockReason(student(2011, 'granted'), grantedAiOnly, NOW)).toBe('purpose');
  });

  it('waits for the grant record when only the status says granted', () => {
    expect(notificationBlockReason(student(2011, 'granted'), null, NOW)).toBe('consent');
  });

  it('trusts the status over an older grant on the device', () => {
    expect(notificationsAllowed(student(2011, 'pending'), grantedBoth, NOW)).toBe(false);
  });

  it('blocks when nobody is signed in', () => {
    expect(notificationsAllowed(null, grantedBoth, NOW)).toBe(false);
  });
});

describe('latestConsentDecision', () => {
  it('picks the latest grant or revoke and ignores requests, in any order', () => {
    const requested = record('requested', [], '2026-11-04T10:00:00.000Z');
    const revoked = record('revoked', [], '2026-11-03T10:00:00.000Z');
    expect(latestConsentDecision([revoked, requested, grantedBoth])).toBe(revoked);
    expect(latestConsentDecision([requested])).toBeNull();
    expect(latestConsentDecision([])).toBeNull();
  });
});
