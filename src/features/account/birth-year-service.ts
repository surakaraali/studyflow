/**
 * US-75: the one birth-year correction. With Supabase the server decides first (its guard
 * allows exactly one change and derives consent_status), so the device and the server never
 * disagree about whether the correction was used. Local mode applies the same rules on device.
 */

import { patch } from '@/db/write';
import type { AccessLevel, ConsentStatus } from '@/domain/rules';
import { requestConsent } from '@/features/consent/service';
import { supabase } from '@/services/supabase';
import { useSession } from '@/stores/session';

import { planBirthYearCorrection, type CorrectionError } from './birth-year-correction';

export type CorrectionResult =
  | { ok: true; access: AccessLevel; consentSent: boolean | null }
  | { ok: false; error: CorrectionError | 'network' };

const STATUSES: readonly ConsentStatus[] = ['not_required', 'pending', 'granted', 'revoked'];

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function correctBirthYear(birthYear: number, parentEmail?: string): Promise<CorrectionResult> {
  const { profile, user } = useSession.getState();
  if (!profile) return { ok: false, error: 'not_onboarded' };
  const planned = planBirthYearCorrection(profile, {
    birthYear,
    parentEmail,
    ownEmail: user?.email ?? profile.email,
  });
  if (!planned.ok) return planned;
  const { plan } = planned;
  const changes: Record<string, unknown> = { ...plan.changes };

  const sb = supabase();
  if (sb) {
    // updated_at is left alone on purpose: a device clock behind the server would make the
    // last-write-wins trigger drop this edit.
    const { data, error } = await sb
      .from('profiles')
      .update({ birth_year: birthYear, ...(plan.changes.parent_email ? { parent_email: plan.changes.parent_email } : {}) })
      .eq('id', profile.id)
      .select('birth_year, birth_year_corrected_at, consent_status')
      .maybeSingle();
    if (error || !data) return { ok: false, error: 'network' };
    const row = data as { birth_year: number | null; birth_year_corrected_at: unknown; consent_status: unknown };
    // The guard keeps the old year when the one correction was already used (another device).
    if (row.birth_year !== birthYear) {
      await patch('profile', profile.id, {
        birth_year: row.birth_year,
        birth_year_corrected_at: isoOrNull(row.birth_year_corrected_at) ?? profile.birth_year_corrected_at,
      });
      return { ok: false, error: 'already_corrected' };
    }
    changes.birth_year_corrected_at = isoOrNull(row.birth_year_corrected_at) ?? plan.changes.birth_year_corrected_at;
    if (STATUSES.includes(row.consent_status as ConsentStatus)) changes.consent_status = row.consent_status;
  }

  await patch('profile', profile.id, changes);

  let consentSent: boolean | null = null;
  if (plan.requestConsent && plan.changes.parent_email) {
    // The correction is saved either way; the consent screens offer "send again".
    const sent = await requestConsent(plan.changes.parent_email).catch(() => null);
    consentSent = sent?.ok ?? false;
  }
  return { ok: true, access: plan.access, consentSent };
}
