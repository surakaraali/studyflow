export const HOMEWORK_DESCRIPTION_MAX = 200;

export type HomeworkDraft = {
  courseId: string | null;
  description: string;
  dueDate: string;
};

export type HomeworkErrors = {
  course?: 'required';
  description?: 'required' | 'tooLong';
  dueDate?: 'past';
};

/** US-29: course and description are required; a new due date cannot be in the past. */
export function validateHomework(
  draft: HomeworkDraft,
  today: string,
  originalDueDate?: string,
): HomeworkErrors {
  const errors: HomeworkErrors = {};
  const description = draft.description.trim();
  if (!draft.courseId) errors.course = 'required';
  if (!description) errors.description = 'required';
  else if (description.length > HOMEWORK_DESCRIPTION_MAX) errors.description = 'tooLong';
  if (draft.dueDate < today && draft.dueDate !== originalDueDate) errors.dueDate = 'past';
  return errors;
}
