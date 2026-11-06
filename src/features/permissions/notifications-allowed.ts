import { getDb, hasDb } from '@/db/client';
import { useDbQuery } from '@/db/use-query';
import { useSession } from '@/stores/session';

import { notificationBlockReason, type ConsentDecision, type NotificationBlockReason } from './rules';

export {
  latestConsentDecision,
  notificationBlockReason,
  notificationsAllowed,
  type ConsentDecision,
  type NotificationBlockReason,
} from './rules';

/** The parent's latest grant or revoke on this device, or null. */
export async function loadLatestConsentDecision(): Promise<ConsentDecision | null> {
  if (!hasDb()) return null;
  const row = await getDb().getFirstAsync<ConsentDecision>(
    `SELECT action, purposes, created_at FROM consent_records
     WHERE action IN ('granted', 'revoked') ORDER BY created_at DESC LIMIT 1`,
  );
  return row ?? null;
}

/** For services: may the signed-in student get notifications right now? (US-76) */
export async function notificationsAllowedNow(): Promise<boolean> {
  const profile = useSession.getState().profile;
  if (!profile) return false;
  // Adults and accounts before onboarding don't need the consent records.
  if (notificationBlockReason(profile, null) === null) return true;
  return notificationBlockReason(profile, await loadLatestConsentDecision()) === null;
}

/**
 * Whether the parent's consent allows notifications (US-76), kept live. Mirrors useAiAllowed.
 * Until the consent records are read, an under-18 student counts as not allowed (`loaded` false).
 */
export function useNotificationsAllowed(): {
  allowed: boolean;
  reason: NotificationBlockReason | null;
  loaded: boolean;
} {
  const profile = useSession((s) => s.profile);
  const { data } = useDbQuery(
    `notifications-consent-${profile?.id ?? 'none'}`,
    async () => ({ latest: await loadLatestConsentDecision() }),
    ['consent_records'],
  );

  const reason = notificationBlockReason(profile, data?.latest ?? null);
  const loaded = data !== undefined || reason === null;
  return { allowed: reason === null, reason: loaded ? reason : null, loaded };
}
