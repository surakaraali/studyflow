import { addDays, isWeekend } from '../../lib/dates';
import plan from '../../i18n/tr/plan';
import {
  accuracyFactor,
  difficultyFactor,
  examUrgency,
  findNextFreeSlot,
  generatePlan,
  isReplaceable,
  parseTime,
  type EngineItem,
  type NewBlock,
  type PlanInput,
  type PlanResult,
} from '../plan-engine';
import { dailyCapMinutes, segmentForGrade, toMinutes } from '../rules';

// 2026-11-09 is a Monday.
const MON = '2026-11-09';
const TUE = addDays(MON, 1);
const WED = addDays(MON, 2);
const THU = addDays(MON, 3);
const FRI = addDays(MON, 4);

function at(date: string, time = '07:00'): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const SCHOOL = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '08:30', end: '15:10' }));

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    now: at(MON),
    profile: { segment: 'lise' },
    timetable: SCHOOL,
    availability: {
      weekday: [{ start: '16:00', end: '22:00' }],
      weekend: [{ start: '10:00', end: '20:00' }],
    },
    courses: [{ id: 'fizik' }, { id: 'kimya' }],
    topics: [
      { id: 'f1', courseId: 'fizik', difficulty: 3 },
      { id: 'f2', courseId: 'fizik', difficulty: 2 },
      { id: 'k1', courseId: 'kimya', difficulty: 2 },
    ],
    exams: [],
    homework: [],
    existing: [],
    ...overrides,
  };
}

function item(overrides: Partial<EngineItem> & { id: string; date: string; start: string }): EngineItem {
  const minutes = overrides.minutes ?? 40;
  return {
    end: overrides.end ?? fromMin(toMinutes(overrides.start) + minutes),
    minutes,
    breakMin: 10,
    kind: 'study',
    courseId: 'fizik',
    topicId: null,
    examId: null,
    homeworkId: null,
    status: 'planned',
    source: 'auto',
    carriedFrom: null,
    ...overrides,
  };
}

function fromMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Everything that will sit on a day after applying the result: new blocks and moved blocks. */
function onDay(result: PlanResult, date: string) {
  return [
    ...result.blocks.filter((b) => b.date === date),
    ...result.moves.filter((m) => m.date === date),
  ];
}

function minutesOn(result: PlanResult, date: string) {
  return onDay(result, date).reduce((sum, b) => sum + b.minutes, 0);
}

function overlaps(block: { start: string; end: string }, from: string, to: string) {
  return toMinutes(block.start) < toMinutes(to) && toMinutes(block.end) > toMinutes(from);
}

describe('US-48 plan engine v1', () => {
  describe('Senaryo: Yaklaşan sınav önceliği', () => {
    // Diyelim ki 11. sınıftayım ve 4 gün sonra Fizik yazılım var
    // Ve 20 gün sonra Kimya yazılım var
    // Eğer ki plan üretilirse
    const result = generatePlan(
      input({
        profile: { segment: segmentForGrade(11) },
        exams: [
          { id: 'fizik-yazili', courseId: 'fizik', date: addDays(MON, 4), topicIds: ['f1'] },
          { id: 'kimya-yazili', courseId: 'kimya', date: addDays(MON, 20), topicIds: [] },
        ],
      }),
    );
    const next3: NewBlock[] = result.blocks.filter((b) => [MON, TUE, WED].includes(b.date));

    it('O zaman önümüzdeki 3 günde Fizik blokları Kimya bloklarından fazladır', () => {
      const fizik = next3.filter((b) => b.courseId === 'fizik').length;
      const kimya = next3.filter((b) => b.courseId === 'kimya').length;
      expect(fizik).toBeGreaterThan(0);
      expect(fizik).toBeGreaterThan(kimya);
    });

    it('Ve sınavdan önceki gün yalnızca Fizik tekrar blokları bulunur', () => {
      const eve = result.blocks.filter((b) => b.date === THU);
      expect(eve.length).toBeGreaterThan(0);
      for (const block of eve) {
        expect(block.courseId).toBe('fizik');
        expect(block.kind).toBe('review');
        expect(block.examId).toBe('fizik-yazili');
      }
    });

    it('Ve sınav gününe Fizik bloğu konmaz', () => {
      const examDay = result.blocks.filter((b) => b.date === FRI);
      expect(examDay.some((b) => b.courseId === 'fizik')).toBe(false);
    });

    it('studies the exam topics before the exam', () => {
      const fizikStudy = result.blocks.filter((b) => b.courseId === 'fizik' && b.date < FRI);
      expect(fizikStudy.every((b) => b.topicId === 'f1')).toBe(true);
    });
  });

  describe('Senaryo: Günlük üst sınır', () => {
    // Diyelim ki ortaokul öğrencisiyim
    // Eğer ki plan üretilirse
    const result = generatePlan(
      input({
        profile: { segment: 'ortaokul' },
        timetable: [],
        availability: {
          weekday: [{ start: '09:00', end: '21:30' }],
          weekend: [{ start: '09:00', end: '21:30' }],
        },
        courses: [{ id: 'mat' }, { id: 'fen' }, { id: 'turkce' }],
        topics: [],
        // Exams within 7 days push the days up to the cap.
        exams: [
          { id: 'e1', courseId: 'mat', date: addDays(MON, 5), topicIds: [] },
          { id: 'e2', courseId: 'fen', date: addDays(MON, 11), topicIds: [] },
          { id: 'e3', courseId: 'turkce', date: addDays(MON, 16), topicIds: [] },
        ],
      }),
    );

    it('O zaman hiçbir hafta içi günün toplam blok süresi 150 dakikayı geçmez', () => {
      let busiest = 0;
      for (let i = 0; i < 14; i++) {
        const date = addDays(MON, i);
        if (isWeekend(date)) continue;
        const total = minutesOn(result, date);
        expect(total).toBeLessThanOrEqual(150);
        busiest = Math.max(busiest, total);
      }
      // The cap, not the free time, is what stops the day.
      expect(busiest).toBe(150);
    });

    it('Ve her blok 25 dakika çalışma ve 5 dakika moladan oluşur', () => {
      expect(result.blocks.length).toBeGreaterThan(0);
      for (const block of result.blocks) {
        expect(block.minutes).toBe(25);
        expect(block.breakMin).toBe(5);
        expect(toMinutes(block.end) - toMinutes(block.start)).toBe(25);
      }
    });

    it('leaves a break between blocks', () => {
      for (let i = 0; i < 14; i++) {
        const day = result.blocks
          .filter((b) => b.date === addDays(MON, i))
          .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
        for (let j = 1; j < day.length; j++) {
          expect(toMinutes(day[j].start) - toMinutes(day[j - 1].end)).toBeGreaterThanOrEqual(5);
        }
      }
    });
  });

  it('weekend cap is 25% higher (BR-08)', () => {
    const result = generatePlan(
      input({
        timetable: [],
        availability: {
          weekday: [{ start: '08:00', end: '23:00' }],
          weekend: [{ start: '08:00', end: '23:00' }],
        },
        exams: [{ id: 'e', courseId: 'fizik', date: addDays(MON, 7), topicIds: [] }],
      }),
    );
    const saturday = addDays(MON, 5);
    expect(dailyCapMinutes('lise', true)).toBe(375);
    expect(minutesOn(result, saturday)).toBeLessThanOrEqual(375);
    expect(minutesOn(result, saturday)).toBeGreaterThan(300);
    expect(minutesOn(result, TUE)).toBeLessThanOrEqual(300);
  });

  it('a parent may lower the cap', () => {
    const result = generatePlan(
      input({
        profile: { segment: 'lise', dailyCapOverride: 100 },
        exams: [{ id: 'e', courseId: 'fizik', date: addDays(MON, 6), topicIds: [] }],
      }),
    );
    for (let i = 0; i < 14; i++) expect(minutesOn(result, addDays(MON, i))).toBeLessThanOrEqual(100);
  });

  it('days without a near exam aim for the daily goal', () => {
    const result = generatePlan(input({ profile: { segment: 'lise', dailyGoalMin: 80 } }));
    for (let i = 0; i < 14; i++) expect(minutesOn(result, addDays(MON, i))).toBe(80);
  });

  it('US-23: no block in school hours on Monday 08:30–15:10', () => {
    const result = generatePlan(
      input({
        timetable: [{ weekday: 1, start: '08:30', end: '15:10' }],
        availability: {
          weekday: [{ start: '07:00', end: '22:00' }],
          weekend: [{ start: '07:00', end: '22:00' }],
        },
        exams: [{ id: 'e', courseId: 'fizik', date: addDays(MON, 10), topicIds: [] }],
        profile: { segment: 'lise', dailyGoalMin: 300 },
      }),
    );
    const mondays = result.blocks.filter((b) => b.date === MON || b.date === addDays(MON, 7));
    expect(mondays.length).toBeGreaterThan(0);
    for (const block of mondays) expect(overlaps(block, '08:30', '15:10')).toBe(false);
    // Tuesday has no school in this timetable, so the morning is free.
    expect(result.blocks.some((b) => b.date === TUE && overlaps(b, '08:30', '15:10'))).toBe(true);
  });

  it('treats short gaps between lessons as school time', () => {
    const result = generatePlan(
      input({
        timetable: [
          { weekday: 1, start: '08:30', end: '12:00' },
          { weekday: 1, start: '13:00', end: '15:10' },
        ],
        availability: { weekday: [{ start: '08:00', end: '22:00' }], weekend: [] },
        profile: { segment: 'lise', dailyGoalMin: 300 },
      }),
    );
    const monday = result.blocks.filter((b) => b.date === MON);
    expect(monday.some((b) => overlaps(b, '12:00', '13:00'))).toBe(false);
  });

  it('BR-09: no block before wake-up or after bedtime', () => {
    const result = generatePlan(
      input({
        now: at(MON, '05:00'),
        profile: { segment: 'ortaokul', bedtime: '22:00', wakeTime: '07:00', dailyGoalMin: 150 },
        timetable: [],
        availability: {
          weekday: [{ start: '05:00', end: '23:59' }],
          weekend: [{ start: '05:00', end: '23:59' }],
        },
      }),
    );
    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(toMinutes(block.start)).toBeGreaterThanOrEqual(toMinutes('07:00'));
      expect(toMinutes(block.end)).toBeLessThanOrEqual(toMinutes('22:00'));
    }
  });

  it('a bedtime after midnight plans until midnight at the latest', () => {
    const result = generatePlan(
      input({
        profile: { segment: 'lise', bedtime: '00:30', wakeTime: '07:00', dailyGoalMin: 300 },
        timetable: [],
        availability: { weekday: [{ start: '21:00', end: '00:00' }], weekend: [] },
      }),
    );
    const monday = result.blocks.filter((b) => b.date === MON);
    expect(monday.length).toBeGreaterThan(0);
    expect(monday.every((b) => toMinutes(b.end) <= 24 * 60)).toBe(true);
  });

  it('only plans inside the availability ranges', () => {
    const result = generatePlan(
      input({
        availability: {
          weekday: [
            { start: '17:00', end: '18:00' },
            { start: '20:00', end: '21:00' },
          ],
          weekend: [],
        },
        profile: { segment: 'lise', dailyGoalMin: 300 },
      }),
    );
    for (const block of result.blocks) {
      expect(isWeekend(block.date)).toBe(false);
      const inFirst = toMinutes(block.start) >= 17 * 60 && toMinutes(block.end) <= 18 * 60;
      const inSecond = toMinutes(block.start) >= 20 * 60 && toMinutes(block.end) <= 21 * 60;
      expect(inFirst || inSecond).toBe(true);
    }
  });

  it('today only gets blocks after now', () => {
    const result = generatePlan(input({ now: at(MON, '18:05') }));
    const today = result.blocks.filter((b) => b.date === MON);
    expect(today.every((b) => toMinutes(b.start) >= toMinutes('18:05'))).toBe(true);
  });

  it('keeps the slot grid stable when the app opens again later', () => {
    const early = generatePlan(input({ now: at(MON, '07:00') }));
    const later = generatePlan(input({ now: at(MON, '16:30') }));
    const tomorrowEarly = early.blocks.filter((b) => b.date === TUE).map((b) => b.start);
    const tomorrowLater = later.blocks.filter((b) => b.date === TUE).map((b) => b.start);
    expect(tomorrowLater).toEqual(tomorrowEarly);
  });

  it('is deterministic', () => {
    const make = () =>
      input({
        exams: [{ id: 'e', courseId: 'kimya', date: addDays(MON, 6), topicIds: ['k1'] }],
        homework: [{ id: 'h', courseId: 'fizik', dueDate: addDays(MON, 3), done: false }],
        existing: [item({ id: 'old', date: addDays(MON, -1), start: '16:00' })],
        accuracy: { course: { fizik: 0.4 }, topic: { f2: 0.2 } },
      });
    expect(generatePlan(make())).toEqual(generatePlan(make()));
  });

  it('spreads courses: never more than 2 of the same course in a row', () => {
    const result = generatePlan(
      input({
        courses: [{ id: 'fizik' }, { id: 'kimya' }, { id: 'bio' }],
        exams: [{ id: 'e', courseId: 'fizik', date: addDays(MON, 6), topicIds: [] }],
      }),
    );
    for (let i = 0; i < 14; i++) {
      const day = result.blocks.filter((b) => b.date === addDays(MON, i) && b.kind === 'study');
      for (let j = 2; j < day.length; j++) {
        const same = day[j].courseId === day[j - 1].courseId && day[j].courseId === day[j - 2].courseId;
        expect(same).toBe(false);
      }
    }
    // Over two weeks every course shows up.
    for (const id of ['fizik', 'kimya', 'bio']) {
      expect(result.blocks.some((b) => b.courseId === id)).toBe(true);
    }
  });

  it('goes back to a balanced rotation once an exam is over', () => {
    const result = generatePlan(
      input({ exams: [{ id: 'f', courseId: 'fizik', date: WED, topicIds: [] }] }),
    );
    const after = result.blocks.filter((b) => b.date > WED && b.date <= addDays(WED, 7));
    const fizik = after.filter((b) => b.courseId === 'fizik').length;
    const kimya = after.filter((b) => b.courseId === 'kimya').length;
    expect(Math.abs(fizik - kimya)).toBeLessThanOrEqual(3);
  });

  it('BR-11: low accuracy and hard topics get more blocks', () => {
    const result = generatePlan(
      input({
        topics: [
          { id: 'f1', courseId: 'fizik', difficulty: 3 },
          { id: 'k1', courseId: 'kimya', difficulty: 1 },
        ],
        accuracy: { course: { fizik: 0.2, kimya: 0.95 } },
      }),
    );
    const fizik = result.blocks.filter((b) => b.courseId === 'fizik').length;
    const kimya = result.blocks.filter((b) => b.courseId === 'kimya').length;
    expect(fizik).toBeGreaterThan(kimya);
  });

  it('rotates topics, weighted by difficulty and accuracy', () => {
    const result = generatePlan(
      input({
        courses: [{ id: 'fizik' }],
        topics: [
          { id: 'easy', courseId: 'fizik', difficulty: 1 },
          { id: 'hard', courseId: 'fizik', difficulty: 3 },
        ],
        accuracy: { topic: { hard: 0.3 } },
      }),
    );
    const hard = result.blocks.filter((b) => b.topicId === 'hard').length;
    const easy = result.blocks.filter((b) => b.topicId === 'easy').length;
    expect(easy).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(easy);
  });

  it('plans nothing without courses', () => {
    const result = generatePlan(input({ courses: [] }));
    expect(result.blocks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('ignores exams and topics of courses that are not active', () => {
    const result = generatePlan(
      input({
        courses: [{ id: 'kimya' }],
        exams: [{ id: 'e', courseId: 'fizik', date: addDays(MON, 2), topicIds: [] }],
      }),
    );
    expect(result.blocks.every((b) => b.courseId === 'kimya' && b.kind === 'study')).toBe(true);
  });

  it('warns when there is no free time at all', () => {
    const result = generatePlan(input({ availability: { weekday: [], weekend: [] } }));
    expect(result.blocks).toEqual([]);
    expect(result.warnings).toEqual([{ code: 'no_time' }]);
  });

  it('ignores malformed times', () => {
    const result = generatePlan(
      input({
        timetable: [{ weekday: 1, start: 'x', end: '15:00' }],
        availability: {
          weekday: [
            { start: 'bad', end: '20:00' },
            { start: '18:00', end: '17:00' },
            { start: '16:00', end: '18:00' },
          ],
          weekend: [],
        },
      }),
    );
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks.every((b) => toMinutes(b.start) >= 16 * 60)).toBe(true);
  });
});

describe('exam days', () => {
  it('official exam: no blocks on the day, light review the day before', () => {
    const lgs = addDays(MON, 5);
    const result = generatePlan(
      input({
        profile: { segment: 'ortaokul', dailyGoalMin: 50 },
        timetable: [],
        availability: {
          weekday: [{ start: '16:00', end: '21:00' }],
          weekend: [{ start: '10:00', end: '20:00' }],
        },
        exams: [{ id: 'lgs', courseId: null, date: lgs, topicIds: [] }],
      }),
    );
    expect(result.blocks.filter((b) => b.date === lgs)).toEqual([]);
    const eve = result.blocks.filter((b) => b.date === addDays(lgs, -1));
    expect(eve.length).toBeGreaterThan(0);
    expect(eve.every((b) => b.kind === 'review' && b.examId === 'lgs')).toBe(true);
    expect(minutesOn(result, addDays(lgs, -1))).toBeLessThanOrEqual(50);
    // Within 7 days of the official exam the day goes up to the cap.
    expect(minutesOn(result, MON)).toBe(150);
  });

  it('other courses still get blocks on an exam day', () => {
    const result = generatePlan(
      input({ exams: [{ id: 'e', courseId: 'fizik', date: WED, topicIds: [] }] }),
    );
    const wed = result.blocks.filter((b) => b.date === WED);
    expect(wed.length).toBeGreaterThan(0);
    expect(wed.every((b) => b.courseId === 'kimya')).toBe(true);
  });

  it('exam tomorrow: today is review only', () => {
    const result = generatePlan(
      input({
        exams: [
          { id: 'f', courseId: 'fizik', date: TUE, topicIds: [] },
          { id: 'k', courseId: 'kimya', date: TUE, topicIds: ['k1'] },
        ],
      }),
    );
    const today = result.blocks.filter((b) => b.date === MON);
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((b) => b.kind === 'review')).toBe(true);
    expect(new Set(today.map((b) => b.courseId))).toEqual(new Set(['fizik', 'kimya']));
    expect(today.filter((b) => b.courseId === 'kimya').every((b) => b.topicId === 'k1')).toBe(true);
  });
});

describe('homework (FR-PL-03)', () => {
  it('homework due on D gets one homework block before D', () => {
    const result = generatePlan(
      input({ homework: [{ id: 'h1', courseId: 'kimya', dueDate: THU, done: false }] }),
    );
    const hw = result.blocks.filter((b) => b.kind === 'homework');
    expect(hw).toHaveLength(1);
    expect(hw[0]).toMatchObject({ homeworkId: 'h1', courseId: 'kimya', date: WED });
    // It is the first block of its day.
    const wed = result.blocks.filter((b) => b.date === WED);
    expect(wed[0].kind).toBe('homework');
  });

  it('skips done homework, homework due today and homework that already has a block', () => {
    const result = generatePlan(
      input({
        homework: [
          { id: 'done', courseId: 'kimya', dueDate: THU, done: true },
          { id: 'today', courseId: 'kimya', dueDate: MON, done: false },
          { id: 'kept', courseId: 'kimya', dueDate: THU, done: false },
          { id: 'far', courseId: 'kimya', dueDate: addDays(MON, 30), done: false },
        ],
        existing: [
          item({ id: 'x', date: TUE, start: '16:00', kind: 'homework', homeworkId: 'kept', status: 'done' }),
        ],
      }),
    );
    expect(result.blocks.filter((b) => b.kind === 'homework')).toEqual([]);
  });

  it('moves the homework block earlier when the day before is the eve of an exam', () => {
    const result = generatePlan(
      input({
        homework: [{ id: 'h', courseId: 'kimya', dueDate: THU, done: false }],
        exams: [{ id: 'e', courseId: 'fizik', date: THU, topicIds: [] }],
      }),
    );
    const hw = result.blocks.find((b) => b.kind === 'homework');
    expect(hw?.date).toBe(TUE);
  });
});

describe('US-49 carry-over (BR-10)', () => {
  describe('Senaryo: Kaçırılan blokların dağıtılması', () => {
    // Diyelim ki salı günkü 3 bloğu tamamlamadım
    // Eğer ki çarşamba sabahı uygulamayı açarsam
    const missed = ['16:00', '16:50', '17:40'].map((start, i) =>
      item({ id: `m${i}`, date: TUE, start, courseId: i === 1 ? 'kimya' : 'fizik' }),
    );
    const result = generatePlan(input({ now: at(WED, '07:30'), existing: missed }));

    it('O zaman bu 3 blok günlük üst sınırı aşmadan çarşamba–cuma arasına dağıtılmıştır', () => {
      expect(result.moves).toHaveLength(3);
      expect(result.stuck).toEqual([]);
      for (const move of result.moves) {
        expect([WED, THU, FRI]).toContain(move.date);
        expect(move.carriedFrom).toBe(TUE);
      }
      expect(new Set(result.moves.map((m) => m.date)).size).toBeGreaterThan(1);
      for (const date of [WED, THU, FRI]) {
        expect(minutesOn(result, date)).toBeLessThanOrEqual(dailyCapMinutes('lise', false));
      }
      expect(result.warnings).toEqual([]);
    });
  });

  describe('Senaryo: Sığmayan bloklar', () => {
    // Diyelim ki kaçırılan bloklar sonraki 3 güne sığmıyor
    const missed = [0, 1, 2, 3, 4].map((i) =>
      item({ id: `m${i}`, date: TUE, start: fromMin(16 * 60 + i * 50) }),
    );
    const result = generatePlan(
      input({
        now: at(WED, '07:30'),
        // One 40-minute slot a day.
        availability: { weekday: [{ start: '16:00', end: '16:40' }], weekend: [] },
        existing: missed,
      }),
    );

    it('O zaman "Planın sıkıştı. Müsait saat ekle ya da bazı blokları kaldır." uyarısını görürüm', () => {
      expect(result.warnings).toContainEqual({ code: 'plan_tight', count: 2 });
      expect(plan.plan.warningTight).toBe(
        'Planın sıkıştı. Müsait saat ekle ya da bazı blokları kaldır.',
      );
    });

    it('Ve hiçbir blok kendiliğinden silinmez', () => {
      const handled = [...result.moves.map((m) => m.id), ...result.stuck].sort();
      expect(handled).toEqual(missed.map((m) => m.id).sort());
      expect(result.moves).toHaveLength(3);
    });
  });

  it('carried blocks come before new blocks and count toward the goal', () => {
    const result = generatePlan(
      input({
        now: at(TUE, '07:00'),
        profile: { segment: 'lise', dailyGoalMin: 80 },
        existing: [item({ id: 'm', date: MON, start: '16:00' })],
      }),
    );
    const tuesday = onDay(result, TUE);
    expect(result.moves[0]).toMatchObject({ id: 'm', date: TUE, start: '16:00' });
    expect(tuesday.reduce((s, b) => s + b.minutes, 0)).toBe(80);
  });

  it('a block carried again keeps its first day and its 3-day window', () => {
    const old = item({ id: 'm', date: TUE, start: '16:00', carriedFrom: MON });
    // Monday + 3 = Thursday is the last day it may move to.
    const thursday = generatePlan(input({ now: at(THU, '07:00'), existing: [old] }));
    expect(thursday.moves).toEqual([expect.objectContaining({ id: 'm', date: THU, carriedFrom: MON })]);
    const friday = generatePlan(input({ now: at(FRI, '07:00'), existing: [old] }));
    expect(friday.moves).toEqual([]);
    expect(friday.stuck).toEqual([]);
  });

  it('does not carry blocks whose exam is over, done homework or removed courses', () => {
    const result = generatePlan(
      input({
        now: at(WED, '07:00'),
        exams: [{ id: 'past', courseId: 'fizik', date: TUE, topicIds: [] }],
        homework: [{ id: 'hw', courseId: 'kimya', dueDate: FRI, done: true }],
        existing: [
          item({ id: 'a', date: MON, start: '16:00', examId: 'past' }),
          item({ id: 'b', date: TUE, start: '16:00', kind: 'homework', homeworkId: 'hw', courseId: 'kimya' }),
          item({ id: 'c', date: TUE, start: '17:00', courseId: 'gone' }),
          item({ id: 'd', date: TUE, start: '18:00', status: 'done' }),
        ],
      }),
    );
    expect(result.moves).toEqual([]);
    expect(result.stuck).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('a carried block of tomorrow’s exam becomes a review block', () => {
    const result = generatePlan(
      input({
        now: at(WED, '07:00'),
        exams: [{ id: 'f', courseId: 'fizik', date: THU, topicIds: [] }],
        existing: [item({ id: 'm', date: TUE, start: '16:00', examId: 'f' })],
      }),
    );
    expect(result.moves).toEqual([
      expect.objectContaining({ id: 'm', date: WED, kind: 'review', examId: 'f' }),
    ]);
  });
});

describe('blocks the student already has', () => {
  it('keeps done, skipped, manual and carried blocks in place and plans around them', () => {
    const kept = [
      item({ id: 'done', date: MON, start: '16:00', status: 'done' }),
      item({ id: 'skip', date: MON, start: '16:50', status: 'skipped' }),
      item({ id: 'man', date: MON, start: '19:00', source: 'manual', minutes: 60 }),
    ];
    const result = generatePlan(
      input({
        profile: { segment: 'lise', dailyGoalMin: 300 },
        exams: [{ id: 'e', courseId: 'kimya', date: addDays(MON, 6), topicIds: [] }],
        existing: kept,
      }),
    );
    const monday = result.blocks.filter((b) => b.date === MON);
    for (const block of monday) {
      expect(overlaps(block, '16:00', '17:40')).toBe(false);
      expect(overlaps(block, '19:00', '20:10')).toBe(false);
    }
    const total = monday.reduce((s, b) => s + b.minutes, 0) + 40 + 40 + 60;
    expect(total).toBeLessThanOrEqual(300);
  });

  it('a block moved away from a day still counts toward that day’s goal', () => {
    const result = generatePlan(
      input({
        profile: { segment: 'lise', dailyGoalMin: 80 },
        existing: [
          item({ id: 'a', date: MON, start: '16:00', status: 'done' }),
          item({ id: 'b', date: TUE, start: '16:00', carriedFrom: MON }),
        ],
      }),
    );
    expect(result.blocks.filter((b) => b.date === MON)).toEqual([]);
  });

  it('isReplaceable: only future, untouched auto blocks', () => {
    const now = 17 * 60;
    expect(isReplaceable(item({ id: 'a', date: TUE, start: '16:00' }), MON, now)).toBe(true);
    expect(isReplaceable(item({ id: 'b', date: MON, start: '18:00' }), MON, now)).toBe(true);
    expect(isReplaceable(item({ id: 'c', date: MON, start: '16:00' }), MON, now)).toBe(false);
    expect(isReplaceable(item({ id: 'd', date: TUE, start: '16:00', status: 'done' }), MON, now)).toBe(false);
    expect(isReplaceable(item({ id: 'e', date: TUE, start: '16:00', source: 'manual' }), MON, now)).toBe(false);
    expect(isReplaceable(item({ id: 'f', date: TUE, start: '16:00', carriedFrom: MON }), MON, now)).toBe(false);
    expect(isReplaceable(item({ id: 'g', date: addDays(MON, -1), start: '16:00' }), MON, now)).toBe(false);
  });
});

describe('findNextFreeSlot (Ertele)', () => {
  const base = (existing: EngineItem[], overrides: Partial<PlanInput> = {}) =>
    input({ now: at(MON, '15:00'), existing, ...overrides });

  it('moves the block to the next free slot after it', () => {
    const blocks = [
      item({ id: 'a', date: MON, start: '16:00' }),
      item({ id: 'b', date: MON, start: '16:50' }),
    ];
    expect(findNextFreeSlot(base(blocks), 'a')).toEqual({
      date: MON,
      start: '17:40',
      end: '18:20',
      kind: 'study',
      examId: null,
    });
  });

  it('goes to the next day when today is full', () => {
    const blocks = [
      item({ id: 'a', date: MON, start: '16:00' }),
      item({ id: 'b', date: MON, start: '17:00', minutes: 300, end: '22:00' }),
    ];
    expect(findNextFreeSlot(base(blocks), 'a')).toMatchObject({ date: TUE, start: '16:00' });
  });

  it('respects the cap and the exam days', () => {
    const blocks = [
      item({ id: 'a', date: MON, start: '16:00' }),
      item({ id: 'full', date: MON, start: '17:00', minutes: 280, end: '17:30', source: 'manual' }),
    ];
    const result = findNextFreeSlot(
      base(blocks, { exams: [{ id: 'e', courseId: 'fizik', date: WED, topicIds: [] }] }),
      'a',
    );
    // Monday is at the cap; Tuesday is the eve of the exam, so the block becomes review.
    expect(result).toMatchObject({ date: TUE, kind: 'review', examId: 'e' });
  });

  it('returns null when nothing fits within 3 days, or the block is unknown', () => {
    const blocks = [item({ id: 'a', date: MON, start: '16:00' })];
    expect(findNextFreeSlot(base(blocks, { availability: { weekday: [], weekend: [] } }), 'a')).toBeNull();
    expect(findNextFreeSlot(base(blocks), 'missing')).toBeNull();
  });
});

describe('weights and helpers', () => {
  it('exam urgency: ≤ 7 days is the highest band and grows as the exam nears', () => {
    expect(examUrgency(null)).toBe(1);
    expect(examUrgency(20)).toBe(1.5);
    expect(examUrgency(10)).toBe(3);
    expect(examUrgency(7)).toBeGreaterThan(examUrgency(10));
    expect(examUrgency(2)).toBeGreaterThan(examUrgency(5));
  });

  it('difficulty and accuracy factors', () => {
    expect(difficultyFactor(3)).toBeGreaterThan(difficultyFactor(1));
    expect(difficultyFactor(9)).toBe(difficultyFactor(3));
    expect(accuracyFactor(undefined)).toBe(1);
    expect(accuracyFactor(0.2)).toBeGreaterThan(accuracyFactor(0.9));
  });

  it('parseTime', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('24:00')).toBe(1440);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime('7.30')).toBeNull();
  });

  it('uses the profile block length and the matching break', () => {
    const result = generatePlan(input({ profile: { segment: 'lise', blockMin: 30 } }));
    expect(result.blocks[0]).toMatchObject({ minutes: 30, breakMin: 10 });
    const custom = generatePlan(input({ profile: { segment: 'lise', blockMin: 50, breakMin: 15 } }));
    expect(custom.blocks[0]).toMatchObject({ minutes: 50, breakMin: 15 });
  });
});

describe('PERF-07', () => {
  it('builds 14 days for a busy student in under 2 seconds', () => {
    const courses = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}` }));
    const topics = courses.flatMap((c, i) =>
      Array.from({ length: 12 }, (_, j) => ({ id: `${c.id}-t${j}`, courseId: c.id, difficulty: ((i + j) % 3) + 1 })),
    );
    const exams = courses.map((c, i) => ({
      id: `e${i}`,
      courseId: c.id,
      date: addDays(MON, (i % 13) + 1),
      topicIds: [`${c.id}-t0`, `${c.id}-t1`],
    }));
    const homework = Array.from({ length: 30 }, (_, i) => ({
      id: `h${i}`,
      courseId: `c${i % 14}`,
      dueDate: addDays(MON, (i % 12) + 1),
      done: false,
    }));
    const existing = Array.from({ length: 40 }, (_, i) =>
      item({ id: `x${i}`, date: addDays(MON, -1 - (i % 3)), start: fromMin(16 * 60 + (i % 6) * 50), courseId: `c${i % 14}` }),
    );
    const started = Date.now();
    const result = generatePlan(
      input({
        now: at(MON, '06:00'),
        timetable: [],
        availability: {
          weekday: [{ start: '07:00', end: '23:00' }],
          weekend: [{ start: '07:00', end: '23:00' }],
        },
        courses,
        topics,
        exams,
        homework,
        existing,
      }),
    );
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.blocks.length).toBeGreaterThan(50);
  });
});
