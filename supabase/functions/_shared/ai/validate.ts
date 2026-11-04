/**
 * Cleans model output before anyone sees it (AIQ-02, BR-12).
 * Pure functions: input is whatever the model returned, output is safe to store.
 */

import type { Flashcard, QuizQuestion, SummarySection } from './types.ts';

/** Collapses whitespace and trims. Non-strings become ''. */
export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

const LABEL = /^\(?([A-Ea-e])[).:]\s+/;

/**
 * Removes "A) ", "b. ", "(C) " prefixes when every option carries its own letter in order.
 * Models sometimes add them anyway; a single "E. coli" option is left alone.
 */
export function stripOptionLabels(options: string[]): string[] {
  const labelled = options.every((option, index) => {
    const match = LABEL.exec(option);
    return match != null && match[1].toUpperCase() === String.fromCharCode(65 + index);
  });
  return labelled ? options.map((option) => option.replace(LABEL, '').trim()) : options;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** A page inside 1..pageCount, or null. */
export function cleanPage(value: unknown, pageCount: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || (pageCount > 0 && value > pageCount)) return null;
  return value;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export type QuestionRules = {
  /** BR-12: every question must have exactly this many options. */
  optionCount: number;
  /** Keep at most this many. */
  max: number;
  pageCount: number;
};

/**
 * Drops questions with the wrong number of options, empty or repeated options, or a
 * correct_index outside the options; removes repeated stems; trims text.
 */
export function validateQuestions(raw: unknown, rules: QuestionRules): { questions: QuizQuestion[]; dropped: number } {
  const items = asArray(raw);
  const seen = new Set<string>();
  const questions: QuizQuestion[] = [];

  for (const item of items) {
    const q = asRecord(item);
    const stem = cleanText(q.stem);
    const options = stripOptionLabels(asArray(q.options).map(cleanText));
    const correct = q.correct_index;

    if (!stem) continue;
    if (options.length !== rules.optionCount) continue;
    if (options.some((o) => !o)) continue;
    if (new Set(options.map(normalize)).size !== options.length) continue;
    if (typeof correct !== 'number' || !Number.isInteger(correct)) continue;
    if (correct < 0 || correct >= options.length) continue;

    const key = normalize(stem);
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      stem,
      options,
      correct_index: correct,
      explanation: cleanText(q.explanation),
      source_page: cleanPage(q.source_page, rules.pageCount),
      topic: cleanText(q.topic),
    });
    if (questions.length >= rules.max) break;
  }

  return { questions, dropped: items.length - questions.length };
}

export function validateCards(raw: unknown, rules: { max: number; pageCount: number }): { cards: Flashcard[]; dropped: number } {
  const items = asArray(raw);
  const seen = new Set<string>();
  const cards: Flashcard[] = [];

  for (const item of items) {
    const c = asRecord(item);
    const front = cleanText(c.front);
    const back = cleanText(c.back);
    if (!front || !back) continue;

    const key = normalize(front);
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push({ front, back, source_page: cleanPage(c.source_page, rules.pageCount) });
    if (cards.length >= rules.max) break;
  }

  return { cards, dropped: items.length - cards.length };
}

export function validateSummary(raw: unknown, rules: { pageCount: number }): { sections: SummarySection[] } {
  const sections: SummarySection[] = [];

  for (const item of asArray(raw)) {
    const s = asRecord(item);
    const heading = cleanText(s.heading);
    const paragraphs = asArray(s.paragraphs).map(cleanText).filter(Boolean);
    if (!heading || paragraphs.length === 0) continue;

    const terms: string[] = [];
    const seenTerms = new Set<string>();
    for (const term of asArray(s.key_terms).map(cleanText)) {
      const key = normalize(term);
      if (!term || seenTerms.has(key)) continue;
      seenTerms.add(key);
      terms.push(term);
    }

    const pages = [
      ...new Set(
        asArray(s.pages)
          .map((p) => cleanPage(p, rules.pageCount))
          .filter((p): p is number => p != null),
      ),
    ].sort((a, b) => a - b);

    sections.push({ heading, paragraphs, key_terms: terms, pages });
  }

  return { sections };
}

/**
 * The fewest usable items we accept before asking again. Below this the output is treated as
 * invalid (retry), so a student never gets a 2-question quiz.
 */
export function minimumUsable(requested: number): number {
  return Math.max(1, Math.ceil(requested * 0.6));
}
