/**
 * Monthly document quota and page limits (BR-14, US-38). Pure helpers.
 */

import { quota, type Plan } from '@/domain/rules';

export type QuotaStatus = {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  /** No uploads left this month. */
  full: boolean;
  /** Pages allowed per document. */
  pages: number;
  /** 0…1 for the progress bar. */
  ratio: number;
};

export function quotaStatus(plan: Plan, used: number): QuotaStatus {
  const { documents, pages } = quota(plan);
  const safeUsed = Math.max(0, used);
  return {
    plan,
    used: safeUsed,
    limit: documents,
    remaining: Math.max(0, documents - safeUsed),
    full: safeUsed >= documents,
    pages,
    ratio: Math.min(1, safeUsed / documents),
  };
}

export type PageRange = { from: number; to: number };

export function rangeLength(range: PageRange): number {
  return range.to - range.from + 1;
}

/** The first `maxPages` pages, or the whole document when it fits. */
export function initialPageRange(pageCount: number, maxPages: number): PageRange {
  return { from: 1, to: Math.max(1, Math.min(pageCount, maxPages)) };
}

/**
 * Keeps a range valid after the student moves one end: inside the document, from ≤ to, and at
 * most `maxPages` long. The other end follows the one that moved.
 */
export function clampPageRange(range: PageRange, pageCount: number, maxPages: number, moved: 'from' | 'to'): PageRange {
  const last = Math.max(1, pageCount);
  let from = Math.min(Math.max(1, Math.round(range.from)), last);
  let to = Math.min(Math.max(1, Math.round(range.to)), last);

  if (moved === 'from') {
    if (to < from) to = from;
    if (to - from + 1 > maxPages) to = from + maxPages - 1;
  } else {
    if (from > to) from = to;
    if (to - from + 1 > maxPages) from = to - maxPages + 1;
  }
  return { from, to };
}
