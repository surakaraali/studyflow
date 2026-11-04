import { create } from 'zustand';

import { segmentForGrade, suggestedTargetExam } from '@/domain/rules';

import type { OnboardingDraft } from './onboarding-logic';

const EMPTY: OnboardingDraft = {
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

/** Answers collected across the onboarding screens; written to the profile at the end. */
export const useOnboarding = create<OnboardingDraft>(() => EMPTY);

export function updateOnboarding(changes: Partial<OnboardingDraft>) {
  useOnboarding.setState(changes);
}

/** A grade in another segment drops answers that depended on the old one. */
export function chooseGrade(grade: number) {
  const previous = useOnboarding.getState().grade;
  if (previous === grade) return;
  const sameSegment = previous != null && segmentForGrade(previous) === segmentForGrade(grade);
  useOnboarding.setState({
    grade,
    targetExam: suggestedTargetExam(grade),
    track: grade >= 11 ? useOnboarding.getState().track : null,
    ...(sameSegment ? {} : { dailyGoal: null, blockMin: null, bedtime: null, wake: null }),
  });
}

export function resetOnboarding() {
  useOnboarding.setState(EMPTY);
}
