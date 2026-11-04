/**
 * Onboarding and profile rules (US-11, US-12, US-15). Pure functions, unit tested.
 */

import type { Profile } from '@/db/types';
import {
  ageFromBirthYear,
  blockRules,
  breakMinutesFor,
  clampBlockMinutes,
  dailyCapMinutes,
  defaultDailyGoal,
  defaultSleep,
  isGradeSupported,
  isValidEmail,
  needsParentConsent,
  segmentForGrade,
  suggestedTargetExam,
  type ConsentStatus,
  type Segment,
  type TargetExam,
  type Track,
} from '@/domain/rules';

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const TRACKS: readonly Track[] = ['sayisal', 'esit', 'sozel', 'dil'];

/** A K-12 student is between 5 and 25 years old; anything else is a typo. */
export const MIN_AGE = 5;
export const MAX_AGE = 25;
export const NICKNAME_MAX = 20;
export const DAILY_GOAL_MIN = 15;
export const DAILY_GOAL_STEP = 15;

/** Birth years shown in onboarding, oldest first. Neutral: nothing is preselected. */
export function birthYearOptions(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  const years: number[] = [];
  for (let y = year - MAX_AGE; y <= year - MIN_AGE; y++) years.push(y);
  return years;
}

export type BirthYearError = 'out_of_range';

export function validateBirthYear(birthYear: number, now: Date = new Date()): BirthYearError | null {
  if (!Number.isInteger(birthYear)) return 'out_of_range';
  const age = ageFromBirthYear(birthYear, now);
  return age < MIN_AGE || age > MAX_AGE ? 'out_of_range' : null;
}

/**
 * Loose check of grade vs age: grade 1 starts around age 6–7, so the usual age is grade + 6.
 * More than 2 years away gets a gentle "is this right?" note, never a block.
 */
export function gradeAgeMismatch(grade: number, birthYear: number, now: Date = new Date()): boolean {
  const age = ageFromBirthYear(birthYear, now);
  return Math.abs(age - (grade + 6)) > 2;
}

/** Target exams a student can pick for their grade (profile screen). */
export function targetExamChoices(grade: number): TargetExam[] {
  const segment = segmentForGrade(grade);
  if (segment === 'ortaokul') return ['LGS'];
  if (segment === 'lise') return ['YKS'];
  return [];
}

/** Tracks (alan) are chosen in grades 11–12 for YKS. */
export function needsTrack(grade: number, target: TargetExam | null): boolean {
  return grade >= 11 && target === 'YKS';
}

export type OnboardingStep = 'grade' | 'birth-year' | 'goal' | 'nickname' | 'preferences' | 'parent';

/**
 * The steps this student goes through. Before the birth year is known we assume a parent
 * step (most students are under 18), so the progress bubbles rarely change length.
 */
export function onboardingSteps(grade: number | null, age: number | null): OnboardingStep[] {
  const steps: OnboardingStep[] = ['grade', 'birth-year'];
  if (grade != null && suggestedTargetExam(grade) != null) steps.push('goal');
  steps.push('nickname', 'preferences');
  if (age == null || needsParentConsent(age)) steps.push('parent');
  return steps;
}

export function nextStep(
  current: OnboardingStep,
  grade: number | null,
  age: number | null,
): OnboardingStep | null {
  const steps = onboardingSteps(grade, age);
  const index = steps.indexOf(current);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
}

export type EmailError = 'required' | 'invalid' | 'same_as_own';

/** US-15: the parent's email is required and can't be the student's own. */
export function validateParentEmail(parentEmail: string, ownEmail: string | null): EmailError | null {
  const value = parentEmail.trim().toLowerCase();
  if (!value) return 'required';
  if (!isValidEmail(value)) return 'invalid';
  if (ownEmail && value === ownEmail.trim().toLowerCase()) return 'same_as_own';
  return null;
}

export function normalizeNickname(nickname: string): string | null {
  const value = nickname.trim().replace(/\s+/g, ' ');
  return value ? value.slice(0, NICKNAME_MAX) : null;
}

/** Defaults for a segment (BR-07, BR-09 and the suggested daily goal). */
export function segmentDefaults(segment: Segment) {
  const block = blockRules(segment);
  const sleep = defaultSleep(segment);
  return {
    dailyGoal: defaultDailyGoal(segment),
    blockMin: block.study,
    breakMin: block.break,
    bedtime: sleep.bedtime,
    wake: sleep.wake,
  };
}

/** Daily goal range: 15 minutes up to the weekday cap of the segment (BR-08). */
export function dailyGoalRange(segment: Segment) {
  return { min: DAILY_GOAL_MIN, max: dailyCapMinutes(segment, false) };
}

export function clampDailyGoal(segment: Segment, minutes: number): number {
  const { min, max } = dailyGoalRange(segment);
  return Math.min(max, Math.max(min, Math.round(minutes / DAILY_GOAL_STEP) * DAILY_GOAL_STEP));
}

export type OnboardingDraft = {
  grade: number | null;
  birthYear: number | null;
  targetExam: TargetExam | null;
  track: Track | null;
  nickname: string;
  dailyGoal: number | null;
  blockMin: number | null;
  bedtime: string | null;
  wake: string | null;
  parentEmail: string;
};

export type OnboardingProfile = { grade: number; segment: Segment; birth_year: number } & Pick<
  Profile,
  | 'track'
  | 'target_exam'
  | 'nickname'
  | 'daily_goal_min'
  | 'block_min'
  | 'break_min'
  | 'bedtime'
  | 'wake_time'
  | 'consent_status'
  | 'parent_email'
>;

export type DraftError = 'grade' | 'birth_year' | 'unsupported_grade' | 'parent_email';

/** Turns the onboarding answers into profile columns, or says which answer is missing. */
export function buildOnboardingProfile(
  draft: OnboardingDraft,
  ownEmail: string | null,
  now: Date = new Date(),
): { ok: true; profile: OnboardingProfile } | { ok: false; error: DraftError } {
  if (draft.grade == null) return { ok: false, error: 'grade' };
  if (!isGradeSupported(draft.grade)) return { ok: false, error: 'unsupported_grade' };
  if (draft.birthYear == null || validateBirthYear(draft.birthYear, now)) {
    return { ok: false, error: 'birth_year' };
  }

  const segment = segmentForGrade(draft.grade);
  const defaults = segmentDefaults(segment);
  const age = ageFromBirthYear(draft.birthYear, now);
  const consentNeeded = needsParentConsent(age);
  if (consentNeeded && validateParentEmail(draft.parentEmail, ownEmail)) {
    return { ok: false, error: 'parent_email' };
  }

  const target = draft.targetExam && targetExamChoices(draft.grade).includes(draft.targetExam)
    ? draft.targetExam
    : null;
  const blockMin = clampBlockMinutes(segment, draft.blockMin ?? defaults.blockMin);
  const consent: ConsentStatus = consentNeeded ? 'pending' : 'not_required';

  return {
    ok: true,
    profile: {
      grade: draft.grade,
      segment,
      birth_year: draft.birthYear,
      track: needsTrack(draft.grade, target) ? draft.track : null,
      target_exam: target,
      nickname: normalizeNickname(draft.nickname),
      daily_goal_min: clampDailyGoal(segment, draft.dailyGoal ?? defaults.dailyGoal),
      block_min: blockMin,
      break_min: breakMinutesFor(segment, blockMin),
      bedtime: draft.bedtime ?? defaults.bedtime,
      wake_time: draft.wake ?? defaults.wake,
      consent_status: consent,
      parent_email: consentNeeded ? draft.parentEmail.trim().toLowerCase() : null,
    },
  };
}

/**
 * US-12: a grade change that moves the student to another segment re-applies the segment
 * defaults (BR-07 block length, BR-08 cap via the daily goal range, BR-12 follows the segment)
 * and drops a target exam or track the new grade can't have.
 */
export function applyGradeChange(
  current: Pick<Profile, 'grade' | 'segment' | 'target_exam' | 'track' | 'block_min' | 'daily_goal_min'>,
  grade: number,
) {
  const segment = segmentForGrade(grade);
  const segmentChanged = current.segment !== segment;
  const defaults = segmentDefaults(segment);

  const allowed = targetExamChoices(grade);
  let target = current.target_exam && allowed.includes(current.target_exam) ? current.target_exam : null;
  if (segmentChanged && target == null) target = suggestedTargetExam(grade);

  const blockMin = segmentChanged
    ? defaults.blockMin
    : clampBlockMinutes(segment, current.block_min ?? defaults.blockMin);
  const dailyGoal = segmentChanged
    ? defaults.dailyGoal
    : clampDailyGoal(segment, current.daily_goal_min ?? defaults.dailyGoal);

  return {
    segmentChanged,
    changes: {
      grade,
      segment,
      target_exam: target,
      track: needsTrack(grade, target) ? current.track : null,
      block_min: blockMin,
      break_min: breakMinutesFor(segment, blockMin),
      daily_goal_min: dailyGoal,
    },
  };
}

/** US-15 again: someone who turned 18 while waiting no longer needs a parent. */
export function consentStatusForAge(age: number | null, current: ConsentStatus): ConsentStatus {
  if (age != null && !needsParentConsent(age) && current === 'pending') return 'not_required';
  return current;
}

/** US-13: the student confirms deletion by typing "SİL" (an English keyboard gives "SIL"). */
export function isDeleteConfirmation(text: string): boolean {
  const value = text.trim().toLocaleUpperCase('tr-TR');
  return value === 'SİL' || value === 'SIL';
}
