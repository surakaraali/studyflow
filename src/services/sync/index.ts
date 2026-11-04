/**
 * Offline-first sync between the device database and Supabase (US-05, US-46, OFF-03, REL-05).
 * Only active when backendMode === 'supabase'; in local mode the app never leaves the device.
 *
 * Runs on sign-in, when the app comes to the foreground, when the network comes back (within
 * 30 s), every 60 s while the app is active and 2 s after local writes. See engine.ts for the
 * push/pull rules and analysis/adr/ADR-001 for the design.
 */

import Constants from 'expo-constants';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { currentUserId, getDb, hasDb } from '@/db/client';
import { subscribeTables } from '@/db/events';
import { SYNCED_TABLES } from '@/db/schema';
import { registerAppService } from '@/services/app-services';
import { backendMode } from '@/services/config';
import { supabase } from '@/services/supabase';
import { onSignedIn, onSignedOut } from '@/stores/session';

import { syncOnce } from './engine';
import { createScheduler, type RunOutcome } from './scheduler';
import { resetColumnCache, sqliteLocal, sqliteOutbox } from './sqlite-store';
import { useSyncStatus } from './status';
import { supabaseRemote } from './supabase-remote';

export { useSyncStatus, type SyncState, type SyncStatus } from './status';

const ACTIVITY_KEY = 'sync.activity_day';

/** Changes rejected 5+ times are retried once per app start, then left alone. */
let stuckRetried = false;
/** This device's Expo push token once the server has it; removed again on sign-out. */
let pushToken: string | null = null;

async function refreshCounts() {
  if (!hasDb()) return;
  const { pending, stuck } = await sqliteOutbox.count();
  useSyncStatus.setState({ pending, stuck });
}

/** BR-25: tells the server the account is in use, at most once a day. */
async function touchActivity() {
  const client = supabase();
  if (!client) return;
  const today = new Date().toISOString().slice(0, 10);
  const row = await getDb().getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', ACTIVITY_KEY);
  if (row?.value === JSON.stringify(today)) return;
  const { error } = await client.rpc('touch_activity');
  if (error) return;
  await getDb().runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ACTIVITY_KEY,
    JSON.stringify(today),
  );
}

/** Lets the server push "Velin onayladı" (consent function). Needs permission and an EAS project id. */
async function registerPushToken(userId: string) {
  if (pushToken || Platform.OS === 'web') return;
  const client = supabase();
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!client || !projectId) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await client
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'user_id,token' });
  if (!error) pushToken = token;
}

/** Signed out on this device: the next account here must not get the previous one's pushes. */
async function unregisterPushToken() {
  const client = supabase();
  const token = pushToken;
  pushToken = null;
  if (!client || !token) return;
  await client.from('push_tokens').delete().eq('token', token);
}

async function runSync(): Promise<RunOutcome> {
  const client = supabase();
  if (!client || !hasDb()) return 'skipped';
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  // The open database must belong to the signed-in user.
  if (!userId || userId !== currentUserId()) return 'skipped';

  useSyncStatus.setState({ state: 'syncing' });
  const report = await syncOnce(
    { userId, outbox: sqliteOutbox, local: sqliteLocal, remote: supabaseRemote(client) },
    { includeStuck: !stuckRetried },
  );
  stuckRetried = true;
  await refreshCounts();

  if (report.push.retryLater || report.pull?.retryLater) {
    useSyncStatus.setState({ state: 'offline' });
    return 'retry';
  }

  useSyncStatus.setState({ state: report.push.rejected > 0 ? 'error' : 'idle', lastSyncedAt: new Date().toISOString() });
  void touchActivity().catch(() => {});
  void registerPushToken(userId).catch(() => {});

  const { pending, stuck } = useSyncStatus.getState();
  return report.push.pushed > 0 && pending - stuck > 0 ? 'more' : 'done';
}

const scheduler = createScheduler(runSync);

/** Runs a sync now (e.g. pull-to-refresh). Does nothing in local mode. */
export function syncNow() {
  scheduler.trigger(0);
}

let unsubscribeTables: (() => void) | null = null;

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

function start() {
  onSignedIn(() => {
    resetColumnCache();
    stuckRetried = false;
    void refreshCounts();
    unsubscribeTables?.();
    unsubscribeTables = subscribeTables(SYNCED_TABLES, () => {
      scheduler.localChange();
      void refreshCounts().catch(() => {});
    });
    if (AppState.currentState !== 'background') scheduler.start();
    scheduler.trigger(0);
  });

  onSignedOut(async () => {
    scheduler.stop();
    // Runs before the session ends, so the delete is still authorised.
    await unregisterPushToken().catch(() => {});
    unsubscribeTables?.();
    unsubscribeTables = null;
    useSyncStatus.setState({ state: 'idle', pending: 0, stuck: 0, lastSyncedAt: null });
  });

  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (!hasDb()) return;
    if (next === 'active') {
      scheduler.start();
      scheduler.trigger(0);
    } else if (next === 'background') {
      scheduler.stop();
    }
  });

  Network.addNetworkStateListener((state) => scheduler.network(isOnline(state)));
  void Network.getNetworkStateAsync()
    .then((state) => scheduler.network(isOnline(state)))
    .catch(() => {});
}

if (backendMode === 'supabase') {
  registerAppService(start);
}
