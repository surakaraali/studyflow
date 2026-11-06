import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';

import { isQuietTime } from '@/domain/rules';
import { notificationsAllowedNow } from '@/features/permissions/notifications-allowed';
import { registerAppService } from '@/services/app-services';
import { profileAge, useSession } from '@/stores/session';

/**
 * Local notifications core (FR-NT). Features build their reminders on top of these helpers.
 * Every helper respects the parent's consent (US-76), the student's per-type switches and the
 * quiet hours (BR-16).
 */

export type NotificationKind = 'plan' | 'exam' | 'homework' | 'ai' | 'timer' | 'consent';

type Payload = {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Screen to open when the student taps the notification. */
  url?: Href;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function kindEnabled(kind: NotificationKind): boolean {
  const profile = useSession.getState().profile;
  if (!profile) return false;
  switch (kind) {
    case 'plan':
      return profile.notif_plan === 1;
    case 'exam':
      return profile.notif_exam === 1;
    case 'homework':
      return profile.notif_homework === 1;
    case 'ai':
      return profile.notif_ai === 1;
    default:
      // Timer and consent messages answer the student's own action.
      return true;
  }
}

/**
 * US-76: under 18, only consent messages ("Velin onayladı", consent reminders) go out until
 * the parent approves notifications.
 */
async function consentAllows(kind: NotificationKind): Promise<boolean> {
  return kind === 'consent' || notificationsAllowedNow();
}

function inQuietHours(date: Date): boolean {
  const age = profileAge(useSession.getState().profile);
  return age != null && isQuietTime(date, age);
}

export async function hasNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

/**
 * Asks once. Call it after the student has seen why notifications help (US-60).
 * Never asks while the parent's consent doesn't cover notifications (US-76).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  if (!(await notificationsAllowedNow())) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/**
 * Shows a notification now (e.g. "Belgen hazır"). Skipped in quiet hours, when switched off or
 * without the parent's consent.
 */
export async function notifyNow(payload: Payload): Promise<void> {
  if (!kindEnabled(payload.kind) || inQuietHours(new Date())) return;
  if (!(await consentAllows(payload.kind))) return;
  if (!(await hasNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: payload.title, body: payload.body, data: { kind: payload.kind, url: payload.url } },
    trigger: null,
  });
}

/**
 * Schedules a notification. Returns its id, or null when it was skipped
 * (in the past, in quiet hours, type switched off, no parent consent, no permission).
 */
export async function scheduleAt(
  payload: Payload & { date: Date },
  options: { ignoreQuietHours?: boolean } = {},
): Promise<string | null> {
  if (payload.date.getTime() <= Date.now()) return null;
  if (!kindEnabled(payload.kind)) return null;
  if (!options.ignoreQuietHours && inQuietHours(payload.date)) return null;
  if (!(await consentAllows(payload.kind))) return null;
  if (!(await hasNotificationPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: payload.title, body: payload.body, data: { kind: payload.kind, url: payload.url } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: payload.date },
  });
}

/** Cancels every scheduled notification of these kinds (used before rescheduling a plan). */
export async function cancelKinds(kinds: NotificationKind[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => kinds.includes(n.content.data?.kind as NotificationKind))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

function openFromResponse(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && useSession.getState().status === 'signedIn') {
    router.push(url as Href);
  }
}

registerAppService(() => {
  // Tapping a notification opens the screen it is about (US-62).
  Notifications.addNotificationResponseReceivedListener(openFromResponse);
});

/** Call once the app's navigation is mounted, for a notification that launched the app. */
export function openLaunchNotification() {
  openFromResponse(Notifications.getLastNotificationResponse());
}
