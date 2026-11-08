/**
 * Release safety rules (pure, unit tested). A release build must talk to a real server:
 * local mode (accounts on the device, AI on a dev server) is for development builds only.
 */

import type { BackendMode } from '@/services/config';

export type ReleaseIssue = 'missing_server_config' | 'insecure_server_url';

export type ReleaseInput = {
  /** `__DEV__`: true in development builds and Expo Go. */
  isDev: boolean;
  backendMode: BackendMode;
  supabaseUrl: string;
};

/** Why this build must not start, or null when it may. */
export function releaseIssue({ isDev, backendMode, supabaseUrl }: ReleaseInput): ReleaseIssue | null {
  if (isDev) return null;
  if (backendMode === 'local') return 'missing_server_config';
  // Catches a local Supabase (http://127.0.0.1:54321) baked into a release build.
  if (!supabaseUrl.trim().startsWith('https://')) return 'insecure_server_url';
  return null;
}

/** Demo data and the local report queue: development builds in local mode only. */
export function devToolsAllowed({ isDev, backendMode }: Pick<ReleaseInput, 'isDev' | 'backendMode'>): boolean {
  return isDev && backendMode === 'local';
}
