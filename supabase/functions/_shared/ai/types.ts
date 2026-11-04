/**
 * Shapes shared by the development AI server (server/dev-ai.ts), the process-document
 * Edge Function and, as a copy, the app (src/services/ai/types.ts).
 *
 * Runtime-agnostic: no Node or Deno imports here.
 */

export type Segment = 'ilkokul' | 'ortaokul' | 'lise';

/**
 * Everything the AI provider receives for one document (BR-05): the PDF, the grade level and the
 * course name. Never add names, e-mail, school, birth year, ids or device details here.
 */
export type ProcessInput = {
  /** Base64 PDF (already trimmed to the chosen page range). */
  pdf: string;
  grade: number;
  segment: Segment;
  courseName: string;
  /** BR-12: answer options per question for the segment. */
  optionCount: number;
  quizCount: number;
  cardCount: number;
  /** Pages in the PDF that is sent; used to check source pages. */
  pageCount: number;
};

export type AiTask = 'summary' | 'quiz' | 'cards';

export type SummarySection = {
  heading: string;
  paragraphs: string[];
  key_terms: string[];
  /** 1-based pages of the PDF that was sent. */
  pages: number[];
};

export type QuizQuestion = {
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source_page: number | null;
  topic: string;
};

export type Flashcard = {
  front: string;
  back: string;
  source_page: number | null;
};

export type UsageEntry = {
  task: AiTask;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  duration_ms: number;
  cost_usd: number;
};

export type ProcessResult = {
  summary: { sections: SummarySection[] };
  quiz: { questions: QuizQuestion[] };
  cards: { cards: Flashcard[] };
  usage: UsageEntry[];
  /** Set when the document is not suitable for minors (SP-02). Content is empty then. */
  flagged: { reason: string } | null;
};

export type AiErrorCode =
  /** The provider could not be reached or was overloaded (retry). */
  | 'provider_unavailable'
  /** The output did not match the schema or had too few usable items (retry). */
  | 'invalid_output'
  /** The answer was cut off at max_tokens (retry). */
  | 'truncated'
  /** The model declined the request for policy reasons. */
  | 'refused'
  /** No readable text in the document. */
  | 'empty'
  /** The provider rejected the request (e.g. a damaged or encrypted PDF). */
  | 'bad_request'
  /** Server misconfiguration (missing key, wrong model). */
  | 'server_config';

export const RETRYABLE_CODES: readonly AiErrorCode[] = [
  'provider_unavailable',
  'invalid_output',
  'truncated',
  'server_config',
];

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  /** Usage of the requests that ran before the failure, so the cost is still logged. */
  usage: UsageEntry[] = [];

  constructor(code: AiErrorCode, message: string, retryable = RETRYABLE_CODES.includes(code)) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.retryable = retryable;
  }
}
