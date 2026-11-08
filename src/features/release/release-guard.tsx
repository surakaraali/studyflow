import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { config } from '@/services/config';

import { currentReleaseIssue } from './state';

/**
 * Top of the tree: a release build without its server settings shows only this screen.
 * Nothing behind it mounts, so there is no sign-up, no session and no local mode.
 */
export function ReleaseGuard({ children }: { children: ReactNode }) {
  if (currentReleaseIssue) return <MissingServerConfigScreen />;
  return children;
}

export function MissingServerConfigScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.paper }]}>
      <View style={styles.text}>
        {/* System font: the headline font is not loaded on this screen. */}
        <AppText variant="heading" accessibilityRole="header">
          {t('release.missingConfig.title')}
        </AppText>
        <AppText variant="body">{t('release.missingConfig.body')}</AppText>
        <AppText variant="callout" color="inkSoft" selectable>
          {t('release.missingConfig.hint', { email: config.supportEmail })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: Gutter,
  },
  text: {
    gap: Space.md,
    maxWidth: 520,
  },
});
