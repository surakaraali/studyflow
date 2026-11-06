/**
 * Notification consent (US-76, BR-04). Pure, unit tested.
 *
 * Under 18, notifications need the parent's consent with the "Bildirimler" purpose ticked.
 * Until then (pending, revoked, or a grant without that purpose) only consent messages such as
 * "Velin onayladı" go out. Adults and accounts that haven't finished onboarding are not limited.
 */

import type { ConsentRecord, Profile } from '@/db/types';
import { ageFromBirthYear, needsParentConsent } from '@/domain/rules';
import { parsePurposes } from '@/features/consent/logic';

export type ConsentDecision = Pick<ConsentRecord, 'action' | 'purposes' | 'created_at'>;

/** 'consent': no parent decision yet (or revoked) · 'purpose': approved, but not for notifications. */
export type NotificationBlockReason = 'consent' | 'purpose';

type ProfileFields = Pick<Profile, 'birth_year' | 'consent_status'>;

/** The parent's latest grant or revoke; 'requested' rows are only an audit trail. Any order. */
export function latestConsentDecision<T extends ConsentDecision>(records: readonly T[]): T | null {
  return (
    records
      .filter((r) => r.action === 'granted' || r.action === 'revoked')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .at(-1) ?? null
  );
}

/** Why notifications are off for this student, or null when they may get them. */
export function notificationBlockReason(
  profile: ProfileFields | null,
  latestConsentRecord: ConsentDecision | null | undefined,
  now: Date = new Date(),
): NotificationBlockReason | null {
  if (!profile) return 'consent';
  // Before onboarding there is no age yet; nothing is scheduled then anyway.
  if (!profile.birth_year) return null;
  if (!needsParentConsent(ageFromBirthYear(profile.birth_year, now))) return null;
  if (profile.consent_status !== 'granted') return 'consent';
  // The status says granted but the record hasn't reached this device yet: wait for it.
  if (latestConsentRecord?.action !== 'granted') return 'consent';
  return parsePurposes(latestConsentRecord.purposes).includes('notifications') ? null : 'purpose';
}

/**
 * True when this student may get reminders and other notifications.
 * `latestConsentRecord` is the parent's latest decision (see latestConsentDecision).
 */
export function notificationsAllowed(
  profile: ProfileFields | null,
  latestConsentRecord?: ConsentDecision | null,
  now: Date = new Date(),
): boolean {
  return notificationBlockReason(profile, latestConsentRecord, now) === null;
}
