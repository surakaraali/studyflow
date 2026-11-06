import {
  answerNewYear,
  coursesOutsideGrade,
  EMPTY_NEW_YEAR_MEMORY,
  newYearPrompt,
  nextGradeOf,
  schoolYearOf,
  type NewYearInput,
} from '../new-year';

/** A 7th grader who signed up in November 2026 and has no official exam. */
const BASE: NewYearInput = {
  today: '2026-11-05',
  createdOn: '2026-11-05',
  grade: 7,
  targetExamDate: null,
  memory: EMPTY_NEW_YEAR_MEMORY,
};

describe('US-78 school year', () => {
  it('starts on 1 September', () => {
    expect(schoolYearOf('2026-08-31')).toBe(2025);
    expect(schoolYearOf('2026-09-01')).toBe(2026);
    expect(schoolYearOf('2026-11-05')).toBe(2026);
    expect(schoolYearOf('2027-06-20')).toBe(2026);
    expect(schoolYearOf('2027-01-01')).toBe(2026);
  });

  it('knows the next grade we support', () => {
    expect(nextGradeOf(5)).toBe(6);
    expect(nextGradeOf(8)).toBe(9);
    expect(nextGradeOf(11)).toBe(12);
    expect(nextGradeOf(12)).toBeNull();
    expect(nextGradeOf(3)).toBeNull();
    expect(nextGradeOf(null)).toBeNull();
  });
});

describe('US-78 new school year prompt', () => {
  it('does not ask a student who just told us their grade', () => {
    expect(newYearPrompt(BASE)).toBeNull();
    expect(newYearPrompt({ ...BASE, today: '2027-08-31' })).toBeNull();
  });

  it('asks from 1 September of the next school year', () => {
    expect(newYearPrompt({ ...BASE, today: '2027-09-01' })).toEqual({
      schoolYear: 2027,
      grade: 7,
      nextGrade: 8,
      reason: 'september',
    });
    // Still asks later in the year if the student hasn't answered yet.
    expect(newYearPrompt({ ...BASE, today: '2027-12-10' })?.schoolYear).toBe(2027);
  });

  it('asks only once per school year', () => {
    const prompt = newYearPrompt({ ...BASE, today: '2027-09-01' })!;
    for (const moved of [true, false]) {
      const memory = answerNewYear(EMPTY_NEW_YEAR_MEMORY, prompt, moved);
      expect(newYearPrompt({ ...BASE, today: '2027-09-02', memory })).toBeNull();
      expect(newYearPrompt({ ...BASE, today: '2028-08-31', memory })).toBeNull();
      // Next September is a new year again.
      expect(newYearPrompt({ ...BASE, today: '2028-09-01', memory })?.schoolYear).toBe(2028);
    }
  });

  it('never offers a grade after 12', () => {
    expect(newYearPrompt({ ...BASE, grade: 12, today: '2027-09-01' })).toBeNull();
  });

  describe('after the target exam', () => {
    const eighth: NewYearInput = { ...BASE, grade: 8, targetExamDate: '2027-06-12' };

    it('asks the day after the exam, for the coming school year', () => {
      expect(newYearPrompt({ ...eighth, today: '2027-06-12' })).toBeNull();
      expect(newYearPrompt({ ...eighth, today: '2027-06-13' })).toEqual({
        schoolYear: 2027,
        grade: 8,
        nextGrade: 9,
        reason: 'examPassed',
      });
    });

    it('does not ask again in September after a yes in June', () => {
      const prompt = newYearPrompt({ ...eighth, today: '2027-06-13' })!;
      const memory = answerNewYear(EMPTY_NEW_YEAR_MEMORY, prompt, true);
      expect(newYearPrompt({ ...eighth, grade: 9, today: '2027-07-01', memory })).toBeNull();
      expect(newYearPrompt({ ...eighth, grade: 9, today: '2027-09-01', memory })).toBeNull();
    });

    it('asks again in September after a no in June', () => {
      const prompt = newYearPrompt({ ...eighth, today: '2027-06-13' })!;
      const memory = answerNewYear(EMPTY_NEW_YEAR_MEMORY, prompt, false);
      expect(newYearPrompt({ ...eighth, today: '2027-07-01', memory })).toBeNull();
      expect(newYearPrompt({ ...eighth, today: '2027-09-01', memory })).toMatchObject({
        schoolYear: 2027,
        reason: 'september',
      });
    });

    it('ignores an exam that passed before the student signed up', () => {
      expect(newYearPrompt({ ...eighth, createdOn: '2027-07-01', today: '2027-07-02' })).toBeNull();
    });

    it('ignores an old exam date in a later school year', () => {
      // The official date was never updated; a year later it must not trigger again.
      const memory = { through: 2027, examDeclined: null };
      expect(newYearPrompt({ ...eighth, grade: 9, today: '2028-01-15', memory })).toBeNull();
    });

    it('prefers the coming year when a September question was skipped', () => {
      const signedUpEarlier: NewYearInput = { ...eighth, createdOn: '2025-10-01' };
      expect(newYearPrompt({ ...signedUpEarlier, today: '2027-06-20' })).toMatchObject({
        schoolYear: 2027,
        reason: 'examPassed',
      });
      // Answering it also covers the September question it skipped.
      const memory = answerNewYear(EMPTY_NEW_YEAR_MEMORY, { schoolYear: 2027, reason: 'examPassed' }, true);
      expect(newYearPrompt({ ...signedUpEarlier, grade: 9, today: '2027-06-21', memory })).toBeNull();
    });
  });
});

describe('US-78 courses the new grade does not have', () => {
  const course = (catalog_key: string | null, archived_at: string | null = null) => ({
    id: catalog_key ?? 'custom',
    catalog_key,
    archived_at,
  });

  it('offers ortaokul-only courses when moving to lise', () => {
    const courses = [
      course('turkce'),
      course('fen'),
      course('inkilap'),
      course('matematik'),
      course('ingilizce'),
      course(null),
    ];
    expect(coursesOutsideGrade(courses, 9, null).map((c) => c.catalog_key)).toEqual(['turkce', 'fen', 'inkilap']);
  });

  it('keeps archived and custom courses out of the list', () => {
    const courses = [course('turkce', '2027-01-01T00:00:00Z'), course(null)];
    expect(coursesOutsideGrade(courses, 9, null)).toEqual([]);
  });

  it('follows the track in grades 11 and 12', () => {
    const courses = [course('fizik'), course('edebiyat'), course('psikoloji')];
    expect(coursesOutsideGrade(courses, 11, 'sozel').map((c) => c.catalog_key)).toEqual(['fizik']);
    expect(coursesOutsideGrade(courses, 11, 'sayisal').map((c) => c.catalog_key)).toEqual(['psikoloji']);
  });
});
