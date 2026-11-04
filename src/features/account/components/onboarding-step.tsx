import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { ageFromBirthYear } from '@/domain/rules';

import { onboardingSteps, type OnboardingStep as Step } from '../onboarding-logic';
import { useOnboarding } from '../onboarding-store';
import { StepBubbles } from './step-bubbles';

type OnboardingStepProps = {
  step: Step;
  title: string;
  intro?: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  loading?: boolean;
  /** A quieter second action under the main button (e.g. "skip"). */
  secondary?: { label: string; onPress: () => void };
};

/** One onboarding question per screen: progress bubbles, a big question, one main action. */
export function OnboardingStep({
  step,
  title,
  intro,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  loading,
  secondary,
}: OnboardingStepProps) {
  const grade = useOnboarding((s) => s.grade);
  const birthYear = useOnboarding((s) => s.birthYear);
  const steps = onboardingSteps(grade, birthYear != null ? ageFromBirthYear(birthYear) : null);
  const current = Math.max(1, steps.indexOf(step) + 1);

  return (
    <Page
      footer={
        <>
          <Button
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            loading={loading}
            block
          />
          {secondary ? (
            <Button label={secondary.label} onPress={secondary.onPress} variant="plain" block />
          ) : null}
        </>
      }>
      <View style={styles.header}>
        <StepBubbles current={current} total={steps.length} />
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {intro ? (
          <AppText variant="callout" color="inkSoft">
            {intro}
          </AppText>
        ) : null}
      </View>
      {children}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Space.md,
  },
});
