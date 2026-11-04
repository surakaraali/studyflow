import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { birthYearOptions, gradeAgeMismatch, validateBirthYear } from '@/features/account/onboarding-logic';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import { YearGrid } from '@/features/account/components/year-grid';
import { goToNextStep } from '@/features/account/onboarding-nav';
import { updateOnboarding, useOnboarding } from '@/features/account/onboarding-store';

/** US-11 / US-15: birth year only (never the birthday). The age decides the consent rules. */
export default function BirthYearStep() {
  const { t } = useTranslation();
  const grade = useOnboarding((s) => s.grade);
  const birthYear = useOnboarding((s) => s.birthYear);
  const invalid = birthYear != null && validateBirthYear(birthYear) != null;
  const mismatch = birthYear != null && grade != null && !invalid && gradeAgeMismatch(grade, birthYear);

  return (
    <OnboardingStep
      step="birth-year"
      title={t('onboarding.birthYear.title')}
      intro={t('onboarding.birthYear.intro')}
      primaryLabel={t('common.continue')}
      onPrimary={() => goToNextStep('birth-year')}
      primaryDisabled={birthYear == null || invalid}>
      <YearGrid
        years={birthYearOptions()}
        value={birthYear}
        onChange={(year) => updateOnboarding({ birthYear: year })}
      />
      {invalid ? <Banner tone="warning" message={t('onboarding.birthYear.error')} /> : null}
      {mismatch ? <Banner tone="info" message={t('onboarding.birthYear.mismatch', { grade })} /> : null}
    </OnboardingStep>
  );
}
