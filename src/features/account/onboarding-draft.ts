/**
 * US-73: the half-finished onboarding is kept on the device (the user's own kv table), so a
 * closed app resumes at the first unanswered step. Pure functions, unit tested.
 */

import { ageFromBirthYear, isGradeSupported, type TargetExam, type Track } from '@/domain/rules';

import {
  onboardingSteps,
  TRACKS,
  validateBirthYear,
  type OnboardingDraft,
  type OnboardingStep,
} from './onboarding-logic';

export const DRAFT_KEY = 'onboarding.draft';
const DRAFT_VERSION = 1;

export const EMPTY_DRAFT: OnboardingDraft = {
  grade: null,
  birthYear: null,
  targetExam: null,
  track: null,
  nickname: '',
  dailyGoal: null,
  blockMin: null,
  bedtime: null,
  wake: null,
  parentEmail: '',
};

/**
 * `answered` lists the steps the student moved past with "Devam et". Steps with a default
 * (goal, nickname, preferences) can't be told apart from untouched ones by their values.
 */
export type StoredDraft = { v: typeof DRAFT_VERSION; draft: OnboardingDraft; answered: OnboardingStep[] };

const STEPS: readonly OnboardingStep[] = ['grade', 'birth-year', 'goal', 'nickname', 'preferences', 'parent'];
const EXAMS: readonly TargetExam[] = ['LGS', 'YKS'];
const HHMM = /^\d{2}:\d{2}$/;

export function storedDraft(draft: OnboardingDraft, answered: readonly OnboardingStep[]): StoredDraft {
  const clean = { ...EMPTY_DRAFT };
  for (const key of Object.keys(EMPTY_DRAFT) as (keyof OnboardingDraft)[]) {
    (clean as Record<string, unknown>)[key] = draft[key];
  }
  return { v: DRAFT_VERSION, draft: clean, answered: [...new Set(answered)] };
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function time(value: unknown): string | null {
  return typeof value === 'string' && HHMM.test(value) ? value : null;
}

/** Reads what kvGet returned. Anything malformed falls back to "not answered". */
export function parseStoredDraft(value: unknown): StoredDraft | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { v?: unknown; draft?: unknown; answered?: unknown };
  if (raw.v !== DRAFT_VERSION || !raw.draft || typeof raw.draft !== 'object') return null;
  const d = raw.draft as Record<string, unknown>;
  const grade = int(d.grade);
  const draft: OnboardingDraft = {
    grade: grade != null && grade >= 1 && grade <= 12 ? grade : null,
    birthYear: int(d.birthYear),
    targetExam: EXAMS.includes(d.targetExam as TargetExam) ? (d.targetExam as TargetExam) : null,
    track: TRACKS.includes(d.track as Track) ? (d.track as Track) : null,
    nickname: text(d.nickname),
    dailyGoal: int(d.dailyGoal),
    blockMin: int(d.blockMin),
    bedtime: time(d.bedtime),
    wake: time(d.wake),
    parentEmail: text(d.parentEmail),
  };
  const answered = Array.isArray(raw.answered)
    ? STEPS.filter((step) => (raw.answered as unknown[]).includes(step))
    : [];
  return { v: DRAFT_VERSION, draft, answered };
}

function validAge(draft: OnboardingDraft, now: Date): number | null {
  if (draft.birthYear == null || validateBirthYear(draft.birthYear, now)) return null;
  return ageFromBirthYear(draft.birthYear, now);
}

function isAnswered(step: OnboardingStep, stored: StoredDraft, now: Date): boolean {
  const { draft, answered } = stored;
  switch (step) {
    case 'grade':
      return draft.grade != null && isGradeSupported(draft.grade);
    case 'birth-year':
      return validAge(draft, now) != null;
    default:
      return answered.includes(step);
  }
}

/**
 * The screens to open on relaunch, in order, ending at the first unanswered step. The grade
 * screen is always first (it's the onboarding home), so it's left out. With every step
 * answered (finishing failed last time) the path ends at the last step.
 */
export function resumePath(stored: StoredDraft | null, now: Date = new Date()): OnboardingStep[] {
  if (!stored) return [];
  const steps = onboardingSteps(stored.draft.grade, validAge(stored.draft, now));
  const firstOpen = steps.findIndex((step) => !isAnswered(step, stored, now));
  const end = firstOpen === -1 ? steps.length - 1 : firstOpen;
  return steps.slice(1, end + 1);
}

/** The step the student lands on: the last screen of resumePath, or the grade screen. */
export function resumeStep(stored: StoredDraft | null, now: Date = new Date()): OnboardingStep {
  return resumePath(stored, now).at(-1) ?? 'grade';
}

/**
 * A new grade can change which steps exist and their defaults: the goal step always depends
 * on the grade, preferences only when the segment changes.
 */
export function answeredAfterGradeChange(
  answered: readonly OnboardingStep[],
  segmentChanged: boolean,
): OnboardingStep[] {
  return answered.filter((step) => step !== 'goal' && !(segmentChanged && step === 'preferences'));
}
