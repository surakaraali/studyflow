import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { Track } from '@/domain/rules';
import { ChoiceCard } from '@/features/account/components/choice-card';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import { goalExamFor, needsTrack, TRACKS } from '@/features/account/onboarding-logic';
import { goToNextStep } from '@/features/account/onboarding-nav';
import { updateOnboarding, useOnboarding } from '@/features/account/onboarding-store';

/**
 * US-11 / US-27: LGS is suggested in grade 8, YKS (plus the track) in grades 11–12.
 * US-73: grades 9–10 may pick YKS early; nothing is preselected for them.
 */
export default function GoalStep() {
  const { t } = useTranslation();
  const grade = useOnboarding((s) => s.grade) ?? 8;
  const target = useOnboarding((s) => s.targetExam);
  const track = useOnboarding((s) => s.track);
  const goal = goalExamFor(grade) ?? { exam: 'LGS' as const, suggested: true };
  const exam = goal.exam;
  const isLgs = exam === 'LGS';
  const early = !goal.suggested;

  return (
    <OnboardingStep
      step="goal"
      title={early ? t('onboarding.goal.titleEarly') : isLgs ? t('onboarding.goal.titleLGS') : t('onboarding.goal.titleYKS')}
      intro={early ? t('onboarding.goal.introEarly') : t('onboarding.goal.intro')}
      primaryLabel={t('common.continue')}
      onPrimary={() => goToNextStep('goal')}>
      <View style={styles.choices} accessibilityRole="radiogroup">
        <ChoiceCard
          badge={early ? undefined : t('onboarding.goal.suggested')}
          title={early ? t('onboarding.goal.yesEarly') : isLgs ? t('onboarding.goal.yesLGS') : t('onboarding.goal.yesYKS')}
          selected={target === exam}
          onPress={() => updateOnboarding({ targetExam: exam })}
        />
        <ChoiceCard
          title={t('onboarding.goal.no')}
          selected={target == null}
          onPress={() => updateOnboarding({ targetExam: null, track: null })}
        />
      </View>

      {needsTrack(grade, target) ? (
        <View style={styles.track}>
          <AppText variant="title" accessibilityRole="header">
            {t('onboarding.goal.trackTitle')}
          </AppText>
          <Segmented<Track>
            wrap
            options={TRACKS.map((value) => ({ value, label: t(`onboarding.tracks.${value}`) }))}
            value={track}
            onChange={(value) => updateOnboarding({ track: value === track ? null : value })}
          />
          <AppText variant="footnote" color="inkSoft">
            {t('onboarding.goal.trackHint')}
          </AppText>
        </View>
      ) : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: Space.md,
  },
  track: {
    gap: Space.md,
  },
});
