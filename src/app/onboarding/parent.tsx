import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { TextField } from '@/components/ui/text-field';
import { ageFromBirthYear } from '@/domain/rules';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import { validateParentEmail, type EmailError } from '@/features/account/onboarding-logic';
import { updateOnboarding, useOnboarding } from '@/features/account/onboarding-store';
import { useFinishOnboarding } from '@/features/account/use-finish-onboarding';
import { useSession } from '@/stores/session';

/** US-15: under 18 the parent's email is required, and it can't be the student's own. */
export default function ParentStep() {
  const { t } = useTranslation();
  const parentEmail = useOnboarding((s) => s.parentEmail);
  const birthYear = useOnboarding((s) => s.birthYear);
  const ownEmail = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const { finish, busy, error } = useFinishOnboarding();
  const [showError, setShowError] = useState(false);

  const age = birthYear != null ? ageFromBirthYear(birthYear) : 17;
  const validation = validateParentEmail(parentEmail, ownEmail);

  const messages: Record<EmailError, string> = {
    required: t('onboarding.parent.required'),
    invalid: t('onboarding.parent.invalid'),
    same_as_own: t('onboarding.parent.sameAsOwn'),
  };

  const submit = () => {
    setShowError(true);
    if (validation) return;
    void finish();
  };

  return (
    <OnboardingStep
      step="parent"
      title={t('onboarding.parent.title')}
      intro={age < 13 ? t('onboarding.parent.introChild') : t('onboarding.parent.introTeen')}
      primaryLabel={t('onboarding.parent.submit')}
      onPrimary={submit}
      loading={busy}>
      <TextField
        label={t('onboarding.parent.label')}
        placeholder={t('onboarding.parent.placeholder')}
        hint={t('onboarding.parent.why')}
        value={parentEmail}
        onChangeText={(value) => updateOnboarding({ parentEmail: value })}
        error={showError && validation ? messages[validation] : null}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {error ? <Banner tone="warning" message={error} /> : null}
    </OnboardingStep>
  );
}
