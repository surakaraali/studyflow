import { create } from 'zustand';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export type SyncStatus = {
  state: SyncState;
  /** Local changes not on the server yet (OFF-03: shown to the student). */
  pending: number;
  /** Changes the server refused several times; kept, retried at the next app start. */
  stuck: number;
  lastSyncedAt: string | null;
};

/** Read with `useSyncStatus((s) => s.pending)`. Stays idle with 0 pending in local mode. */
export const useSyncStatus = create<SyncStatus>(() => ({
  state: 'idle',
  pending: 0,
  stuck: 0,
  lastSyncedAt: null,
}));
