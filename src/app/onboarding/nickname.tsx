import { useTranslation } from 'react-i18next';

import { TextField } from '@/components/ui/text-field';
import { OnboardingStep } from '@/features/account/components/onboarding-step';
import { NICKNAME_MAX } from '@/features/account/onboarding-logic';
import { goToNextStep } from '@/features/account/onboarding-nav';
import { updateOnboarding, useOnboarding } from '@/features/account/onboarding-store';

/** US-11: an optional nickname (rumuz). We never ask for the real name (BRD §10.2). */
export default function NicknameStep() {
  const { t } = useTranslation();
  const nickname = useOnboarding((s) => s.nickname);

  return (
    <OnboardingStep
      step="nickname"
      title={t('onboarding.nickname.title')}
      intro={t('onboarding.nickname.intro')}
      primaryLabel={t('common.continue')}
      onPrimary={() => goToNextStep('nickname')}
      secondary={
        nickname.trim()
          ? undefined
          : {
              label: t('onboarding.nickname.skip'),
              onPress: () => {
                updateOnboarding({ nickname: '' });
                goToNextStep('nickname');
              },
            }
      }>
      <TextField
        label={t('onboarding.nickname.label')}
        placeholder={t('onboarding.nickname.placeholder')}
        hint={t('onboarding.nickname.hint', { count: NICKNAME_MAX })}
        value={nickname}
        onChangeText={(value) => updateOnboarding({ nickname: value })}
        maxLength={NICKNAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        textContentType="nickname"
        returnKeyType="next"
        onSubmitEditing={() => goToNextStep('nickname')}
      />
    </OnboardingStep>
  );
}
