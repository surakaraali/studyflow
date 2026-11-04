import { useEffect, useRef, useState } from 'react';

import { subscribeTables } from './events';
import type { TableName } from './schema';

export type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
};

/**
 * Runs `query` and runs it again whenever one of `tables` changes.
 *
 * `key` must change whenever the query's inputs change (it plays the role of a deps array).
 *
 * ```ts
 * const { data: courses } = useDbQuery(`courses`, () => listCourses(), ['courses']);
 * ```
 */
export function useDbQuery<T>(
  key: string,
  query: () => Promise<T>,
  tables: readonly TableName[],
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    error: null,
    loading: true,
  });
  const queryRef = useRef(query);
  const tablesKey = tables.join(',');

  useEffect(() => {
    queryRef.current = query;
  });

  useEffect(() => {
    let alive = true;
    let running = false;
    let again = false;

    const run = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          const data = await queryRef.current();
          if (alive) setState({ data, error: null, loading: false });
        } while (again && alive);
      } catch (error) {
        if (alive) {
          setState((prev) => ({ data: prev.data, error: error as Error, loading: false }));
        }
      } finally {
        running = false;
      }
    };

    run();
    const unsubscribe = subscribeTables(tablesKey.split(',') as TableName[], run);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [key, tablesKey]);

  return state;
}
