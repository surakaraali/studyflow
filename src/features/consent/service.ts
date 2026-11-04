/**
 * Parent consent (US-15, US-16, US-17).
 *
 * Local mode: the request row's token stands in for the link in the parent's email; the
 * parent-consent route opens it on this device. Supabase mode: the `consent-request` edge
 * function emails the parent and the web page records the decision on the server; the app
 * refreshes `consent_status` from `profiles` whenever it comes to the foreground.
 */

import { AppState } from 'react-native';

import { getDb, hasDb } from '@/db/client';
import { notifyTables } from '@/db/events';
import { newId } from '@/db/ids';
import type { ConsentPurpose, ConsentRecord, ConsentRequest } from '@/db/types';
import { patch, upsert } from '@/db/write';
import type { ConsentStatus } from '@/domain/rules';
import { LEGAL_VERSION } from '@/features/legal/texts';
import i18n from '@/i18n';
import { registerAppService } from '@/services/app-services';
import { backendMode, isLocalMode } from '@/services/config';
import { notifyNow } from '@/services/notifications';
import { supabase } from '@/services/supabase';
import { useSession } from '@/stores/session';

import { linkExpiresAt, resendsLeft } from './logic';

export type ConsentSendResult = { ok: true } | { ok: false; error: 'limit' | 'network' };

export async function listConsentRequests(): Promise<ConsentRequest[]> {
  return getDb().getAllAsync<ConsentRequest>('SELECT * FROM consent_requests ORDER BY created_at ASC');
}

export async function findConsentRequest(token: string): Promise<ConsentRequest | null> {
  if (!hasDb()) return null;
  return getDb().getFirstAsync<ConsentRequest>('SELECT * FROM consent_requests WHERE token = ?', token);
}

export async function listConsentRecords(): Promise<ConsentRecord[]> {
  return getDb().getAllAsync<ConsentRecord>('SELECT * FROM consent_records ORDER BY created_at ASC');
}

/** How many more links the student can send today (US-17). */
export async function consentResendsLeft(now: Date = new Date()): Promise<number> {
  const requests = await listConsentRequests();
  return resendsLeft(
    requests.map((r) => r.created_at),
    now,
  );
}

/**
 * Sends a consent link to the parent. The first link (end of onboarding) is free; every
 * later one, including one to a changed address, counts toward the 3-a-day limit.
 * A failed send is not recorded, so it doesn't use up a resend.
 */
export async function requestConsent(parentEmail: string): Promise<ConsentSendResult> {
  const email = parentEmail.trim().toLowerCase();
  const requests = await listConsentRequests();
  if (requests.length > 0 && resendsLeft(requests.map((r) => r.created_at)) <= 0) {
    return { ok: false, error: 'limit' };
  }

  const sb = supabase();
  if (sb) {
    const { error } = await sb.functions.invoke('consent-request', { body: { parentEmail: email } });
    if (error) return { ok: false, error: 'network' };
  }

  const created = new Date();
  await getDb().runAsync(
    'INSERT INTO consent_requests (id, parent_email, token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    newId(),
    email,
    newId(),
    created.toISOString(),
    linkExpiresAt(created).toISOString(),
  );
  notifyTables(['consent_requests']);

  // Audit trail: when a link went out and which text version it pointed to.
  await upsert('consent_records', {
    id: newId(),
    parent_email: email,
    action: 'requested',
    purposes: '[]',
    text_version: LEGAL_VERSION,
  });
  return { ok: true };
}

function currentProfile() {
  const profile = useSession.getState().profile;
  if (!profile) throw new Error('No profile');
  return profile;
}

export async function resendConsent(): Promise<ConsentSendResult> {
  const profile = currentProfile();
  if (!profile.parent_email) return { ok: false, error: 'network' };
  const result = await requestConsent(profile.parent_email);
  if (result.ok && profile.consent_status === 'revoked') {
    await patch('profile', profile.id, { consent_status: 'pending' });
  }
  return result;
}

/** Validate the address first (validateParentEmail). Sends a new link, then saves the address. */
export async function changeParentEmail(parentEmail: string): Promise<ConsentSendResult> {
  const profile = currentProfile();
  const result = await requestConsent(parentEmail);
  if (!result.ok) return result;
  const changes: Record<string, unknown> = { parent_email: parentEmail.trim().toLowerCase() };
  if (profile.consent_status === 'revoked') changes.consent_status = 'pending';
  await patch('profile', profile.id, changes);
  return { ok: true };
}

const NOTIFICATION_SWITCHES_OFF = { notif_plan: 0, notif_exam: 0, notif_homework: 0, notif_ai: 0 };

async function notifyGranted() {
  await notifyNow({
    kind: 'consent',
    title: i18n.t('consent.notify.grantedTitle'),
    body: i18n.t('consent.notify.grantedBody'),
    url: '/',
  });
}

/**
 * Local stand-in for the parent's web page: appends a 'granted' record and opens the account.
 * Purposes the parent didn't tick stay off (notifications are switched off here; AI is checked
 * by useAiAllowed).
 */
export async function grantConsent(request: ConsentRequest, purposes: ConsentPurpose[]): Promise<void> {
  // With a server, only the parent's web page may record consent.
  if (!isLocalMode) throw new Error('Consent is recorded by the web page');
  const profile = currentProfile();
  await upsert('consent_records', {
    id: newId(),
    parent_email: request.parent_email,
    action: 'granted',
    purposes: JSON.stringify(purposes),
    text_version: LEGAL_VERSION,
  });
  await patch('profile', profile.id, {
    consent_status: 'granted',
    parent_email: request.parent_email,
    ...(purposes.includes('notifications') ? {} : NOTIFICATION_SWITCHES_OFF),
  });
  await notifyGranted();
}

/** "Onayımı geri al": a new record (records are never changed), and AI turns off (BR-03). */
export async function revokeConsent(parentEmail: string): Promise<void> {
  if (!isLocalMode) throw new Error('Consent is recorded by the web page');
  const profile = currentProfile();
  await upsert('consent_records', {
    id: newId(),
    parent_email: parentEmail,
    action: 'revoked',
    purposes: '[]',
    text_version: LEGAL_VERSION,
  });
  await patch('profile', profile.id, { consent_status: 'revoked' });
}

const STATUSES: readonly ConsentStatus[] = ['not_required', 'pending', 'granted', 'revoked'];

/** Supabase mode: the parent decides on the web, so pull the status from the server. */
export async function refreshConsentFromServer(): Promise<void> {
  const sb = supabase();
  const profile = useSession.getState().profile;
  if (!sb || !profile || !hasDb()) return;
  const { data, error } = await sb.from('profiles').select('consent_status').single();
  if (error || !data) return;
  const status = (data as { consent_status?: string }).consent_status as ConsentStatus | undefined;
  if (!status || !STATUSES.includes(status) || status === profile.consent_status) return;
  await patch('profile', profile.id, { consent_status: status });
  if (status === 'granted') await notifyGranted();
}

registerAppService(() => {
  if (backendMode !== 'supabase') return;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshConsentFromServer().catch(() => undefined);
  });
  void refreshConsentFromServer().catch(() => undefined);
});
