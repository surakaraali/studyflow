/**
 * Keeps scheduled notifications in line with the parent's decision (US-76):
 * - when the notification consent changes, plan, exam and homework reminders are rebuilt
 *   (rescheduleReminders checks the consent itself, so a withdrawal drops them);
 * - local mode: while consent is pending, consent reminders on day 7 and day 25 (BR-04, US-17).
 *   With a server, consent-maintenance e-mails the parent instead;
 * - signing out removes this account's reminders from the device.
 */

import type { Href } from 'expo-router';

import { hasDb } from '@/db/client';
import { subscribeTables } from '@/db/events';
import type { Profile } from '@/db/types';
import { ageFromBirthYear, needsParentConsent } from '@/domain/rules';
import { consentDeadline } from '@/features/consent/logic';
import { notificationsAllowedNow } from '@/features/permissions/notifications-allowed';
import i18n from '@/i18n';
import { localeTag } from '@/lib/dates';
import { registerAppService } from '@/services/app-services';
import { isLocalMode } from '@/services/config';
import { cancelKinds, scheduleAt } from '@/services/notifications';
import { onSignedIn, onSignedOut, useSession } from '@/stores/session';

import { consentReminderDates } from './build';
import { rescheduleReminders } from './schedule';

/** `${profileId}:${allowed}` from the last check; null right after sign-in. */
let lastAllowed: string | null = null;
/** What the consent reminders were last scheduled for. */
let lastConsentKey: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

function serial(task: () => Promise<void>) {
  const run = chain.then(task);
  chain = run.catch((error) => console.warn('Consent reminders failed', error));
}

function consentKey(profile: Profile): string {
  return [profile.id, profile.consent_status, profile.birth_year ?? '', profile.created_at].join(':');
}

async function scheduleConsentReminders(profile: Profile) {
  await cancelKinds(['consent']);
  if (profile.consent_status !== 'pending' || !profile.birth_year) return;
  const now = new Date();
  const age = ageFromBirthYear(profile.birth_year, now);
  if (!needsParentConsent(age)) return;

  const locked = age < 13;
  const deadline = new Intl.DateTimeFormat(localeTag(i18n.language), { day: 'numeric', month: 'long' }).format(
    consentDeadline(profile.created_at),
  );
  for (const { date } of consentReminderDates(profile.created_at, now)) {
    await scheduleAt({
      kind: 'consent',
      date,
      title: i18n.t('reminders.consentTitle'),
      body: locked ? i18n.t('reminders.consentBodyLocked', { date: deadline }) : i18n.t('reminders.consentBody'),
      url: (locked ? '/waiting' : '/consent') as Href,
    });
  }
}

async function evaluate() {
  const profile = useSession.getState().profile;
  if (!profile || !hasDb()) return;

  const allowed = `${profile.id}:${await notificationsAllowedNow()}`;
  // The first check after sign-in only records the state: the sign-in plan run reschedules.
  if (lastAllowed !== null && allowed !== lastAllowed) await rescheduleReminders();
  lastAllowed = allowed;

  if (isLocalMode && consentKey(profile) !== lastConsentKey) {
    lastConsentKey = consentKey(profile);
    await scheduleConsentReminders(profile);
  }
}

registerAppService(() => {
  // Local grants and revokes, and consent_status pulled from the server, all land here.
  subscribeTables(['profile', 'consent_records'], () => serial(evaluate));

  onSignedIn(() => {
    lastAllowed = null;
    lastConsentKey = null;
    serial(evaluate);
  });

  onSignedOut(async () => {
    lastAllowed = null;
    lastConsentKey = null;
    // The next account on this device must not get this one's reminders.
    await cancelKinds(['plan', 'exam', 'homework', 'consent']).catch(() => undefined);
  });
});
