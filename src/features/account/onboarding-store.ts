import { create } from 'zustand';

import { currentUserId, hasDb } from '@/db/client';
import { kvDelete, kvGet, kvSet } from '@/db/write';
import { segmentForGrade, suggestedTargetExam } from '@/domain/rules';
import { onSignedOut } from '@/stores/session';

import {
  answeredAfterGradeChange,
  DRAFT_KEY,
  EMPTY_DRAFT,
  parseStoredDraft,
  resumePath,
  storedDraft,
} from './onboarding-draft';
import type { OnboardingDraft, OnboardingStep } from './onboarding-logic';

type OnboardingState = OnboardingDraft & { answered: OnboardingStep[] };

const EMPTY: OnboardingState = { ...EMPTY_DRAFT, answered: [] };

/**
 * Answers collected across the onboarding screens; written to the profile at the end.
 * US-73: every change is also saved to the user's kv table, so a closed app can resume.
 */
export const useOnboarding = create<OnboardingState>(() => EMPTY);

const SAVE_DELAY_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** The user whose saved draft is loaded into the store (null: not loaded yet). */
let hydratedFor: string | null = null;

async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!hasDb()) return;
  const { answered, ...draft } = useOnboarding.getState();
  await kvSet(DRAFT_KEY, storedDraft(draft, answered));
}

/** Typing (nickname, parent email) changes the draft often, so saves are batched. */
function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveNow().catch((error) => console.warn('Onboarding draft not saved', error));
  }, SAVE_DELAY_MS);
}

export function updateOnboarding(changes: Partial<OnboardingDraft>) {
  useOnboarding.setState(changes);
  saveSoon();
}

/** A grade in another segment drops answers that depended on the old one. */
export function chooseGrade(grade: number) {
  const state = useOnboarding.getState();
  const previous = state.grade;
  if (previous === grade) return;
  const sameSegment = previous != null && segmentForGrade(previous) === segmentForGrade(grade);
  useOnboarding.setState({
    grade,
    targetExam: suggestedTargetExam(grade),
    track: grade >= 11 ? state.track : null,
    answered: answeredAfterGradeChange(state.answered, !sameSegment),
    ...(sameSegment ? {} : { dailyGoal: null, blockMin: null, bedtime: null, wake: null }),
  });
  saveSoon();
}

/** Called when the student moves past a step ("Devam et"); saved right away. */
export function markStepAnswered(step: OnboardingStep) {
  const { answered } = useOnboarding.getState();
  if (!answered.includes(step)) useOnboarding.setState({ answered: [...answered, step] });
  void saveNow().catch((error) => console.warn('Onboarding draft not saved', error));
}

/**
 * Loads the saved draft once per signed-in user and returns the screens to open on top of
 * the grade screen (empty when there is nothing to resume).
 */
export async function hydrateOnboarding(now: Date = new Date()): Promise<OnboardingStep[]> {
  const userId = currentUserId();
  if (!userId || !hasDb() || hydratedFor === userId) return [];
  hydratedFor = userId;
  try {
    const stored = parseStoredDraft(await kvGet<unknown>(DRAFT_KEY));
    if (!stored) return [];
    useOnboarding.setState({ ...stored.draft, answered: stored.answered });
    return resumePath(stored, now);
  } catch (error) {
    console.warn('Onboarding draft could not be read', error);
    return [];
  }
}

/** Forgets the answers in memory and on the device (end of onboarding, sign-out). */
export async function resetOnboarding(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  hydratedFor = null;
  useOnboarding.setState(EMPTY);
  if (!hasDb()) return;
  try {
    await kvDelete(DRAFT_KEY);
  } catch (error) {
    console.warn('Onboarding draft could not be deleted', error);
  }
}

// Every sign-out path (also ones that call endSession directly) drops the draft while the
// user's database is still open.
onSignedOut(() => resetOnboarding());
