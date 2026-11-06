import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { APPEARANCE_OPTIONS, setAppearance, useAppearance } from '@/features/appearance/store';

/** US-80: Sistem, Açık or Koyu. Applies at once and is kept for this device. */
export default function AppearanceScreen() {
  const { t } = useTranslation();
  const preference = useAppearance((s) => s.preference);
  const system = useSystemColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <>
      <Stack.Screen options={{ title: t('settings.appearance.title') }} />
      <Page intro={t('settings.appearance.intro')}>
        <Segmented
          label={t('settings.appearance.label')}
          value={preference}
          onChange={setAppearance}
          options={APPEARANCE_OPTIONS.map((value) => ({
            value,
            label: t(`settings.appearance.options.${value}`),
          }))}
        />
        <AppText variant="footnote" color="inkSoft" accessibilityLiveRegion="polite">
          {preference === 'system'
            ? t('settings.appearance.systemHint', { current: t(`settings.appearance.options.${system}`) })
            : t('settings.appearance.fixedHint')}
        </AppText>
      </Page>
    </>
  );
}
