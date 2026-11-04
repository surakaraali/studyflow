/**
 * Quiz attempt logic (US-41, US-42) as pure functions: parsing the JSON columns,
 * scoring, per-topic results and picking the questions for "solve the wrong ones again".
 */

import type { Question } from '@/db/types';

/** Answer-sheet letters; BR-12 allows at most five options. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Question id → chosen option index, or null when the student left it blank. */
export type Answers = Record<string, number | null>;

export type ScoredQuestion = Pick<Question, 'id' | 'correct_index' | 'topic'>;

export type TopicResult = {
  topic: string | null;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
};

export type Score = {
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  topics: TopicResult[];
};

export function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseOptions(value: string | null | undefined): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map((o) => String(o ?? '')) : [];
}

export function parseIds(value: string | null | undefined): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

export function parseAnswers(value: string | null | undefined): Answers {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const answers: Answers = {};
  for (const [id, choice] of Object.entries(parsed as Record<string, unknown>)) {
    answers[id] = typeof choice === 'number' ? choice : null;
  }
  return answers;
}

export type Outcome = 'correct' | 'wrong' | 'blank';

/** A question the student never reached counts as blank. */
export function outcome(question: ScoredQuestion, answers: Answers): Outcome {
  const choice = answers[question.id];
  if (choice == null) return 'blank';
  return choice === question.correct_index ? 'correct' : 'wrong';
}

/**
 * Scores an attempt over `questionIds` (the attempt's order). Ids whose question
 * no longer exists (deleted or hidden after a report) are left out of the total.
 */
export function scoreAttempt(
  questionIds: readonly string[],
  questions: readonly ScoredQuestion[],
  answers: Answers,
): Score {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const topics = new Map<string, TopicResult>();
  const score: Score = { correct: 0, wrong: 0, blank: 0, total: 0, topics: [] };

  for (const id of questionIds) {
    const question = byId.get(id);
    if (!question) continue;
    const result = outcome(question, answers);
    score[result] += 1;
    score.total += 1;

    const topic = question.topic?.trim() || null;
    const key = topic ?? '';
    const entry = topics.get(key) ?? { topic, correct: 0, wrong: 0, blank: 0, total: 0 };
    entry[result] += 1;
    entry.total += 1;
    topics.set(key, entry);
  }

  // Weakest topics first, so the student sees what to work on.
  score.topics = [...topics.values()].sort(
    (a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total,
  );
  return score;
}

/** US-42: questions answered wrong or left blank, in the order they were asked. */
export function retryQuestionIds(
  questionIds: readonly string[],
  questions: readonly ScoredQuestion[],
  answers: Answers,
): string[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return questionIds.filter((id) => {
    const question = byId.get(id);
    return question != null && outcome(question, answers) !== 'correct';
  });
}

/** Questions a new attempt asks: not deleted, not hidden, in quiz order. */
export function playableQuestionIds(
  questions: readonly Pick<Question, 'id' | 'sort' | 'hidden' | 'deleted_at'>[],
  hiddenIds: ReadonlySet<string> = new Set(),
): string[] {
  return questions
    .filter((q) => !q.hidden && q.deleted_at == null && !hiddenIds.has(q.id))
    .sort((a, b) => a.sort - b.sort)
    .map((q) => q.id);
}

/** Removes a question from an in-progress attempt (it was reported or deleted). */
export function dropQuestion(
  ids: readonly string[],
  answers: Answers,
  currentIndex: number,
  questionId: string,
): { ids: string[]; answers: Answers; currentIndex: number } {
  const position = ids.indexOf(questionId);
  if (position === -1) return { ids: [...ids], answers: { ...answers }, currentIndex };
  const nextIds = ids.filter((id) => id !== questionId);
  const nextAnswers = { ...answers };
  delete nextAnswers[questionId];
  // Questions after the removed one slide up by one.
  const nextIndex = position < currentIndex ? currentIndex - 1 : currentIndex;
  return { ids: nextIds, answers: nextAnswers, currentIndex: Math.min(nextIndex, nextIds.length) };
}

/** Whole seconds → minutes and seconds, for "4 dk 12 sn". */
export function splitDuration(totalSec: number): { minutes: number; seconds: number } {
  const safe = Math.max(0, Math.round(totalSec));
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
}
