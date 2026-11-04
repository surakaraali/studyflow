import { getDb } from '@/db/client';
import { useDbQuery } from '@/db/use-query';
import { quotaMonth } from '@/domain/rules';
import { useSession } from '@/stores/session';

import { quotaStatus, type QuotaStatus } from './quota';

/**
 * Documents that count toward this month's quota. Deleted documents still count: the quota is
 * about processing, and deleting must not give the upload back. Failed jobs are refunded by
 * setting counted = 0 (BR-14).
 */
export async function countDocumentsThisMonth(month: string = quotaMonth()): Promise<number> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM documents WHERE counted = 1 AND quota_month = ?',
    month,
  );
  return row?.n ?? 0;
}

/** Live quota for the signed-in student (US-38). */
export function useQuota(): QuotaStatus | undefined {
  const plan = useSession((s) => s.profile?.plan ?? 'free');
  const month = quotaMonth();
  const { data: used } = useDbQuery(`quota:${month}`, () => countDocumentsThisMonth(month), ['documents']);
  return used === undefined ? undefined : quotaStatus(plan, used);
}
