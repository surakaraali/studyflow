import {
  answeredAfterGradeChange,
  EMPTY_DRAFT,
  parseStoredDraft,
  resumePath,
  resumeStep,
  storedDraft,
} from '../onboarding-draft';
import type { OnboardingDraft, OnboardingStep } from '../onboarding-logic';

const NOW = new Date(2026, 10, 5); // 5 Nov 2026

const stored = (draft: Partial<OnboardingDraft>, answered: OnboardingStep[] = []) =>
  storedDraft({ ...EMPTY_DRAFT, ...draft }, answered);

describe('parseStoredDraft', () => {
  it('round-trips a stored draft', () => {
    const value = stored({ grade: 9, birthYear: 2011, nickname: 'Yıldız', bedtime: '22:30' }, ['goal']);
    expect(parseStoredDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);
  });

  it('rejects other versions and garbage', () => {
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft('x')).toBeNull();
    expect(parseStoredDraft({ v: 2, draft: {}, answered: [] })).toBeNull();
    expect(parseStoredDraft({ v: 1 })).toBeNull();
  });

  it('drops malformed fields instead of trusting them', () => {
    const parsed = parseStoredDraft({
      v: 1,
      draft: { grade: 14, birthYear: '2010', targetExam: 'SAT', track: 'esit', bedtime: '9pm', nickname: 3 },
      answered: ['goal', 'unknown', 'goal'],
    });
    expect(parsed?.draft).toEqual({ ...EMPTY_DRAFT, track: 'esit' });
    expect(parsed?.answered).toEqual(['goal']);
  });

  it('keeps only draft fields when storing', () => {
    const value = storedDraft({ ...EMPTY_DRAFT, grade: 8, extra: 1 } as OnboardingDraft, ['goal', 'goal']);
    expect(value.draft).not.toHaveProperty('extra');
    expect(value.answered).toEqual(['goal']);
  });
});

describe('resumeStep (US-73)', () => {
  it('starts at the grade screen without a draft or a grade', () => {
    expect(resumeStep(null, NOW)).toBe('grade');
    expect(resumeStep(stored({}), NOW)).toBe('grade');
    expect(resumePath(null, NOW)).toEqual([]);
  });

  it('an unsupported grade (1–4) stays on the grade screen', () => {
    expect(resumeStep(stored({ grade: 3, birthYear: 2018 }), NOW)).toBe('grade');
  });

  it('goes to the birth year after the grade', () => {
    expect(resumePath(stored({ grade: 12 }), NOW)).toEqual(['birth-year']);
  });

  it('an invalid birth year is asked again', () => {
    expect(resumeStep(stored({ grade: 12, birthYear: 1990 }), NOW)).toBe('birth-year');
  });

  it('Gherkin: resumes at the first unanswered step and rebuilds the path to it', () => {
    const draft = stored({ grade: 12, birthYear: 2009, targetExam: 'YKS' }, ['goal']);
    expect(resumePath(draft, NOW)).toEqual(['birth-year', 'goal', 'nickname']);
    expect(resumeStep(draft, NOW)).toBe('nickname');
  });

  it('skips steps that do not exist for this student', () => {
    // Grade 7 has no goal step.
    expect(resumeStep(stored({ grade: 7, birthYear: 2013 }, ['nickname']), NOW)).toBe('preferences');
    // Grade 9 now has the optional YKS goal step.
    expect(resumeStep(stored({ grade: 9, birthYear: 2011 }), NOW)).toBe('goal');
  });

  it('ends on the parent step for minors and on preferences for adults', () => {
    const answered: OnboardingStep[] = ['goal', 'nickname', 'preferences'];
    expect(resumeStep(stored({ grade: 12, birthYear: 2009 }, answered), NOW)).toBe('parent');
    expect(resumeStep(stored({ grade: 12, birthYear: 2006 }, answered), NOW)).toBe('preferences');
  });
});

describe('answeredAfterGradeChange', () => {
  it('the goal step is asked again; preferences only when the segment changed', () => {
    const answered: OnboardingStep[] = ['goal', 'nickname', 'preferences'];
    expect(answeredAfterGradeChange(answered, false)).toEqual(['nickname', 'preferences']);
    expect(answeredAfterGradeChange(answered, true)).toEqual(['nickname']);
  });
});
