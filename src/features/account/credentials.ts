/**
 * US-71 / US-72: checks for a new password and a new e-mail address. Pure, unit tested.
 */

import { isValidEmail, PASSWORD_MIN } from '@/domain/rules';

export type NewPasswordError = 'short' | 'same';

export function validateNewPassword(next: string, current?: string): NewPasswordError | null {
  if (next.length < PASSWORD_MIN) return 'short';
  if (current != null && current === next) return 'same';
  return null;
}

export type NewEmailError = 'invalid' | 'same' | 'parent';

/** The new address can't be the current one or the parent's (US-15: they must differ). */
export function validateNewEmail(
  next: string,
  current: string | null,
  parentEmail: string | null,
): NewEmailError | null {
  const value = next.trim().toLowerCase();
  if (!isValidEmail(value)) return 'invalid';
  if (current && value === current.trim().toLowerCase()) return 'same';
  if (parentEmail && value === parentEmail.trim().toLowerCase()) return 'parent';
  return null;
}
