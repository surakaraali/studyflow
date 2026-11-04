import { getDb } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import type { Question, Quiz, QuizAttempt } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';

import {
  parseAnswers,
  parseIds,
  playableQuestionIds,
  retryQuestionIds,
  scoreAttempt,
  type Answers,
} from './scoring';

/** Questions this user reported and the team has not decided on yet (BR-23). */
const OPEN_REPORTED = `SELECT item_id FROM content_reports
  WHERE item_type = 'question' AND status = 'open' AND deleted_at IS NULL`;

export async function getQuiz(id: string): Promise<Quiz | null> {
  return getDb().getFirstAsync<Quiz>('SELECT * FROM quizzes WHERE id = ? AND deleted_at IS NULL', id);
}

/** Questions the player may show: not deleted, not hidden, not reported by this user. */
export async function listPlayableQuestions(quizId: string): Promise<Question[]> {
  return getDb().getAllAsync<Question>(
    `SELECT * FROM questions
     WHERE quiz_id = ? AND deleted_at IS NULL AND hidden = 0 AND id NOT IN (${OPEN_REPORTED})
     ORDER BY sort, created_at`,
    quizId,
  );
}

export async function getQuestion(id: string): Promise<Question | null> {
  return getDb().getFirstAsync<Question>(
    'SELECT * FROM questions WHERE id = ? AND deleted_at IS NULL',
    id,
  );
}

/** Every question of an attempt, even ones deleted later (the result screen still lists them). */
export async function listQuestionsByIds(ids: readonly string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => '?').join(', ');
  return getDb().getAllAsync<Question>(`SELECT * FROM questions WHERE id IN (${marks})`, ...ids);
}

export async function getAttempt(id: string): Promise<QuizAttempt | null> {
  return getDb().getFirstAsync<QuizAttempt>(
    'SELECT * FROM quiz_attempts WHERE id = ? AND deleted_at IS NULL',
    id,
  );
}

async function findOpenAttempt(quizId: string, retryOf: string | null) {
  return getDb().getFirstAsync<QuizAttempt>(
    `SELECT * FROM quiz_attempts
     WHERE quiz_id = ? AND status = 'in_progress' AND deleted_at IS NULL
       AND ${retryOf ? 'retry_of = ?' : 'retry_of IS NULL'}
     ORDER BY started_at DESC LIMIT 1`,
    ...(retryOf ? [quizId, retryOf] : [quizId]),
  );
}

async function createAttempt(quizId: string, questionIds: string[], retryOf: string | null) {
  const now = nowIso();
  const attempt = {
    id: newId(),
    quiz_id: quizId,
    question_ids: JSON.stringify(questionIds),
    answers: '{}',
    current_index: 0,
    status: 'in_progress' as const,
    correct: 0,
    wrong: 0,
    blank: 0,
    duration_sec: 0,
    retry_of: retryOf,
    started_at: now,
    finished_at: null,
  };
  await upsert('quiz_attempts', attempt);
  return (await getAttempt(attempt.id)) as QuizAttempt;
}

// Opening the same quiz twice at once (fast double tap, dev double effects) must not
// start two attempts.
const pending = new Map<string, Promise<QuizAttempt | null>>();

/**
 * The attempt to play (US-41): the unfinished one if there is one (resume), otherwise a new
 * attempt. With `retryOf`, the new attempt asks only the wrong and blank questions of that
 * finished attempt (US-42). Returns null when there is nothing to ask.
 */
export function openAttempt(quizId: string, retryOf: string | null): Promise<QuizAttempt | null> {
  const key = `${quizId}:${retryOf ?? ''}`;
  const running = pending.get(key);
  if (running) return running;

  const task = (async () => {
    const open = await findOpenAttempt(quizId, retryOf);
    if (open) return open;

    const playable = await listPlayableQuestions(quizId);
    let ids = playableQuestionIds(playable);

    if (retryOf) {
      const previous = await getAttempt(retryOf);
      if (!previous) return null;
      const previousIds = parseIds(previous.question_ids);
      const wrong = retryQuestionIds(previousIds, playable, parseAnswers(previous.answers));
      ids = wrong;
    }

    if (ids.length === 0) return null;
    return createAttempt(quizId, ids, retryOf);
  })().finally(() => pending.delete(key));

  pending.set(key, task);
  return task;
}

export async function saveAttemptProgress(
  attemptId: string,
  changes: { questionIds?: string[]; answers?: Answers; currentIndex?: number; durationSec?: number },
) {
  const row: Record<string, unknown> = {};
  if (changes.questionIds) row.question_ids = JSON.stringify(changes.questionIds);
  if (changes.answers) row.answers = JSON.stringify(changes.answers);
  if (changes.currentIndex != null) row.current_index = changes.currentIndex;
  if (changes.durationSec != null) row.duration_sec = Math.round(changes.durationSec);
  if (Object.keys(row).length === 0) return;
  await patch('quiz_attempts', attemptId, row);
}

/** Stores the final counts; the Progress screen reads them from quiz_attempts (FR-AN-02). */
export async function finishAttempt(
  attempt: QuizAttempt,
  questionIds: string[],
  answers: Answers,
  durationSec: number,
) {
  const questions = await listQuestionsByIds(questionIds);
  const score = scoreAttempt(questionIds, questions, answers);
  await patch('quiz_attempts', attempt.id, {
    question_ids: JSON.stringify(questionIds),
    answers: JSON.stringify(answers),
    current_index: questionIds.length,
    status: 'done',
    correct: score.correct,
    wrong: score.wrong,
    blank: score.blank,
    duration_sec: Math.round(durationSec),
    finished_at: nowIso(),
  });
}

/** An attempt with nothing left to ask (every question was reported or deleted). */
export async function discardAttempt(attemptId: string) {
  await softDelete('quiz_attempts', attemptId);
}

/** US-36: saves an edited question and marks it "Düzenlendi". */
export async function saveQuestion(
  id: string,
  changes: Pick<Question, 'stem' | 'correct_index' | 'explanation'> & { options: string[] },
) {
  await patch('questions', id, {
    stem: changes.stem,
    options: JSON.stringify(changes.options),
    correct_index: changes.correct_index,
    explanation: changes.explanation,
    edited: 1,
  });
}

export async function deleteQuestion(id: string) {
  await softDelete('questions', id);
}
