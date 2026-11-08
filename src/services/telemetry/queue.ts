/**
 * Device-wide queue of telemetry items waiting to be sent (ADR-006).
 *
 * Lives in expo-sqlite/kv-store, not in the user's database, so crash reports from the sign-in
 * screens and from the previous launch are kept too. Every change is written synchronously: the
 * global error handler runs just before a fatal crash ends the app.
 *
 * Each item gets a local sequence number so a flush can remove exactly what it sent, even when
 * the cap dropped older items meanwhile. The number never leaves the device.
 */

import type { TelemetryItem } from './types';

export type KeyValueStore = {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
};

export type QueuedItem = { seq: number; item: TelemetryItem };

export type TelemetryQueue = {
  push(item: TelemetryItem): void;
  /** The oldest items, at most `limit`. */
  peek(limit: number): QueuedItem[];
  /** Removes every item up to and including `seq`. */
  removeThrough(seq: number): void;
  size(): number;
};

type Stored = { v: 1; next: number; items: QueuedItem[] };

export const QUEUE_KEY = 'studyflow.telemetry.queue';
export const MAX_QUEUED = 500;
export const MAX_QUEUED_CRASHES = 50;

function isStored(value: unknown): value is Stored {
  const v = value as Stored | null;
  return v != null && v.v === 1 && typeof v.next === 'number' && Array.isArray(v.items);
}

export function createTelemetryQueue(
  store: KeyValueStore,
  { key = QUEUE_KEY, maxItems = MAX_QUEUED, maxCrashes = MAX_QUEUED_CRASHES } = {},
): TelemetryQueue {
  let state: Stored | null = null;

  function load(): Stored {
    if (state) return state;
    try {
      const raw = store.getItemSync(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      state = isStored(parsed) ? parsed : { v: 1, next: 1, items: [] };
    } catch {
      state = { v: 1, next: 1, items: [] };
    }
    return state;
  }

  function save() {
    try {
      store.setItemSync(key, JSON.stringify(state));
    } catch {
      // Storage unavailable (e.g. web without SQLite): keep the queue in memory.
    }
  }

  return {
    push(item) {
      const s = load();
      s.items.push({ seq: s.next++, item });
      if (item.type === 'crash') {
        const crashes = s.items.filter((q) => q.item.type === 'crash');
        if (crashes.length > maxCrashes) {
          const oldest = crashes[0].seq;
          s.items = s.items.filter((q) => q.seq !== oldest);
        }
      }
      if (s.items.length > maxItems) s.items.splice(0, s.items.length - maxItems);
      save();
    },
    peek(limit) {
      return load().items.slice(0, limit);
    },
    removeThrough(seq) {
      const s = load();
      const before = s.items.length;
      s.items = s.items.filter((q) => q.seq > seq);
      if (s.items.length !== before) save();
    },
    size() {
      return load().items.length;
    },
  };
}
