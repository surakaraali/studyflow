import type { DocumentRow } from '@/db/types';
import { asErrorCode, type AiErrorCode } from '@/services/ai/types';

/** What the student sees for a document (icon + text, never color alone). */
export type DisplayStatus = 'queued' | 'retrying' | 'waiting' | 'processing' | 'ready' | 'error';

export function displayStatus(
  doc: Pick<DocumentRow, 'status' | 'error_code' | 'next_attempt_at'>,
  aiAllowed: boolean,
): DisplayStatus {
  if (doc.status === 'ready' || doc.status === 'error') return doc.status;
  if (!aiAllowed) return 'waiting';
  if (doc.status === 'processing') return 'processing';
  return doc.error_code && doc.next_attempt_at ? 'retrying' : 'queued';
}

/** Failures that a "Tekrar dene" can fix. Unsuitable documents and missing files cannot. */
const NO_RETRY: readonly AiErrorCode[] = ['inappropriate', 'file_missing', 'too_many_pages', 'bad_request', 'empty'];

export function canRetry(doc: Pick<DocumentRow, 'status' | 'error_code'>): boolean {
  return doc.status === 'error' && !NO_RETRY.includes(asErrorCode(doc.error_code));
}

/**
 * A rough share of the work done, for a progress bar that feels alive while the job runs.
 * Based on PERF-05 (20 pages ≈ 1–3 min); never reaches 1 before the job is really done.
 */
export function estimatedProgress(elapsedMs: number, pages: number): number {
  const expectedMs = 45_000 + Math.max(1, pages) * 6_000;
  const ratio = elapsedMs / expectedMs;
  return Math.min(0.95, 1 - Math.exp(-2 * Math.max(0, ratio)));
}
