/**
 * US-75: one correction of a wrongly entered birth year. Pure functions, unit tested.
 *
 * The rules mirror the server guard (supabase/migrations/20261105000001_birth_year_correction.sql):
 *   - only after onboarding, and only once (birth_year_corrected_at is set);
 *   - a parent's decision (granted / revoked) stays as it is;
 *   - otherwise the new age decides: under 18 waits for a parent ('pending'), 18+ needs
 *     none ('not_required'). A correction never grants consent by itself (BR-02..BR-04);
 *   - an account already waiting for a parent can't correct itself to 18+: that would let a
 *     child step around the age gate, so an adult who mistyped asks support instead.
 */

import type { Profile } from '@/db/types';
import { accessLevel, ageFromBirthYear, needsParentConsent, type AccessLevel, type ConsentStatus } from '@/domain/rules';

import { validateBirthYear, validateParentEmail, type EmailError } from './onboarding-logic';

type CorrectableProfile = Pick<
  Profile,
  'onboarding_done' | 'birth_year' | 'birth_year_corrected_at' | 'consent_status' | 'parent_email'
>;

export function canCorrectBirthYear(profile: CorrectableProfile | null): boolean {
  return profile != null && profile.onboarding_done === 1 && profile.birth_year_corrected_at == null;
}

export function consentAfterCorrection(current: ConsentStatus, age: number): ConsentStatus {
  if (current === 'granted' || current === 'revoked') return current;
  return needsParentConsent(age) ? 'pending' : 'not_required';
}

/** A minor who never needed a parent (or has no parent address yet) must give one now. */
export function correctionNeedsParentEmail(
  profile: CorrectableProfile,
  birthYear: number,
  now: Date = new Date(),
): boolean {
  const next = consentAfterCorrection(profile.consent_status, ageFromBirthYear(birthYear, now));
  return next === 'pending' && (profile.consent_status === 'not_required' || !profile.parent_email);
}

export type CorrectionError =
  | 'already_corrected'
  | 'not_onboarded'
  | 'same_year'
  | 'out_of_range'
  | 'adult_needs_support'
  | { parentEmail: EmailError };

export type CorrectionPlan = {
  changes: {
    birth_year: number;
    birth_year_corrected_at: string;
    consent_status: ConsentStatus;
    parent_email?: string;
  };
  /** Access after the correction (BR-02 locked, BR-03 limited, or full). */
  access: AccessLevel;
  /** True when a consent link has to go to the (new) parent address. */
  requestConsent: boolean;
};

export function planBirthYearCorrection(
  profile: CorrectableProfile,
  input: { birthYear: number; parentEmail?: string; ownEmail: string | null },
  now: Date = new Date(),
): { ok: true; plan: CorrectionPlan } | { ok: false; error: CorrectionError } {
  if (profile.onboarding_done !== 1 || profile.birth_year == null) return { ok: false, error: 'not_onboarded' };
  if (profile.birth_year_corrected_at != null) return { ok: false, error: 'already_corrected' };
  if (input.birthYear === profile.birth_year) return { ok: false, error: 'same_year' };
  if (validateBirthYear(input.birthYear, now)) return { ok: false, error: 'out_of_range' };

  const age = ageFromBirthYear(input.birthYear, now);
  if (profile.consent_status === 'pending' && !needsParentConsent(age)) {
    return { ok: false, error: 'adult_needs_support' };
  }
  const consent = consentAfterCorrection(profile.consent_status, age);
  const requestConsent = correctionNeedsParentEmail(profile, input.birthYear, now);

  const changes: CorrectionPlan['changes'] = {
    birth_year: input.birthYear,
    birth_year_corrected_at: now.toISOString(),
    consent_status: consent,
  };
  if (requestConsent) {
    const emailError = validateParentEmail(input.parentEmail ?? '', input.ownEmail);
    if (emailError) return { ok: false, error: { parentEmail: emailError } };
    changes.parent_email = (input.parentEmail ?? '').trim().toLowerCase();
  }

  return { ok: true, plan: { changes, access: accessLevel(age, consent), requestConsent } };
}
