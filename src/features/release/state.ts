import { backendMode, config } from '@/services/config';

import { devToolsAllowed, releaseIssue } from './guard';

/** Decided once at start-up: the inputs are fixed when the bundle is built. */
export const currentReleaseIssue = releaseIssue({
  isDev: __DEV__,
  backendMode,
  supabaseUrl: config.supabaseUrl,
});

export const devTools = devToolsAllowed({ isDev: __DEV__, backendMode });
