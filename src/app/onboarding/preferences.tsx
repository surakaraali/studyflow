import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Stepper } from '@/components/ui/stepper';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { ageFromBirthYear, blockRules, breakMinutesFor, segmentForGrade } from '@/domain/rules';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import {
  DAILY_GOAL_STEP,
  dailyGoalRange,
  nextStep,
  segmentDefaults,
} from '@/features/account/onboarding-logic';
import { goToNextStep } from '@/features/account/onboarding-nav';
import { updateOnboarding, useOnboarding } from '@/features/account/onboarding-store';
import { useFinishOnboarding } from '@/features/account/use-finish-onboarding';

/** US-11: daily goal, block length and sleep times, prefilled from the segment (BR-07, BR-09). */
export default function PreferencesStep() {
  const { t } = useTranslation();
  const draft = useOnboarding();
  const { finish, busy, error } = useFinishOnboarding();
  const segment = segmentForGrade(draft.grade ?? 5);
  const defaults = segmentDefaults(segment);
  const block = blockRules(segment);
  const goalRange = dailyGoalRange(segment);

  const dailyGoal = draft.dailyGoal ?? defaults.dailyGoal;
  const blockMin = draft.blockMin ?? defaults.blockMin;
  const bedtime = draft.bedtime ?? defaults.bedtime;
  const wake = draft.wake ?? defaults.wake;

  const age = draft.birthYear != null ? ageFromBirthYear(draft.birthYear) : null;
  const isLast = nextStep('preferences', draft.grade, age) == null;
  const minutes = (value: number) => t('common.minutes', { count: value });

  return (
    <OnboardingStep
      step="preferences"
      title={t('onboarding.preferences.title')}
      intro={t('onboarding.preferences.intro')}
      primaryLabel={isLast ? t('onboarding.finish') : t('common.continue')}
      onPrimary={isLast ? finish : () => goToNextStep('preferences')}
      loading={busy}>
      <View style={styles.group}>
        <Stepper
          label={t('onboarding.preferences.dailyGoal')}
          value={dailyGoal}
          min={goalRange.min}
          max={goalRange.max}
          step={DAILY_GOAL_STEP}
          format={minutes}
          onChange={(value) => updateOnboarding({ dailyGoal: value })}
        />
        <Stepper
          label={t('onboarding.preferences.block')}
          value={blockMin}
          min={block.min}
          max={block.max}
          step={5}
          format={minutes}
          onChange={(value) => updateOnboarding({ blockMin: value })}
        />
        <AppText variant="footnote" color="inkSoft">
          {t('onboarding.preferences.breakNote', { count: breakMinutesFor(segment, blockMin) })}
        </AppText>
      </View>

      <View style={styles.group}>
        <DateTimeField
          label={t('onboarding.preferences.bedtime')}
          mode="time"
          value={bedtime}
          onChange={(value) => updateOnboarding({ bedtime: value })}
        />
        <DateTimeField
          label={t('onboarding.preferences.wake')}
          mode="time"
          value={wake}
          onChange={(value) => updateOnboarding({ wake: value })}
        />
        <AppText variant="footnote" color="inkSoft">
          {t('onboarding.preferences.sleepNote')}
        </AppText>
      </View>

      {error ? <Banner tone="warning" message={error} /> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.md,
  },
});
