import { describe, expect, it } from '@jest/globals';

import {
  dropQuestion,
  optionLetter,
  outcome,
  parseAnswers,
  parseIds,
  parseOptions,
  playableQuestionIds,
  retryQuestionIds,
  scoreAttempt,
  splitDuration,
  type ScoredQuestion,
} from '../scoring';

const questions: ScoredQuestion[] = [
  { id: 'q1', correct_index: 0, topic: 'Hücre' },
  { id: 'q2', correct_index: 2, topic: 'Hücre' },
  { id: 'q3', correct_index: 1, topic: 'Kalıtım' },
  { id: 'q4', correct_index: 3, topic: null },
  { id: 'q5', correct_index: 1, topic: 'Kalıtım' },
];
const order = ['q1', 'q2', 'q3', 'q4', 'q5'];

describe('JSON columns', () => {
  it('parses options, ids and answers and survives bad data', () => {
    expect(parseOptions('["a","b"]')).toEqual(['a', 'b']);
    expect(parseOptions('not json')).toEqual([]);
    expect(parseIds('["q1",2,"q3"]')).toEqual(['q1', 'q3']);
    expect(parseAnswers('{"q1":2,"q2":null,"q3":"x"}')).toEqual({ q1: 2, q2: null, q3: null });
    expect(parseAnswers('[1,2]')).toEqual({});
    expect(parseAnswers(null)).toEqual({});
  });

  it('labels options like an answer sheet', () => {
    expect([0, 1, 2, 3, 4].map(optionLetter)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('US-42 scoring', () => {
  it('counts correct, wrong and blank (unanswered counts as blank)', () => {
    const answers = { q1: 0, q2: 1, q3: null, q5: 1 };
    expect(outcome(questions[0], answers)).toBe('correct');
    expect(outcome(questions[1], answers)).toBe('wrong');
    expect(outcome(questions[2], answers)).toBe('blank');
    expect(outcome(questions[3], answers)).toBe('blank');

    const score = scoreAttempt(order, questions, answers);
    expect(score).toMatchObject({ correct: 2, wrong: 1, blank: 2, total: 5 });
  });

  it('breaks the result down by topic, weakest first', () => {
    const score = scoreAttempt(order, questions, { q1: 0, q2: 2, q3: 0, q4: 3, q5: null });
    expect(score.topics).toEqual([
      { topic: 'Kalıtım', correct: 0, wrong: 1, blank: 1, total: 2 },
      { topic: 'Hücre', correct: 2, wrong: 0, blank: 0, total: 2 },
      { topic: null, correct: 1, wrong: 0, blank: 0, total: 1 },
    ]);
  });

  it('ignores questions that were removed after the attempt started', () => {
    const score = scoreAttempt(['q1', 'gone'], questions, { q1: 0, gone: 1 });
    expect(score).toMatchObject({ correct: 1, wrong: 0, blank: 0, total: 1 });
  });
});

describe('US-42 solve the wrong ones again', () => {
  it('keeps wrong and blank questions in the original order', () => {
    const answers = { q1: 0, q2: 1, q4: 3, q5: 0 };
    expect(retryQuestionIds(order, questions, answers)).toEqual(['q2', 'q3', 'q5']);
  });

  it('returns nothing when everything was right', () => {
    expect(retryQuestionIds(['q1', 'q2'], questions, { q1: 0, q2: 2 })).toEqual([]);
  });
});

describe('attempt helpers', () => {
  it('asks only visible questions, in quiz order', () => {
    const rows = [
      { id: 'b', sort: 2, hidden: 0 as const, deleted_at: null },
      { id: 'a', sort: 1, hidden: 0 as const, deleted_at: null },
      { id: 'hidden', sort: 3, hidden: 1 as const, deleted_at: null },
      { id: 'deleted', sort: 4, hidden: 0 as const, deleted_at: '2026-11-01T00:00:00Z' },
      { id: 'reported', sort: 5, hidden: 0 as const, deleted_at: null },
    ];
    expect(playableQuestionIds(rows, new Set(['reported']))).toEqual(['a', 'b']);
  });

  it('drops a reported question and keeps the place in the quiz', () => {
    const before = { q1: 0, q2: 1, q3: null };
    // Reporting the current question (index 2): the next one slides into its place.
    expect(dropQuestion(order, before, 2, 'q3')).toEqual({
      ids: ['q1', 'q2', 'q4', 'q5'],
      answers: { q1: 0, q2: 1 },
      currentIndex: 2,
    });
    // Removing an earlier question moves the pointer back by one.
    expect(dropQuestion(order, before, 3, 'q1').currentIndex).toBe(2);
    // Unknown ids change nothing.
    expect(dropQuestion(order, before, 1, 'nope').ids).toEqual(order);
  });

  it('splits a duration into minutes and seconds', () => {
    expect(splitDuration(252)).toEqual({ minutes: 4, seconds: 12 });
    expect(splitDuration(-3)).toEqual({ minutes: 0, seconds: 0 });
  });
});
