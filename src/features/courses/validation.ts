import { COURSE_NAME_MAX } from '@/domain/rules';

export type CourseNameError = 'required' | 'tooLong' | 'duplicate';

/** Compares course names the way a student would: case and extra spaces do not matter. */
export function sameCourseName(a: string, b: string): boolean {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  return clean(a) === clean(b);
}

/** US-22: a name is required, at most 40 characters, and not used by another course. */
export function validateCourseName(
  name: string,
  others: readonly { id: string; name: string }[],
  selfId?: string,
): CourseNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'required';
  if (trimmed.length > COURSE_NAME_MAX) return 'tooLong';
  if (others.some((c) => c.id !== selfId && sameCourseName(c.name, trimmed))) return 'duplicate';
  return null;
}
