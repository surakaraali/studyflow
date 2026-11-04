import type { TableName } from './schema';

type Listener = () => void;

const listeners = new Map<TableName, Set<Listener>>();

/** Tell every live query that reads one of these tables to run again. */
export function notifyTables(tables: readonly TableName[]) {
  const toCall = new Set<Listener>();
  for (const table of tables) {
    listeners.get(table)?.forEach((listener) => toCall.add(listener));
  }
  toCall.forEach((listener) => listener());
}

/** Notify every table, e.g. after a sync pull or a sign-in. */
export function notifyAll() {
  const toCall = new Set<Listener>();
  listeners.forEach((set) => set.forEach((listener) => toCall.add(listener)));
  toCall.forEach((listener) => listener());
}

export function subscribeTables(tables: readonly TableName[], listener: Listener): () => void {
  for (const table of tables) {
    let set = listeners.get(table);
    if (!set) {
      set = new Set();
      listeners.set(table, set);
    }
    set.add(listener);
  }
  return () => {
    for (const table of tables) listeners.get(table)?.delete(listener);
  };
}
