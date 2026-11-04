/**
 * JSON schemas for structured outputs (AIQ-02).
 *
 * The summary, quiz and card requests share ONE output schema on purpose: the output format is
 * part of the prompt prefix, so three different schemas would give three different prefixes and
 * the cached PDF could not be reused (US-32). Each request fills only its own list and leaves
 * the other two empty; the task prompt says which one.
 *
 * Keep the schema simple (objects, arrays, strings, integers, booleans) and closed with
 * `additionalProperties: false`.
 */

import type { Flashcard, QuizQuestion, SummarySection } from './types.ts';

const stringArray = { type: 'array', items: { type: 'string' } } as const;

const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['heading', 'paragraphs', 'key_terms', 'pages'],
  properties: {
    heading: { type: 'string' },
    paragraphs: stringArray,
    key_terms: stringArray,
    pages: { type: 'array', items: { type: 'integer' } },
  },
} as const;

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['stem', 'options', 'correct_index', 'explanation', 'source_page', 'topic'],
  properties: {
    stem: { type: 'string' },
    options: stringArray,
    correct_index: { type: 'integer' },
    explanation: { type: 'string' },
    source_page: { type: 'integer' },
    topic: { type: 'string' },
  },
} as const;

const cardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['front', 'back', 'source_page'],
  properties: {
    front: { type: 'string' },
    back: { type: 'string' },
    source_page: { type: 'integer' },
  },
} as const;

export const STUDY_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['flagged', 'flag_reason', 'sections', 'questions', 'cards'],
  properties: {
    flagged: { type: 'boolean' },
    flag_reason: { type: 'string' },
    sections: { type: 'array', items: sectionSchema },
    questions: { type: 'array', items: questionSchema },
    cards: { type: 'array', items: cardSchema },
  },
} as const;

/** What the model returns for any of the three tasks (before validation). */
export type StudyOutput = {
  flagged: boolean;
  flag_reason: string;
  sections: SummarySection[];
  questions: QuizQuestion[];
  cards: Flashcard[];
};

/** Per-task views of the shared output. */
export type SummaryOutput = Pick<StudyOutput, 'sections' | 'flagged' | 'flag_reason'>;
export type QuizOutput = Pick<StudyOutput, 'questions' | 'flagged' | 'flag_reason'>;
export type CardsOutput = Pick<StudyOutput, 'cards' | 'flagged' | 'flag_reason'>;
