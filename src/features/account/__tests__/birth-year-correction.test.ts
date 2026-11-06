import {
  canCorrectBirthYear,
  consentAfterCorrection,
  correctionNeedsParentEmail,
  planBirthYearCorrection,
} from '../birth-year-correction';
import { validateNewEmail, validateNewPassword } from '../credentials';

const NOW = new Date(2026, 10, 5); // 5 Nov 2026

type P = Parameters<typeof planBirthYearCorrection>[0];

const profile = (overrides: Partial<P> = {}): P => ({
  onboarding_done: 1,
  birth_year: 2015, // 11: locked while waiting
  birth_year_corrected_at: null,
  consent_status: 'pending',
  parent_email: 'veli@ornek.com',
  ...overrides,
});

describe('canCorrectBirthYear', () => {
  it('only once, and only after onboarding', () => {
    expect(canCorrectBirthYear(profile())).toBe(true);
    expect(canCorrectBirthYear(profile({ birth_year_corrected_at: '2026-11-01T10:00:00.000Z' }))).toBe(false);
    expect(canCorrectBirthYear(profile({ onboarding_done: 0 }))).toBe(false);
    expect(canCorrectBirthYear(null)).toBe(false);
  });
});

describe('consentAfterCorrection (BR-02..BR-04)', () => {
  it('never grants consent; a parent decision stays', () => {
    expect(consentAfterCorrection('pending', 14)).toBe('pending');
    expect(consentAfterCorrection('pending', 19)).toBe('not_required');
    expect(consentAfterCorrection('not_required', 15)).toBe('pending');
    expect(consentAfterCorrection('granted', 12)).toBe('granted');
    expect(consentAfterCorrection('revoked', 14)).toBe('revoked');
  });
});

describe('planBirthYearCorrection (US-75)', () => {
  it('Gherkin: a teen stuck in the under-13 lock moves to limited access, still waiting for a parent', () => {
    const result = planBirthYearCorrection(profile(), { birthYear: 2012, ownEmail: 'ben@ornek.com' }, NOW);
    expect(result).toEqual({
      ok: true,
      plan: {
        changes: { birth_year: 2012, birth_year_corrected_at: NOW.toISOString(), consent_status: 'pending' },
        access: 'limited',
        requestConsent: false,
      },
    });
  });

  it('refuses a second correction, the same year and impossible years', () => {
    const own = { ownEmail: null };
    expect(planBirthYearCorrection(profile({ birth_year_corrected_at: 'x' }), { birthYear: 2012, ...own }, NOW)).toEqual({
      ok: false,
      error: 'already_corrected',
    });
    expect(planBirthYearCorrection(profile(), { birthYear: 2015, ...own }, NOW)).toEqual({ ok: false, error: 'same_year' });
    expect(planBirthYearCorrection(profile(), { birthYear: 1990, ...own }, NOW)).toEqual({ ok: false, error: 'out_of_range' });
    expect(planBirthYearCorrection(profile({ onboarding_done: 0 }), { birthYear: 2012, ...own }, NOW)).toEqual({
      ok: false,
      error: 'not_onboarded',
    });
  });

  it('an adult who is really a minor must give a parent address', () => {
    const adult = profile({ birth_year: 2006, consent_status: 'not_required', parent_email: null });
    expect(correctionNeedsParentEmail(adult, 2011, NOW)).toBe(true);
    expect(planBirthYearCorrection(adult, { birthYear: 2011, ownEmail: 'ben@ornek.com' }, NOW)).toEqual({
      ok: false,
      error: { parentEmail: 'required' },
    });
    expect(
      planBirthYearCorrection(adult, { birthYear: 2011, parentEmail: 'ben@ornek.com', ownEmail: 'ben@ornek.com' }, NOW),
    ).toEqual({ ok: false, error: { parentEmail: 'same_as_own' } });

    const result = planBirthYearCorrection(
      adult,
      { birthYear: 2011, parentEmail: ' Veli@Ornek.com ', ownEmail: 'ben@ornek.com' },
      NOW,
    );
    expect(result.ok && result.plan).toEqual({
      changes: {
        birth_year: 2011,
        birth_year_corrected_at: NOW.toISOString(),
        consent_status: 'pending',
        parent_email: 'veli@ornek.com',
      },
      access: 'limited',
      requestConsent: true,
    });
  });

  it('a waiting minor cannot correct to 18+ (age gate); a granted account stays granted', () => {
    expect(planBirthYearCorrection(profile(), { birthYear: 2007, ownEmail: null }, NOW)).toEqual({
      ok: false,
      error: 'adult_needs_support',
    });
    const toTeen = planBirthYearCorrection(profile({ birth_year: 2016 }), { birthYear: 2011, ownEmail: null }, NOW);
    expect(toTeen.ok && toTeen.plan.access).toBe('limited');

    const granted = planBirthYearCorrection(profile({ birth_year: 2012, consent_status: 'granted' }), { birthYear: 2015, ownEmail: null }, NOW);
    expect(granted.ok && granted.plan.changes.consent_status).toBe('granted');
    expect(granted.ok && granted.plan.access).toBe('full');
    expect(correctionNeedsParentEmail(profile({ consent_status: 'granted' }), 2016, NOW)).toBe(false);
  });

  it('a revoked under-13 stays locked after a correction to another under-13 year', () => {
    const result = planBirthYearCorrection(profile({ consent_status: 'revoked' }), { birthYear: 2016, ownEmail: null }, NOW);
    expect(result.ok && result.plan.access).toBe('locked');
    expect(result.ok && result.plan.changes.consent_status).toBe('revoked');
  });
});

describe('new password and e-mail (US-71, US-72)', () => {
  it('password: at least 8 characters and not the current one', () => {
    expect(validateNewPassword('kısa')).toBe('short');
    expect(validateNewPassword('uzunşifre1')).toBeNull();
    expect(validateNewPassword('uzunşifre1', 'uzunşifre1')).toBe('same');
  });

  it("e-mail: valid, new, and not the parent's", () => {
    expect(validateNewEmail('yok', 'ben@ornek.com', null)).toBe('invalid');
    expect(validateNewEmail(' Ben@Ornek.com ', 'ben@ornek.com', null)).toBe('same');
    expect(validateNewEmail('veli@ornek.com', 'ben@ornek.com', 'Veli@ornek.com')).toBe('parent');
    expect(validateNewEmail('yeni@ornek.com', 'ben@ornek.com', 'veli@ornek.com')).toBeNull();
  });
});
