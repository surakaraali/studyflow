import { buildReminders, examMorningTime, type ReminderBlock } from '../build';

// Monday 9 November 2026, 07:00
const NOW = new Date(2026, 10, 9, 7, 0);

const block = (overrides: Partial<ReminderBlock> = {}): ReminderBlock => ({
  id: 'b1',
  date: '2026-11-09',
  start: '16:00',
  minutes: 40,
  kind: 'study',
  courseName: 'Fizik',
  ...overrides,
});

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('US-60 quiet hours', () => {
  // Senaryo: Sessiz saatler
  // Diyelim ki 12 yaşındayım
  // Ve bir plan bloğum 20:45'te başlıyor
  it("O zaman bu blok için bildirim gönderilmez", () => {
    const reminders = buildReminders({
      now: NOW,
      age: 12,
      blocks: [block({ start: '20:45' })],
      exams: [],
      homework: [],
    });
    expect(reminders).toEqual([]);
  });

  it('a 15-year-old still gets the 20:45 block reminder', () => {
    const reminders = buildReminders({
      now: NOW,
      age: 15,
      blocks: [block({ start: '20:45' })],
      exams: [],
      homework: [],
    });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].date).toEqual(at(2026, 11, 9, 20, 45));
  });
});

describe('US-61 reminders', () => {
  it('block reminders only for today and tomorrow, never in the past', () => {
    const reminders = buildReminders({
      now: NOW,
      age: 15,
      blocks: [
        block({ id: 'past', start: '06:00' }),
        block({ id: 'today' }),
        block({ id: 'tomorrow', date: '2026-11-10' }),
        block({ id: 'later', date: '2026-11-11' }),
      ],
      exams: [],
      homework: [],
    });
    expect(reminders.map((r) => (r.kind === 'plan' ? r.block.id : ''))).toEqual(['today', 'tomorrow']);
  });

  it('exams: 7, 3 and 1 days before at 18:00 and a morning note on the day', () => {
    const reminders = buildReminders({
      now: NOW,
      age: 15,
      blocks: [],
      exams: [{ id: 'e', title: 'Fizik yazılısı', date: '2026-11-20' }],
      homework: [],
    });
    expect(reminders.map((r) => r.date)).toEqual([
      at(2026, 11, 13, 18),
      at(2026, 11, 17, 18),
      at(2026, 11, 19, 18),
      at(2026, 11, 20, 7, 30),
    ]);
    expect(reminders.map((r) => (r.kind === 'exam' ? r.daysLeft : -1))).toEqual([7, 3, 1, 0]);
  });

  it('BR-16: the exam-day note waits for the end of the quiet hours', () => {
    expect(examMorningTime(15)).toBe('07:30');
    expect(examMorningTime(11)).toBe('08:00');
    expect(examMorningTime(null)).toBe('07:30');
    const reminders = buildReminders({
      now: NOW,
      age: 11,
      blocks: [],
      exams: [{ id: 'e', title: 'Matematik', date: '2026-11-10' }],
      homework: [],
    });
    // 18:00 is outside an 11-year-old's quiet hours (20:30–08:00); the morning note moves to 08:00.
    expect(reminders.map((r) => r.date)).toEqual([at(2026, 11, 9, 18), at(2026, 11, 10, 8)]);
  });

  it('homework: the day before it is due at 17:00', () => {
    const reminders = buildReminders({
      now: NOW,
      age: 15,
      blocks: [],
      exams: [],
      homework: [{ id: 'h', dueDate: '2026-11-12', courseName: 'Kimya', description: 'Sayfa 40' }],
    });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].date).toEqual(at(2026, 11, 11, 17));
  });

  it('nearest first', () => {
    const reminders = buildReminders({
      now: NOW,
      age: 15,
      blocks: [block({ date: '2026-11-10', start: '19:00' })],
      exams: [{ id: 'e', title: 'Fizik', date: '2026-11-10' }],
      homework: [{ id: 'h', dueDate: '2026-11-10', courseName: 'Kimya', description: '' }],
    });
    expect(reminders.map((r) => r.kind)).toEqual(['homework', 'exam', 'exam', 'plan']);
  });
});
