/**
 * App-side copy of the AI server contract (supabase/functions/_shared/ai/types.ts).
 * The app cannot import server code, so keep the two in step when the response changes.
 */

import type { SummarySection } from '@/db/types';
import type { Segment } from '@/domain/rules';

/** Body of POST /v1/process. Only these fields may leave the device (BR-05). */
export type AiRequest = {
  /** Base64 PDF, already trimmed to the chosen page range. */
  pdf: string;
  grade: number;
  segment: Segment;
  courseName: string;
  optionCount: number;
  quizCount: number;
  cardCount: number;
  /** Pages in the PDF that is sent. */
  pageCount: number;
};

export type AiQuestion = {
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source_page: number | null;
  topic: string;
};

export type AiCard = {
  front: string;
  back: string;
  source_page: number | null;
};

export type AiUsageEntry = {
  task: 'summary' | 'quiz' | 'cards';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  duration_ms: number;
  cost_usd: number;
};

export type AiResult = {
  summary: { sections: SummarySection[] };
  quiz: { questions: AiQuestion[] };
  cards: { cards: AiCard[] };
  usage: AiUsageEntry[];
  flagged: { reason: string } | null;
};

/** Error codes stored in documents.error_code. Each has a message in documents.errors. */
export type AiErrorCode =
  // From the AI server
  | 'provider_unavailable'
  | 'invalid_output'
  | 'truncated'
  | 'refused'
  | 'empty'
  | 'bad_request'
  | 'server_config'
  // From the app or the Edge Function
  | 'inappropriate'
  | 'quota_exceeded'
  | 'too_many_pages'
  | 'consent'
  | 'file_missing'
  | 'expired'
  | 'network'
  | 'dev_server'
  | 'unknown';

export const AI_ERROR_CODES: readonly AiErrorCode[] = [
  'provider_unavailable',
  'invalid_output',
  'truncated',
  'refused',
  'empty',
  'bad_request',
  'server_config',
  'inappropriate',
  'quota_exceeded',
  'too_many_pages',
  'consent',
  'file_missing',
  'expired',
  'network',
  'dev_server',
  'unknown',
];

export function asErrorCode(value: unknown): AiErrorCode {
  return AI_ERROR_CODES.includes(value as AiErrorCode) ? (value as AiErrorCode) : 'unknown';
}

/** How one processing run ended. The runner turns this into document status changes. */
export type JobOutcome =
  /** Content is stored locally and the document is ready. */
  | { kind: 'ready' }
  /** SP-02: the document was flagged as unsuitable; nothing was stored. */
  | { kind: 'flagged' }
  /** Nothing failed but the job has to wait (server-side retry later, consent check). */
  | { kind: 'deferred'; at: string }
  | { kind: 'error'; code: AiErrorCode; retryable: boolean; serverNotified?: boolean };

/** Questions and cards per document (US-34, US-35). */
export const QUIZ_QUESTION_COUNT = 10;
export const CARD_COUNT = 15;
