/**
 * Business rules from the BRD (analysis/01_brd.md §9).
 * Pure functions only: no I/O, no React. Every rule here has a unit test.
 */

export type Segment = 'ilkokul' | 'ortaokul' | 'lise';
export type TargetExam = 'LGS' | 'YKS';
export type Track = 'sayisal' | 'esit' | 'sozel' | 'dil';
export type Plan = 'free' | 'pro';
export type ConsentStatus = 'not_required' | 'pending' | 'granted' | 'revoked';

/** BR-01: grade 1–4 primary, 5–8 middle, 9–12 high school. */
export function segmentForGrade(grade: number): Segment {
  if (grade <= 4) return 'ilkokul';
  if (grade <= 8) return 'ortaokul';
  return 'lise';
}

/** R1 supports grades 5–12; primary school arrives in R2b (Q-01). */
export function isGradeSupported(grade: number): boolean {
  return grade >= 5 && grade <= 12;
}

/** Age is computed from the birth year only (we never ask for the birthday). */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

/** FR-CON-01: everyone under 18 needs a parent's consent. */
export function needsParentConsent(age: number): boolean {
  return age < 18;
}

export type AccessLevel =
  /** Everything is open. */
  | 'full'
  /** BR-03: 13–17 waiting for consent. Courses, plan and cards work; AI and purchases do not. */
  | 'limited'
  /** BR-02: under 13 waiting for consent. Only the welcome and consent screens. */
  | 'locked';

export function accessLevel(age: number, consent: ConsentStatus): AccessLevel {
  if (!needsParentConsent(age) || consent === 'granted') return 'full';
  return age < 13 ? 'locked' : 'limited';
}

/** BR-16 also uses the AI switch: a revoked consent turns AI off even after it was granted. */
export function canUseAi(level: AccessLevel): boolean {
  return level === 'full';
}

export function canPurchase(level: AccessLevel): boolean {
  return level === 'full';
}

/** BR-04: consent links live for 7 days. */
export const CONSENT_LINK_DAYS = 7;
/** BR-04: an under-13 account without consent is deleted after 30 days. */
export const CONSENT_DEADLINE_DAYS = 30;
/** BR-04 / US-17: reminders on day 7 and day 25. */
export const CONSENT_REMINDER_DAYS = [7, 25] as const;
/** US-17: "send the link again" at most 3 times a day. */
export const CONSENT_RESENDS_PER_DAY = 3;

/** BR-07: default study and break length, and the range a student can choose. */
export function blockRules(segment: Segment) {
  switch (segment) {
    case 'ilkokul':
      return { study: 15, break: 5, min: 10, max: 20 };
    case 'ortaokul':
      return { study: 25, break: 5, min: 20, max: 40 };
    case 'lise':
      return { study: 40, break: 10, min: 25, max: 60 };
  }
}

export function clampBlockMinutes(segment: Segment, minutes: number): number {
  const { min, max } = blockRules(segment);
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

/** Break length that goes with a chosen block length (keeps the segment's ratio). */
export function breakMinutesFor(segment: Segment, studyMinutes: number): number {
  const rules = blockRules(segment);
  return Math.max(5, Math.round((studyMinutes * rules.break) / rules.study / 5) * 5);
}

/**
 * BR-08: daily study cap outside school, +25% at weekends.
 * A parent may lower the cap (`override`) but never raise it.
 */
export function dailyCapMinutes(segment: Segment, isWeekend: boolean, override?: number | null) {
  const base = { ilkokul: 60, ortaokul: 150, lise: 300 }[segment];
  const cap = isWeekend ? Math.round(base * 1.25) : base;
  if (override != null && override > 0) return Math.min(cap, override);
  return cap;
}

/** Suggested daily goal shown in onboarding; the student can change it. */
export function defaultDailyGoal(segment: Segment): number {
  return { ilkokul: 30, ortaokul: 60, lise: 120 }[segment];
}

/** BR-09: default bedtimes. Wake-up is not in the BRD; 07:00 is our default. */
export function defaultSleep(segment: Segment): { bedtime: string; wake: string } {
  const bedtime = { ilkokul: '21:00', ortaokul: '22:00', lise: '23:30' }[segment];
  return { bedtime, wake: '07:00' };
}

/** BR-12: answer options per question. */
export function quizOptionCount(segment: Segment): 3 | 4 | 5 {
  return { ilkokul: 3, ortaokul: 4, lise: 5 }[segment] as 3 | 4 | 5;
}

/** BR-13: LGS net = correct − wrong ÷ 3, YKS net = correct − wrong ÷ 4. Blanks do not count. */
export function examNet(exam: TargetExam, correct: number, wrong: number): number {
  const divisor = exam === 'LGS' ? 3 : 4;
  return Math.round((correct - wrong / divisor) * 100) / 100;
}

/** US-27: LGS is suggested in grade 8, YKS in grades 11–12. */
export function suggestedTargetExam(grade: number): TargetExam | null {
  if (grade === 8) return 'LGS';
  if (grade >= 11) return 'YKS';
  return null;
}

/** BR-14: monthly document quota and pages per document. */
export function quota(plan: Plan) {
  return plan === 'pro' ? { documents: 40, pages: 100 } : { documents: 3, pages: 20 };
}

/** BR-15: PDF only, at most 25 MB. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** "2026-11" — quota resets on the 1st of every month (BR-14). */
export function quotaMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** BR-16: no notifications in quiet hours. Times are "HH:MM", the window wraps midnight. */
export function quietHours(age: number): { start: string; end: string } {
  return age < 13 ? { start: '20:30', end: '08:00' } : { start: '23:00', end: '07:30' };
}

export function isQuietTime(date: Date, age: number): boolean {
  const { start, end } = quietHours(age);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const from = toMinutes(start);
  const to = toMinutes(end);
  return from > to ? minutes >= from || minutes < to : minutes >= from && minutes < to;
}

/** BR-16: an exam-day morning reminder never goes out before 07:30. */
export const EXAM_DAY_EARLIEST = '07:30';

/** BR-22: FSRS target retention and daily new-card limit. */
export const FSRS_RETENTION = 0.9;
export function newCardLimit(segment: Segment): number {
  return { ilkokul: 10, ortaokul: 20, lise: 30 }[segment];
}

/** BR-17: a day counts for the streak with one finished block or 10+ minutes logged. */
export const STREAK_MIN_MINUTES = 10;
export function dayCountsForStreak(blocksDone: number, minutesLogged: number): boolean {
  return blocksDone > 0 || minutesLogged >= STREAK_MIN_MINUTES;
}

/** BR-23: more than 3 reports on one document puts it under review. */
export const REPORTS_FOR_REVIEW = 3;

/** BR-19 / US-19: parent gate locks for a minute after 3 wrong answers. */
export const PARENT_GATE_ATTEMPTS = 3;
export const PARENT_GATE_LOCK_MS = 60_000;

/** US-55: a manual session is 5–240 minutes. */
export const MANUAL_SESSION_RANGE = { min: 5, max: 240 } as const;

/** US-22: course names are at most 40 characters. */
export const COURSE_NAME_MAX = 40;

/** US-08: passwords are at least 8 characters. */
export const PASSWORD_MIN = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
