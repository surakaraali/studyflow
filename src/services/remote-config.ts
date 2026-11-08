/**
 * Remote app config (FR-ADM-04): forced update and maintenance mode, from public.app_config
 * (one row; see supabase/migrations/20261107000002_app_config.sql).
 *
 * - Supabase mode only. Fetched at start and whenever the app comes to the foreground, without
 *   the user's session (the table is readable before sign-in).
 * - Cached for the whole device (expo-sqlite/kv-store) and read synchronously at start, so the
 *   gate is right on the first frame and keeps working offline.
 * - A cached maintenance flag expires after 6 hours without a successful check, so a phone that
 *   stays offline is not locked out for good. A minimum version never expires.
 * - Local mode: no config, no gate.
 */

import Storage from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { appVersion } from '@/lib/app-version';
import { registerAppService } from '@/services/app-services';
import { backendMode, config as env } from '@/services/config';

export type AppConfig = {
  iosMinVersion: string;
  iosLatestVersion: string;
  androidMinVersion: string;
  androidLatestVersion: string;
  maintenance: boolean;
  maintenanceMessage: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
};

export type AppGateState =
  | { status: 'open'; updateAvailable: { latestVersion: string; storeUrl: string | null } | null }
  | { status: 'update_required'; storeUrl: string | null }
  | { status: 'maintenance'; message: string | null };

export const MAINTENANCE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = 'studyflow.remoteConfig';
const MIN_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 10_000;
const COLUMNS =
  'ios_min_version,ios_latest_version,android_min_version,android_latest_version,maintenance,maintenance_message,ios_store_url,android_store_url';

// ---------------------------------------------------------------------------------------------
// Versions

/** "1.2.3", "1.2.3 (45)" or "1.2.3-beta" → [1, 2, 3]; null when it does not start with a number. */
export function parseVersion(value: string | null | undefined): number[] | null {
  const match = /^\s*v?(\d+(?:\.\d+)*)/.exec(value ?? '');
  return match ? match[1].split('.').map(Number) : null;
}

/** -1, 0 or 1. Missing parts count as 0 ("1.2" = "1.2.0"). Unparseable versions compare equal. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Config row and gate decision

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const version = (value: unknown): string => (typeof value === 'string' && parseVersion(value) ? value : '0');
const httpsUrl = (value: unknown): string | null =>
  typeof value === 'string' && /^https:\/\/\S+$/.test(value) ? value : null;

/** The app_config row (snake_case, from the API) as an AppConfig; null when it is not an object. */
export function parseAppConfig(row: unknown): AppConfig | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  return {
    iosMinVersion: version(r.ios_min_version),
    iosLatestVersion: version(r.ios_latest_version),
    androidMinVersion: version(r.android_min_version),
    androidLatestVersion: version(r.android_latest_version),
    maintenance: r.maintenance === true,
    maintenanceMessage: text(r.maintenance_message, 300),
    iosStoreUrl: httpsUrl(r.ios_store_url),
    androidStoreUrl: httpsUrl(r.android_store_url),
  };
}

/** Pure: what the gate shows for this config, platform and app version. */
export function gateState(input: {
  config: AppConfig | null;
  fetchedAt: number | null;
  platform: string;
  version: string | null;
  now: number;
}): AppGateState {
  const { config, platform } = input;
  if (!config || (platform !== 'ios' && platform !== 'android')) return { status: 'open', updateAvailable: null };

  const ios = platform === 'ios';
  const storeUrl = ios ? config.iosStoreUrl : config.androidStoreUrl;
  const current = input.version && parseVersion(input.version) ? input.version : null;

  if (current && compareVersions(current, ios ? config.iosMinVersion : config.androidMinVersion) < 0) {
    return { status: 'update_required', storeUrl };
  }
  const fresh = input.fetchedAt != null && input.now - input.fetchedAt <= MAINTENANCE_TTL_MS;
  if (config.maintenance && fresh) return { status: 'maintenance', message: config.maintenanceMessage };

  const latest = ios ? config.iosLatestVersion : config.androidLatestVersion;
  const updateAvailable = current && compareVersions(current, latest) < 0 ? { latestVersion: latest, storeUrl } : null;
  return { status: 'open', updateAvailable };
}

// ---------------------------------------------------------------------------------------------
// Store, cache and fetch

type Cached = { config: AppConfig | null; fetchedAt: number | null };

export type RemoteConfigState = Cached & {
  /** The last check could not reach the server. */
  offline: boolean;
  checking: boolean;
};

function readCache(): Cached {
  if (backendMode !== 'supabase') return { config: null, fetchedAt: null };
  try {
    const raw = Storage.getItemSync(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { row?: unknown; fetchedAt?: unknown }) : null;
    return {
      config: parseAppConfig(parsed?.row),
      fetchedAt: typeof parsed?.fetchedAt === 'number' ? parsed.fetchedAt : null,
    };
  } catch {
    return { config: null, fetchedAt: null };
  }
}

function writeCache(row: unknown, fetchedAt: number) {
  try {
    Storage.setItemSync(CACHE_KEY, JSON.stringify({ row, fetchedAt }));
  } catch {
    // The value still applies for this run.
  }
}

export const useRemoteConfig = create<RemoteConfigState>(() => ({ ...readCache(), offline: false, checking: false }));

let inFlight: Promise<boolean> | null = null;
let lastAttemptAt = 0;

async function fetchRow(): Promise<{ row: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${env.supabaseUrl}/rest/v1/app_config?select=${COLUMNS}&id=eq.1`, {
      headers: { apikey: env.supabaseAnonKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as unknown;
    return { row: Array.isArray(rows) ? (rows[0] ?? null) : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks the server now. Returns true when the server answered. Calls closer than 30 s apart
 * are skipped unless `force` (the retry button). Does nothing in local mode.
 */
export function refreshRemoteConfig({ force = false } = {}): Promise<boolean> {
  if (backendMode !== 'supabase') return Promise.resolve(false);
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastAttemptAt < MIN_INTERVAL_MS) return Promise.resolve(false);
  lastAttemptAt = Date.now();
  useRemoteConfig.setState({ checking: true });
  inFlight = fetchRow()
    .then((result) => {
      if (!result) {
        useRemoteConfig.setState({ offline: true });
        return false;
      }
      const fetchedAt = Date.now();
      writeCache(result.row, fetchedAt);
      useRemoteConfig.setState({ config: parseAppConfig(result.row), fetchedAt, offline: false });
      return true;
    })
    .finally(() => {
      inFlight = null;
      useRemoteConfig.setState({ checking: false });
    });
  return inFlight;
}

/** The gate for this device right now. */
export function currentGateState(state: Cached = useRemoteConfig.getState(), now = Date.now()): AppGateState {
  return gateState({
    config: state.config,
    fetchedAt: state.fetchedAt,
    platform: Platform.OS,
    version: appVersion().version,
    now,
  });
}

let started = false;

function start() {
  if (started || backendMode !== 'supabase') return;
  started = true;
  void refreshRemoteConfig({ force: true });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshRemoteConfig();
  });
}

registerAppService(start);
