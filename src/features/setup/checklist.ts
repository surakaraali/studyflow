/**
 * US-74: the first-day setup checklist on Today. Pure logic, unit tested; the card reads the
 * facts from the database and the system permission.
 */

export type ChecklistStepKey = 'courses' | 'timetable' | 'availability' | 'exam' | 'notifications';

export type ChecklistFacts = {
  hasCourses: boolean;
  hasTimetable: boolean;
  /** The student saved their own study hours (not our suggested defaults). */
  availabilitySaved: boolean;
  hasSchoolExam: boolean;
  notificationsGranted: boolean;
  /**
   * False when the student may not get notifications (parent consent missing or the
   * notifications purpose not approved, US-76). The step is then left out.
   */
  notificationsAllowed: boolean;
};

export type ChecklistStep = { key: ChecklistStepKey; done: boolean };

/** Steps in the order a student should do them. */
export function checklistSteps(facts: ChecklistFacts): ChecklistStep[] {
  const steps: ChecklistStep[] = [
    { key: 'courses', done: facts.hasCourses },
    { key: 'timetable', done: facts.hasTimetable },
    { key: 'availability', done: facts.availabilitySaved },
    { key: 'exam', done: facts.hasSchoolExam },
  ];
  if (facts.notificationsAllowed) {
    steps.push({ key: 'notifications', done: facts.notificationsGranted });
  }
  return steps;
}

export function checklistProgress(steps: readonly ChecklistStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, complete: done === steps.length };
}

/** The card shows until every step is done or the student closes it. */
export function showChecklist(steps: readonly ChecklistStep[], dismissed: boolean): boolean {
  return !dismissed && !checklistProgress(steps).complete;
}

/** The first step still to do (gets the highlight), or null when all are done. */
export function nextChecklistStep(steps: readonly ChecklistStep[]): ChecklistStepKey | null {
  return steps.find((s) => !s.done)?.key ?? null;
}
