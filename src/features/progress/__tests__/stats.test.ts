/// <reference types="jest" />
import {
  accuracyByCourse,
  buildProgress,
  currentStreak,
  doneBlocksPerDay,
  minutesByCourse,
  planAdherence,
  streakDays,
  weekStarts,
  weeklyMinutes,
  type AttemptInput,
  type QuestionInput,
} from '../stats';

// Wednesday; the week runs Mon 2 Nov – Sun 8 Nov 2026.
const TODAY = '2026-11-04';

/** ISO timestamp at local noon, so the test does not depend on the machine's time zone. */
function at(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

describe('weeks', () => {
  it('lists the last four Mondays, oldest first', () => {
    expect(weekStarts(TODAY)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
  });

  it('sums minutes per week and ignores older and future sessions', () => {
    const totals = weeklyMinutes(
      [
        { course_id: 'mat', date: '2026-10-11', minutes: 99 }, // before the window
        { course_id: 'mat', date: '2026-10-12', minutes: 30 },
        { course_id: 'fiz', date: '2026-10-25', minutes: 20 },
        { course_id: 'mat', date: '2026-10-27', minutes: 40 },
        { course_id: 'mat', date: '2026-11-02', minutes: 25 },
        { course_id: null, date: '2026-11-04', minutes: 15 },
        { course_id: 'mat', date: '2026-11-05', minutes: 50 }, // tomorrow
      ],
      TODAY,
    );
    expect(totals).toEqual([30, 20, 40, 40]);
  });
});

describe('minutesByCourse (FR-AN-01)', () => {
  it('groups this week by course, keeps last week beside it and sorts by minutes', () => {
    const rows = minutesByCourse(
      [
        { course_id: 'mat', date: '2026-11-02', minutes: 25 },
        { course_id: 'mat', date: '2026-11-03', minutes: 40 },
        { course_id: 'fiz', date: '2026-11-04', minutes: 80 },
        { course_id: 'fiz', date: '2026-10-28', minutes: 30 },
        { course_id: 'kim', date: '2026-10-28', minutes: 30 }, // only last week: hidden
        { course_id: null, date: '2026-11-03', minutes: 10 },
      ],
      TODAY,
    );
    expect(rows).toEqual([
      { courseId: 'fiz', minutes: 80, lastWeek: 30 },
      { courseId: 'mat', minutes: 65, lastWeek: 0 },
      { courseId: null, minutes: 10, lastWeek: 0 },
    ]);
  });
});

describe('planAdherence (FR-AN-03)', () => {
  it('counts blocks due so far and leaves later ones for the rest of the week', () => {
    const result = planAdherence(
      [
        { date: '2026-11-02', status: 'done' },
        { date: '2026-11-02', status: 'skipped' },
        { date: '2026-11-03', status: 'done' },
        { date: '2026-11-04', status: 'planned' },
        { date: '2026-11-06', status: 'done' }, // finished ahead of time
        { date: '2026-11-07', status: 'planned' },
        { date: '2026-11-08', status: 'planned' },
        { date: '2026-11-09', status: 'planned' }, // next week
        { date: '2026-11-01', status: 'done' }, // last week
      ],
      TODAY,
    );
    expect(result).toEqual({ done: 3, planned: 5, remaining: 2, ratio: 3 / 5 });
  });

  it('has no ratio before anything is due', () => {
    expect(planAdherence([{ date: '2026-11-06', status: 'planned' }], TODAY).ratio).toBeNull();
  });
});

describe('doneBlocksPerDay (optik grid)', () => {
  it('counts finished blocks per weekday, Monday first', () => {
    expect(
      doneBlocksPerDay(
        [
          { date: '2026-11-02', status: 'done' },
          { date: '2026-11-02', status: 'done' },
          { date: '2026-11-04', status: 'skipped' },
          { date: '2026-11-08', status: 'done' },
          { date: '2026-11-09', status: 'done' },
        ],
        TODAY,
      ),
    ).toEqual([2, 0, 0, 0, 0, 0, 1]);
  });
});

describe('currentStreak (BR-17)', () => {
  const day = (date: string, blocksDone: number, minutes: number) => ({ date, blocksDone, minutes });

  it('counts back from today over days with a block or 10+ minutes', () => {
    const days = [day('2026-11-04', 1, 0), day('2026-11-03', 0, 10), day('2026-11-02', 0, 9)];
    expect(currentStreak(days, [], TODAY)).toBe(2);
  });

  it('keeps yesterday’s streak while today is not done yet', () => {
    const days = [day('2026-11-03', 1, 0), day('2026-11-02', 1, 0)];
    expect(currentStreak(days, [], TODAY)).toBe(2);
  });

  it('ends after two missed days in a row', () => {
    expect(currentStreak([day('2026-11-01', 2, 60)], [], TODAY)).toBe(0);
  });

  it('bridges a frozen day without adding it', () => {
    const days = [day('2026-11-04', 1, 0), day('2026-11-02', 1, 0), day('2026-11-01', 1, 0)];
    expect(currentStreak(days, [{ date: '2026-11-03', week: '2026-W45' }], TODAY)).toBe(3);
  });

  it('joins minutes and blocks per day', () => {
    const days = streakDays(
      [{ date: '2026-11-04', minutes: 5 }],
      [
        { date: '2026-11-04', blocks: 1 },
        { date: '2026-11-03', blocks: 2 },
      ],
    );
    expect(days).toEqual([
      { date: '2026-11-04', blocksDone: 1, minutes: 5 },
      { date: '2026-11-03', blocksDone: 2, minutes: 0 },
    ]);
  });
});

describe('accuracyByCourse (FR-AN-02)', () => {
  const questions = new Map<string, QuestionInput>(
    [
      { id: 'q1', correct_index: 0, topic: 'Hücre' },
      { id: 'q2', correct_index: 1, topic: 'hücre ' },
      { id: 'q3', correct_index: 2, topic: 'Kalıtım' },
      { id: 'q4', correct_index: 3, topic: null },
    ].map((q) => [q.id, q]),
  );

  const attempt = (
    date: string,
    answers: Record<string, number | null>,
    extra: Partial<AttemptInput> = {},
  ): AttemptInput => ({
    course_id: 'bio',
    finished_at: at(date),
    question_ids: JSON.stringify(Object.keys(answers)),
    answers: JSON.stringify(answers),
    retry_of: null,
    ...extra,
  });

  it('checks each answer against the correct option and groups topics case-insensitively', () => {
    const [bio] = accuracyByCourse(
      [attempt('2026-11-03', { q1: 0, q2: 0, q3: 2, q4: null })],
      questions,
      TODAY,
    );
    expect(bio.courseId).toBe('bio');
    expect(bio.correct).toBe(2);
    expect(bio.total).toBe(4); // the blank counts as not correct
    expect(bio.ratio).toBe(0.5);
    expect(bio.topics.map((t) => [t.topic, t.correct, t.total])).toEqual([
      ['Hücre', 1, 2],
      ['Kalıtım', 1, 1],
    ]);
  });

  it('reports the change in points from the first to the last week with answers', () => {
    const [bio] = accuracyByCourse(
      [
        attempt('2026-10-13', { q1: 0, q2: 0, q3: 0, q4: 0 }), // 1/4 = 25%
        attempt('2026-11-02', { q1: 0, q2: 1, q3: 2, q4: 0 }), // 3/4 = 75%
      ],
      questions,
      TODAY,
    );
    expect(bio.weekly).toEqual([0.25, null, null, 0.75]);
    expect(bio.change).toBe(50);
    expect(bio.ratio).toBe(0.5);
  });

  it('has no change with a single week of answers', () => {
    const [bio] = accuracyByCourse([attempt('2026-11-02', { q1: 0 })], questions, TODAY);
    expect(bio.change).toBeNull();
  });

  it('skips retries, attempts outside the window, unknown questions and bad JSON', () => {
    const result = accuracyByCourse(
      [
        attempt('2026-11-03', { q1: 1 }, { retry_of: 'a1' }),
        attempt('2026-10-01', { q1: 0 }),
        attempt('2026-11-03', { removed: 0 }),
        { ...attempt('2026-11-03', { q1: 0 }), answers: 'not json', question_ids: '{' },
      ],
      questions,
      TODAY,
    );
    expect(result).toEqual([]);
  });
});

describe('buildProgress', () => {
  it('puts the pieces together', () => {
    const stats = buildProgress(
      {
        sessions: [{ course_id: 'mat', date: '2026-11-03', minutes: 30 }],
        planItems: [{ date: '2026-11-03', status: 'done' }],
        attempts: [],
        questions: [],
        minutesPerDay: [{ date: '2026-11-03', minutes: 30 }],
        blocksPerDay: [{ date: '2026-11-03', blocks: 1 }],
        freezes: [],
        hasHistory: true,
      },
      TODAY,
    );
    expect(stats.weekStart).toBe('2026-11-02');
    expect(stats.weekMinutes).toBe(30);
    expect(stats.streak).toBe(1);
    expect(stats.adherence.ratio).toBe(1);
    expect(stats.blocksPerDay).toEqual([0, 1, 0, 0, 0, 0, 0]);
    expect(stats.accuracy).toEqual([]);
  });
});
