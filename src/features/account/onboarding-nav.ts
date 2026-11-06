import { router, type Href } from 'expo-router';

import { ageFromBirthYear } from '@/domain/rules';

import { nextStep, type OnboardingStep } from './onboarding-logic';
import { hydrateOnboarding, markStepAnswered, useOnboarding } from './onboarding-store';

const ROUTES: Record<OnboardingStep, Href> = {
  grade: '/onboarding',
  'birth-year': '/onboarding/birth-year',
  goal: '/onboarding/goal',
  nickname: '/onboarding/nickname',
  preferences: '/onboarding/preferences',
  parent: '/onboarding/parent',
};

/** Pushes the screen after `current`. Returns false when `current` is the last step. */
export function goToNextStep(current: OnboardingStep): boolean {
  markStepAnswered(current);
  const { grade, birthYear } = useOnboarding.getState();
  const next = nextStep(current, grade, birthYear != null ? ageFromBirthYear(birthYear) : null);
  if (!next) return false;
  router.push(ROUTES[next]);
  return true;
}

/**
 * US-73: on the grade screen (onboarding home), load the saved draft and reopen the screens
 * up to the first unanswered step, so "back" still walks through the earlier answers.
 */
export async function resumeOnboarding(): Promise<void> {
  const path = await hydrateOnboarding();
  for (const step of path) router.push(ROUTES[step]);
}
