import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { accessLevel, ageFromBirthYear, needsParentConsent, type AccessLevel } from '@/domain/rules';
import {
  canCorrectBirthYear,
  consentAfterCorrection,
  correctionNeedsParentEmail,
} from '@/features/account/birth-year-correction';
import { correctBirthYear } from '@/features/account/birth-year-service';
import {
  birthYearOptions,
  validateBirthYear,
  validateParentEmail,
  type EmailError,
} from '@/features/account/onboarding-logic';
import i18n from '@/i18n';
import { formatLongDate, localeTag } from '@/lib/dates';
import { config } from '@/services/config';
import { useSession } from '@/stores/session';

import { YearGrid } from './year-grid';

type BirthYearCorrectionProps = {
  onCancel?: () => void;
  /** After a saved correction (the root layout may also move to another group). */
  onDone?: () => void;
};

const ACCESS_KEYS: Record<AccessLevel, 'accessFull' | 'accessLimited' | 'accessLocked'> = {
  full: 'accessFull',
  limited: 'accessLimited',
  locked: 'accessLocked',
};

/**
 * US-75: pick the right birth year once. Shows what the new age means (BR-02, BR-03) and
 * asks for a parent address when a "grown-up" turns out to be under 18.
 */
export function BirthYearCorrection({ onCancel, onDone }: BirthYearCorrectionProps) {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const ownEmail = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const [year, setYear] = useState<number | null>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  if (!profile) return null;

  if (!canCorrectBirthYear(profile)) {
    if (message) return <Banner tone={message.tone} message={message.text} />;
    const date = profile.birth_year_corrected_at
      ? formatLongDate(new Date(profile.birth_year_corrected_at), localeTag(i18n.language))
      : '';
    return <Banner tone="info" message={t('profile.birthYear.used', { date })} />;
  }

  const changed = year != null && year !== profile.birth_year && validateBirthYear(year) == null;
  // Waiting for a parent and picking 18+: refused (age gate), so say so before the tap.
  const adultBlocked = changed && profile.consent_status === 'pending' && !needsParentConsent(ageFromBirthYear(year));
  const needsParent = changed && !adultBlocked && correctionNeedsParentEmail(profile, year);
  const parentError = needsParent ? validateParentEmail(parentEmail, ownEmail) : null;
  const previewAccess = changed && !adultBlocked
    ? accessLevel(ageFromBirthYear(year), consentAfterCorrection(profile.consent_status, ageFromBirthYear(year)))
    : null;

  const emailMessages: Record<EmailError, string> = {
    required: t('onboarding.parent.required'),
    invalid: t('onboarding.parent.invalid'),
    same_as_own: t('onboarding.parent.sameAsOwn'),
  };

  const submit = async () => {
    setShowErrors(true);
    setMessage(null);
    if (!changed || year == null || parentError) return;
    setBusy(true);
    try {
      const result = await correctBirthYear(year, needsParent ? parentEmail : undefined);
      if (result.ok) {
        setMessage(
          result.consentSent === false
            ? { tone: 'warning', text: t('profile.birthYear.sendFailed') }
            : { tone: 'success', text: t('profile.birthYear.done') },
        );
        onDone?.();
        return;
      }
      const error = result.error;
      const text =
        error === 'already_corrected'
          ? t('profile.birthYear.alreadyUsed')
          : error === 'same_year'
            ? t('profile.birthYear.same')
            : error === 'out_of_range'
              ? t('onboarding.birthYear.error')
              : error === 'adult_needs_support'
                ? t('profile.birthYear.adultNeedsSupport', { email: config.supportEmail })
              : typeof error === 'object'
                ? emailMessages[error.parentEmail]
                : t('profile.birthYear.error');
      setMessage({ tone: 'warning', text });
    } catch {
      setMessage({ tone: 'warning', text: t('profile.birthYear.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="callout" color="inkSoft">
        {t('profile.birthYear.intro')}
      </AppText>
      <YearGrid years={birthYearOptions()} value={year ?? profile.birth_year} onChange={setYear} />

      {previewAccess ? <Banner tone="info" message={t(`profile.birthYear.${ACCESS_KEYS[previewAccess]}`)} /> : null}
      {adultBlocked ? (
        <Banner tone="warning" message={t('profile.birthYear.adultNeedsSupport', { email: config.supportEmail })} />
      ) : null}

      {needsParent ? (
        <TextField
          label={t('onboarding.parent.label')}
          placeholder={t('onboarding.parent.placeholder')}
          hint={t('profile.birthYear.parentNeeded')}
          value={parentEmail}
          onChangeText={setParentEmail}
          error={showErrors && parentError ? emailMessages[parentError] : null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
      ) : null}

      <AppText variant="footnote" color="exam">
        {t('profile.birthYear.once')}
      </AppText>
      {message ? <Banner tone={message.tone} message={message.text} /> : null}
      <Button label={t('profile.birthYear.submit')} onPress={submit} disabled={!changed || adultBlocked} loading={busy} block />
      {onCancel ? <Button label={t('profile.birthYear.cancel')} variant="plain" onPress={onCancel} block /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
  },
});
