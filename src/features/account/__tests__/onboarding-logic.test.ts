import {
  applyGradeChange,
  birthYearOptions,
  buildOnboardingProfile,
  clampDailyGoal,
  consentStatusForAge,
  gradeAgeMismatch,
  isDeleteConfirmation,
  needsTrack,
  nextStep,
  normalizeNickname,
  onboardingSteps,
  targetExamChoices,
  validateBirthYear,
  validateParentEmail,
  type OnboardingDraft,
} from '../onboarding-logic';

const NOW = new Date(2026, 10, 4); // 4 Nov 2026

const draft = (overrides: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  grade: 12,
  birthYear: 2009,
  targetExam: 'YKS',
  track: 'sayisal',
  nickname: '',
  dailyGoal: null,
  blockMin: null,
  bedtime: null,
  wake: null,
  parentEmail: 'veli@ornek.com',
  ...overrides,
});

describe('birth year', () => {
  it('offers ages 5 to 25, oldest first', () => {
    const years = birthYearOptions(NOW);
    expect(years[0]).toBe(2001);
    expect(years.at(-1)).toBe(2021);
    expect(years).toHaveLength(21);
  });

  it('rejects ages outside 5–25', () => {
    expect(validateBirthYear(2009, NOW)).toBeNull();
    expect(validateBirthYear(2021, NOW)).toBeNull();
    expect(validateBirthYear(2022, NOW)).toBe('out_of_range');
    expect(validateBirthYear(2000, NOW)).toBe('out_of_range');
    expect(validateBirthYear(2009.5, NOW)).toBe('out_of_range');
  });

  it('flags a birth year far from the usual age for the grade', () => {
    // grade 12 ≈ 18 years old
    expect(gradeAgeMismatch(12, 2008, NOW)).toBe(false);
    expect(gradeAgeMismatch(12, 2010, NOW)).toBe(false);
    expect(gradeAgeMismatch(12, 2014, NOW)).toBe(true);
    expect(gradeAgeMismatch(6, 2014, NOW)).toBe(false);
  });
});

describe('steps', () => {
  it('Gherkin: grade 12, born 2009 → YKS goal step and parent step', () => {
    const age = 2026 - 2009;
    expect(onboardingSteps(12, age)).toEqual([
      'grade',
      'birth-year',
      'goal',
      'nickname',
      'preferences',
      'parent',
    ]);
    expect(nextStep('preferences', 12, age)).toBe('parent');
  });

  it('skips the goal step when no exam is suggested and the parent step for adults', () => {
    expect(onboardingSteps(10, 19)).toEqual(['grade', 'birth-year', 'nickname', 'preferences']);
    expect(nextStep('preferences', 10, 19)).toBeNull();
    expect(nextStep('birth-year', 8, 14)).toBe('goal');
    expect(nextStep('birth-year', 7, 13)).toBe('nickname');
  });

  it('assumes a parent step until the age is known', () => {
    expect(onboardingSteps(null, null).at(-1)).toBe('parent');
  });
});

describe('target exam and track', () => {
  it('LGS for middle school, YKS for high school', () => {
    expect(targetExamChoices(3)).toEqual([]);
    expect(targetExamChoices(7)).toEqual(['LGS']);
    expect(targetExamChoices(10)).toEqual(['YKS']);
    expect(needsTrack(11, 'YKS')).toBe(true);
    expect(needsTrack(10, 'YKS')).toBe(false);
    expect(needsTrack(12, null)).toBe(false);
  });
});

describe('parent email (US-15)', () => {
  it('is required, valid and not the student’s own', () => {
    expect(validateParentEmail('', 'ogrenci@ornek.com')).toBe('required');
    expect(validateParentEmail('veli@', 'ogrenci@ornek.com')).toBe('invalid');
    expect(validateParentEmail(' Ogrenci@Ornek.com ', 'ogrenci@ornek.com')).toBe('same_as_own');
    expect(validateParentEmail('veli@ornek.com', 'ogrenci@ornek.com')).toBeNull();
    // Apple "hide my email" may leave the student without an address.
    expect(validateParentEmail('veli@ornek.com', null)).toBeNull();
  });
});

describe('buildOnboardingProfile', () => {
  it('Gherkin: grade 12 → segment lise, consent pending', () => {
    const result = buildOnboardingProfile(draft(), 'ogrenci@ornek.com', NOW);
    expect(result).toEqual({
      ok: true,
      profile: {
        grade: 12,
        segment: 'lise',
        birth_year: 2009,
        track: 'sayisal',
        target_exam: 'YKS',
        nickname: null,
        daily_goal_min: 120,
        block_min: 40,
        break_min: 10,
        bedtime: '23:30',
        wake_time: '07:00',
        consent_status: 'pending',
        parent_email: 'veli@ornek.com',
      },
    });
  });

  it('needs no parent at 18+', () => {
    const result = buildOnboardingProfile(draft({ birthYear: 2007, parentEmail: '' }), null, NOW);
    expect(result.ok && result.profile.consent_status).toBe('not_required');
    expect(result.ok && result.profile.parent_email).toBeNull();
  });

  it('refuses a missing parent email under 18', () => {
    expect(buildOnboardingProfile(draft({ parentEmail: '' }), null, NOW)).toEqual({
      ok: false,
      error: 'parent_email',
    });
  });

  it('refuses primary school grades and missing answers', () => {
    expect(buildOnboardingProfile(draft({ grade: 3 }), null, NOW)).toEqual({
      ok: false,
      error: 'unsupported_grade',
    });
    expect(buildOnboardingProfile(draft({ grade: null }), null, NOW)).toEqual({ ok: false, error: 'grade' });
    expect(buildOnboardingProfile(draft({ birthYear: null }), null, NOW)).toEqual({
      ok: false,
      error: 'birth_year',
    });
  });

  it('clamps preferences to the segment and drops impossible choices', () => {
    const result = buildOnboardingProfile(
      draft({ grade: 6, birthYear: 2014, targetExam: 'YKS', track: 'dil', blockMin: 90, dailyGoal: 500, nickname: '  Yıldız   Tozu ' }),
      null,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.segment).toBe('ortaokul');
    expect(result.profile.target_exam).toBeNull();
    expect(result.profile.track).toBeNull();
    expect(result.profile.block_min).toBe(40);
    expect(result.profile.daily_goal_min).toBe(150);
    expect(result.profile.nickname).toBe('Yıldız Tozu');
  });
});

describe('applyGradeChange (US-12)', () => {
  const middle = {
    grade: 8,
    segment: 'ortaokul' as const,
    target_exam: 'LGS' as const,
    track: null,
    block_min: 30,
    daily_goal_min: 90,
  };

  it('re-applies segment defaults when the segment changes', () => {
    const { segmentChanged, changes } = applyGradeChange(middle, 11);
    expect(segmentChanged).toBe(true);
    expect(changes).toMatchObject({
      grade: 11,
      segment: 'lise',
      target_exam: 'YKS',
      block_min: 40,
      break_min: 10,
      daily_goal_min: 120,
    });
  });

  it('keeps the student’s settings inside the same segment', () => {
    const { segmentChanged, changes } = applyGradeChange(middle, 7);
    expect(segmentChanged).toBe(false);
    expect(changes).toMatchObject({ grade: 7, target_exam: 'LGS', block_min: 30, daily_goal_min: 90 });
  });

  it('drops the track below grade 11', () => {
    const high = { ...middle, grade: 12, segment: 'lise' as const, target_exam: 'YKS' as const, track: 'esit' as const };
    expect(applyGradeChange(high, 11).changes.track).toBe('esit');
    expect(applyGradeChange(high, 10).changes.track).toBeNull();
  });
});

describe('small helpers', () => {
  it('clamps the daily goal to 15-minute steps within the cap', () => {
    expect(clampDailyGoal('ortaokul', 5)).toBe(15);
    expect(clampDailyGoal('ortaokul', 66)).toBe(60);
    expect(clampDailyGoal('ortaokul', 68)).toBe(75);
    expect(clampDailyGoal('lise', 1000)).toBe(300);
  });

  it('normalizes nicknames', () => {
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname('a'.repeat(30))).toHaveLength(20);
  });

  it('clears pending consent once the student is 18', () => {
    expect(consentStatusForAge(18, 'pending')).toBe('not_required');
    expect(consentStatusForAge(16, 'pending')).toBe('pending');
    expect(consentStatusForAge(18, 'granted')).toBe('granted');
  });

  it('accepts SİL in any case, with either keyboard', () => {
    expect(isDeleteConfirmation('SİL')).toBe(true);
    expect(isDeleteConfirmation(' sil ')).toBe(true);
    expect(isDeleteConfirmation('SIL')).toBe(true);
    expect(isDeleteConfirmation('sill')).toBe(false);
    expect(isDeleteConfirmation('')).toBe(false);
  });
});
