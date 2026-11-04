import type { Question, Quiz, QuizAttempt } from '@/db/types';

import {
  discardAttempt,
  finishAttempt,
  getQuiz,
  listPlayableQuestions,
  listQuestionsByIds,
  openAttempt,
} from './repo';
import { dropQuestion, parseAnswers, parseIds, type Answers } from './scoring';

/** Time on task: seconds already saved plus the stretch running since the last start. */
export class AttemptClock {
  private base = 0;
  private since: number | null = null;

  start(savedSeconds: number) {
    this.base = savedSeconds;
    this.since = Date.now();
  }

  pause() {
    this.base = this.seconds();
    this.since = null;
  }

  resume() {
    if (this.since == null) this.since = Date.now();
  }

  seconds(): number {
    return this.base + (this.since != null ? (Date.now() - this.since) / 1000 : 0);
  }
}

export type PlayerState = {
  quiz: Quiz;
  attempt: QuizAttempt;
  questions: Map<string, Question>;
  ids: string[];
  answers: Answers;
  index: number;
  resumed: boolean;
};

export type LoadResult =
  | { kind: 'missing' }
  | { kind: 'empty' }
  | { kind: 'finished'; attemptId: string }
  | { kind: 'ready'; state: PlayerState };

/**
 * Opens (or resumes) the attempt for the player. Questions reported, hidden or deleted since
 * the attempt started are dropped; an attempt that has nothing left to ask is finished.
 */
export async function loadPlayer(quizId: string, retryOf: string | null): Promise<LoadResult> {
  const quiz = await getQuiz(quizId);
  if (!quiz) return { kind: 'missing' };
  const attempt = await openAttempt(quizId, retryOf);
  if (!attempt) return { kind: 'empty' };

  let ids = parseIds(attempt.question_ids);
  let answers = parseAnswers(attempt.answers);
  let index = attempt.current_index;

  const playable = new Set((await listPlayableQuestions(quizId)).map((q) => q.id));
  for (const qid of [...ids]) {
    if (!playable.has(qid)) ({ ids, answers, currentIndex: index } = dropQuestion(ids, answers, index, qid));
  }

  if (ids.length === 0) {
    await discardAttempt(attempt.id);
    return { kind: 'empty' };
  }
  if (index >= ids.length) {
    await finishAttempt(attempt, ids, answers, attempt.duration_sec);
    return { kind: 'finished', attemptId: attempt.id };
  }

  const rows = await listQuestionsByIds(ids);
  return {
    kind: 'ready',
    state: {
      quiz,
      attempt,
      questions: new Map(rows.map((q) => [q.id, q])),
      ids,
      answers,
      index,
      resumed: index > 0 || Object.keys(answers).length > 0,
    },
  };
}
