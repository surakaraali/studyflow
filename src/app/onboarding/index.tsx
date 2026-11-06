import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { AppText } from '@/components/ui/text';
import { isGradeSupported } from '@/domain/rules';
import { GradePicker } from '@/features/account/components/grade-picker';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import { goToNextStep, resumeOnboarding } from '@/features/account/onboarding-nav';
import { chooseGrade, useOnboarding } from '@/features/account/onboarding-store';
import { signOut } from '@/features/account/service';

/**
 * US-11 step 1: grade 1–12. Grades 1–4 go to the "coming soon" screen.
 * US-73: this is the onboarding home, so it also reopens a half-finished onboarding.
 */
export default function GradeStep() {
  const { t } = useTranslation();
  const grade = useOnboarding((s) => s.grade);

  useEffect(() => {
    void resumeOnboarding();
  }, []);

  const next = () => {
    if (grade == null) return;
    if (!isGradeSupported(grade)) {
      router.push('/onboarding/primary');
      return;
    }
    goToNextStep('grade');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              onPress={() => void signOut()}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
              <AppText variant="callout" color="pen">
                {t('onboarding.signOut')}
              </AppText>
            </Pressable>
          ),
        }}
      />
      <OnboardingStep
        step="grade"
        title={t('onboarding.grade.title')}
        intro={t('onboarding.grade.intro')}
        primaryLabel={t('common.continue')}
        onPrimary={next}
        primaryDisabled={grade == null}>
        <GradePicker value={grade} onChange={chooseGrade} />
      </OnboardingStep>
    </>
  );
}
