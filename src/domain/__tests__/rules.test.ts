import {
  accessLevel,
  ageFromBirthYear,
  blockRules,
  breakMinutesFor,
  clampBlockMinutes,
  dailyCapMinutes,
  dayCountsForStreak,
  defaultSleep,
  examNet,
  fromMinutes,
  isGradeSupported,
  isQuietTime,
  isValidEmail,
  newCardLimit,
  quizOptionCount,
  quota,
  quotaMonth,
  segmentForGrade,
  suggestedTargetExam,
  toMinutes,
} from '../rules';

describe('BR-01 segments', () => {
  it.each([
    [1, 'ilkokul'],
    [4, 'ilkokul'],
    [5, 'ortaokul'],
    [8, 'ortaokul'],
    [9, 'lise'],
    [12, 'lise'],
  ])('grade %i is %s', (grade, segment) => {
    expect(segmentForGrade(grade)).toBe(segment);
  });

  it('supports grades 5–12 in R1', () => {
    expect(isGradeSupported(4)).toBe(false);
    expect(isGradeSupported(5)).toBe(true);
    expect(isGradeSupported(12)).toBe(true);
  });
});

describe('BR-02 / BR-03 access while waiting for consent', () => {
  it('locks under-13s until a parent consents', () => {
    expect(accessLevel(12, 'pending')).toBe('locked');
    expect(accessLevel(12, 'granted')).toBe('full');
  });

  it('limits 13–17 year olds', () => {
    expect(accessLevel(13, 'pending')).toBe('limited');
    expect(accessLevel(17, 'revoked')).toBe('limited');
    expect(accessLevel(17, 'granted')).toBe('full');
  });

  it('gives adults full access', () => {
    expect(accessLevel(18, 'not_required')).toBe('full');
  });

  it('computes age from the birth year', () => {
    expect(ageFromBirthYear(2009, new Date(2026, 10, 4))).toBe(17);
  });
});

describe('BR-07 blocks', () => {
  it('has segment defaults', () => {
    expect(blockRules('ilkokul')).toMatchObject({ study: 15, break: 5 });
    expect(blockRules('ortaokul')).toMatchObject({ study: 25, break: 5 });
    expect(blockRules('lise')).toMatchObject({ study: 40, break: 10 });
  });

  it('clamps to the segment range', () => {
    expect(clampBlockMinutes('ortaokul', 10)).toBe(20);
    expect(clampBlockMinutes('lise', 90)).toBe(60);
    expect(clampBlockMinutes('lise', 45)).toBe(45);
  });

  it('keeps the break ratio', () => {
    expect(breakMinutesFor('lise', 40)).toBe(10);
    expect(breakMinutesFor('ortaokul', 25)).toBe(5);
  });
});

describe('BR-08 daily cap', () => {
  it('uses segment caps and +25% at weekends', () => {
    expect(dailyCapMinutes('ortaokul', false)).toBe(150);
    expect(dailyCapMinutes('lise', true)).toBe(375);
    expect(dailyCapMinutes('ilkokul', true)).toBe(75);
  });

  it('lets a parent lower but never raise the cap', () => {
    expect(dailyCapMinutes('ortaokul', false, 90)).toBe(90);
    expect(dailyCapMinutes('ortaokul', false, 500)).toBe(150);
  });
});

describe('BR-09 sleep', () => {
  it('has default bedtimes', () => {
    expect(defaultSleep('ilkokul').bedtime).toBe('21:00');
    expect(defaultSleep('ortaokul').bedtime).toBe('22:00');
    expect(defaultSleep('lise').bedtime).toBe('23:30');
  });
});

describe('BR-12 / BR-13 quizzes and nets', () => {
  it('uses 3, 4 or 5 options', () => {
    expect(quizOptionCount('ilkokul')).toBe(3);
    expect(quizOptionCount('ortaokul')).toBe(4);
    expect(quizOptionCount('lise')).toBe(5);
  });

  it('computes LGS and YKS nets', () => {
    expect(examNet('LGS', 15, 3)).toBe(14);
    expect(examNet('YKS', 30, 8)).toBe(28);
    expect(examNet('YKS', 10, 1)).toBe(9.75);
  });

  it('suggests the target exam by grade', () => {
    expect(suggestedTargetExam(8)).toBe('LGS');
    expect(suggestedTargetExam(10)).toBeNull();
    expect(suggestedTargetExam(12)).toBe('YKS');
  });
});

describe('BR-14 quota', () => {
  it('has free and pro limits', () => {
    expect(quota('free')).toEqual({ documents: 3, pages: 20 });
    expect(quota('pro')).toEqual({ documents: 40, pages: 100 });
  });

  it('resets monthly', () => {
    expect(quotaMonth(new Date(2026, 0, 31))).toBe('2026-01');
    expect(quotaMonth(new Date(2026, 10, 1))).toBe('2026-11');
  });
});

describe('BR-16 quiet hours', () => {
  const at = (h: number, m: number) => new Date(2026, 10, 4, h, m);

  it('silences 20:30–08:00 under 13 (US-60 scenario)', () => {
    expect(isQuietTime(at(20, 45), 12)).toBe(true);
    expect(isQuietTime(at(7, 59), 12)).toBe(true);
    expect(isQuietTime(at(8, 0), 12)).toBe(false);
    expect(isQuietTime(at(20, 29), 12)).toBe(false);
  });

  it('silences 23:00–07:30 for everyone else', () => {
    expect(isQuietTime(at(20, 45), 15)).toBe(false);
    expect(isQuietTime(at(23, 0), 15)).toBe(true);
    expect(isQuietTime(at(7, 30), 15)).toBe(false);
  });
});

describe('BR-17 / BR-22', () => {
  it('counts a streak day with a block or 10 minutes', () => {
    expect(dayCountsForStreak(1, 0)).toBe(true);
    expect(dayCountsForStreak(0, 10)).toBe(true);
    expect(dayCountsForStreak(0, 9)).toBe(false);
  });

  it('limits new cards per day', () => {
    expect(newCardLimit('ilkokul')).toBe(10);
    expect(newCardLimit('ortaokul')).toBe(20);
    expect(newCardLimit('lise')).toBe(30);
  });
});

describe('helpers', () => {
  it('converts times', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(fromMinutes(910)).toBe('15:10');
  });

  it('validates emails', () => {
    expect(isValidEmail('ogrenci@ornek.com')).toBe(true);
    expect(isValidEmail('ogrenci@')).toBe(false);
  });
});
