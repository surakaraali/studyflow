import { validateHomework } from '@/features/homework/validation';

import { validateExam, type ExamDraft } from '../validation';

const today = '2026-11-04';

describe('US-26 exam form', () => {
  const draft: ExamDraft = {
    courseId: 'c1',
    kind: 'yazili',
    title: '',
    date: '2026-11-10',
    time: null,
    topicIds: [],
  };

  it('accepts a future exam without a title', () => {
    expect(validateExam(draft, today)).toEqual({});
  });

  it('needs a course', () => {
    expect(validateExam({ ...draft, courseId: null }, today).course).toBe('required');
  });

  it('allows today but not a past date', () => {
    expect(validateExam({ ...draft, date: today }, today).date).toBeUndefined();
    expect(validateExam({ ...draft, date: '2026-11-03' }, today).date).toBe('past');
  });

  it('lets a passed exam keep its date when edited', () => {
    expect(validateExam({ ...draft, date: '2026-10-20' }, today, '2026-10-20').date).toBeUndefined();
    expect(validateExam({ ...draft, date: '2026-10-21' }, today, '2026-10-20').date).toBe('past');
  });

  it('limits the title', () => {
    expect(validateExam({ ...draft, title: 'x'.repeat(61) }, today).title).toBe('tooLong');
  });
});

describe('US-29 homework form', () => {
  const draft = { courseId: 'c1', description: 'Sayfa 45', dueDate: '2026-11-05' };

  it('accepts valid homework', () => {
    expect(validateHomework(draft, today)).toEqual({});
  });

  it('needs a course and a description', () => {
    expect(validateHomework({ ...draft, courseId: null }, today).course).toBe('required');
    expect(validateHomework({ ...draft, description: '  ' }, today).description).toBe('required');
    expect(validateHomework({ ...draft, description: 'x'.repeat(201) }, today).description).toBe('tooLong');
  });

  it('does not allow a new due date in the past', () => {
    expect(validateHomework({ ...draft, dueDate: '2026-11-03' }, today).dueDate).toBe('past');
    expect(validateHomework({ ...draft, dueDate: '2026-11-03' }, today, '2026-11-03').dueDate).toBeUndefined();
  });
});
