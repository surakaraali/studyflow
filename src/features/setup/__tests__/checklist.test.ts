import {
  checklistProgress,
  checklistSteps,
  nextChecklistStep,
  showChecklist,
  type ChecklistFacts,
} from '../checklist';

const NOTHING: ChecklistFacts = {
  hasCourses: false,
  hasTimetable: false,
  availabilitySaved: false,
  hasSchoolExam: false,
  notificationsGranted: false,
  notificationsAllowed: true,
};

const EVERYTHING: ChecklistFacts = {
  hasCourses: true,
  hasTimetable: true,
  availabilitySaved: true,
  hasSchoolExam: true,
  notificationsGranted: true,
  notificationsAllowed: true,
};

describe('US-74 setup checklist', () => {
  it('lists the five steps in order for a new student', () => {
    const steps = checklistSteps(NOTHING);
    expect(steps.map((s) => s.key)).toEqual(['courses', 'timetable', 'availability', 'exam', 'notifications']);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(checklistProgress(steps)).toEqual({ done: 0, total: 5, complete: false });
    expect(nextChecklistStep(steps)).toBe('courses');
  });

  it('marks each step from its own fact', () => {
    const steps = checklistSteps({ ...NOTHING, hasCourses: true, availabilitySaved: true });
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['courses', 'availability']);
    expect(checklistProgress(steps)).toMatchObject({ done: 2, total: 5 });
    expect(nextChecklistStep(steps)).toBe('timetable');
  });

  it('leaves the notifications step out when notifications are not allowed', () => {
    const steps = checklistSteps({ ...NOTHING, notificationsAllowed: false, notificationsGranted: true });
    expect(steps.map((s) => s.key)).not.toContain('notifications');
    expect(steps).toHaveLength(4);
  });

  it('counts as complete without the notifications step when it is left out', () => {
    const steps = checklistSteps({ ...EVERYTHING, notificationsAllowed: false, notificationsGranted: false });
    expect(checklistProgress(steps).complete).toBe(true);
    expect(showChecklist(steps, false)).toBe(false);
  });

  it('shows the card until everything is done', () => {
    expect(showChecklist(checklistSteps(NOTHING), false)).toBe(true);
    expect(showChecklist(checklistSteps({ ...EVERYTHING, notificationsGranted: false }), false)).toBe(true);
    expect(showChecklist(checklistSteps(EVERYTHING), false)).toBe(false);
    expect(nextChecklistStep(checklistSteps(EVERYTHING))).toBeNull();
  });

  it('hides the card once the student closes it', () => {
    expect(showChecklist(checklistSteps(NOTHING), true)).toBe(false);
  });
});
