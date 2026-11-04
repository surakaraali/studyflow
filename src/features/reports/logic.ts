/** Content report rules (US-37, BR-23) as pure functions. */

import type { ContentReport, ReportReason, ReportStatus } from '@/db/types';
import { REPORTS_FOR_REVIEW } from '@/domain/rules';

export const REPORT_REASONS: readonly ReportReason[] = ['wrong_answer', 'unclear', 'inappropriate'];

/** BR-23: more than three reports on one document put the whole document under review. */
export function shouldReviewDocument(reportCount: number): boolean {
  return reportCount > REPORTS_FOR_REVIEW;
}

export type ReportDecision = Exclude<ReportStatus, 'open'>;

/**
 * What a team decision does to the reported item:
 * removed → the item is deleted for good; fixed → edited and shown again;
 * valid → the report was wrong, so the item is shown again.
 */
export function decisionEffect(decision: ReportDecision): { deleteItem: boolean; hidden: 0 | 1 } {
  switch (decision) {
    case 'removed':
      return { deleteItem: true, hidden: 1 };
    case 'fixed':
    case 'valid':
      return { deleteItem: false, hidden: 0 };
  }
}

/** Open reports grouped by item, so one decision closes every report on the same item. */
export function groupOpenReports<T extends Pick<ContentReport, 'item_id' | 'status' | 'created_at'>>(
  reports: readonly T[],
): { itemId: string; reports: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const report of reports) {
    if (report.status !== 'open') continue;
    const list = groups.get(report.item_id) ?? [];
    list.push(report);
    groups.set(report.item_id, list);
  }
  return [...groups.entries()]
    .map(([itemId, list]) => ({
      itemId,
      reports: list.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => a.reports[0].created_at.localeCompare(b.reports[0].created_at));
}
