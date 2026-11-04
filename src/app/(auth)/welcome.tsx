import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightMark } from '@/components/highlight-mark';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Gutter, Radius, Space } from '@/constants/theme';
import { setAccountNotice, useAccountNotice } from '@/features/account/account-notice';
import { authErrorMessage } from '@/features/account/auth-errors';
import { OptikSheet } from '@/features/account/components/optik-sheet';
import { appleSignInAvailable, signInWithApple } from '@/features/account/service';
import { LegalLinks } from '@/features/legal/components/legal-links';
import { useTheme } from '@/hooks/use-theme';
import { isLocalMode } from '@/services/config';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const notice = useAccountNotice((s) => s.notice);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    appleSignInAvailable().then((available) => {
      if (alive) setAppleAvailable(available);
    });
    return () => {
      alive = false;
    };
  }, []);

  const continueWithApple = async () => {
    setError(null);
    setAppleBusy(true);
    try {
      const result = await signInWithApple();
      if (!result.ok && result.error !== 'cancelled') {
        setError(result.error === 'unknown' ? t('auth.apple.failed') : authErrorMessage(t, result.error));
      }
    } catch {
      setError(t('auth.apple.failed'));
    } finally {
      setAppleBusy(false);
    }
  };

  const go = (path: '/sign-up' | '/sign-in') => {
    setAccountNotice(null);
    router.push(path);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Space.xl, paddingBottom: insets.bottom + Space.lg },
      ]}>
      <View style={styles.hero}>
        <OptikSheet />
        <View style={styles.brand}>
          <HighlightMark active style={styles.brandMark}>
            <AppText variant="display" color="onHighlight" accessibilityRole="header" style={styles.brandText}>
              StudyFlow
            </AppText>
          </HighlightMark>
          <AppText variant="title" style={styles.center}>
            {t('auth.welcome.tagline')}
          </AppText>
          <AppText variant="callout" color="inkSoft" style={styles.center}>
            {t('auth.welcome.body')}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        {notice === 'deleted' ? <Banner tone="success" message={t('auth.welcome.accountDeleted')} /> : null}
        {notice === 'closed_no_consent' ? (
          <Banner
            tone="warning"
            title={t('auth.welcome.accountClosedTitle')}
            message={t('auth.welcome.accountClosed')}
          />
        ) : null}
        {error ? <Banner tone="warning" message={error} /> : null}

        {appleAvailable ? (
          <View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={Radius.md}
              onPress={continueWithApple}
              accessibilityLabel={t('auth.apple.a11y')}
              style={[styles.apple, appleBusy && styles.busy]}
            />
            {appleBusy ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.pen} /> : null}
          </View>
        ) : null}
        <Button label={t('auth.welcome.signUpEmail')} onPress={() => go('/sign-up')} block />
        <Button label={t('auth.welcome.signIn')} variant="secondary" onPress={() => go('/sign-in')} block />

        {isLocalMode ? (
          <AppText variant="footnote" color="inkSoft" style={styles.center}>
            {t('auth.welcome.localNote')}
          </AppText>
        ) : null}
        <LegalLinks />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Gutter,
    gap: Space.xxl,
  },
  hero: {
    gap: Space.xxl,
    paddingTop: Space.lg,
  },
  brand: {
    alignItems: 'center',
    gap: Space.md,
  },
  brandMark: {
    paddingHorizontal: Space.md,
  },
  brandText: {
    fontSize: 40,
    lineHeight: 48,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: Space.md,
  },
  apple: {
    height: 50,
    width: '100%',
  },
  busy: {
    opacity: 0.4,
  },
});
