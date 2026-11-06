import type { TFunction } from 'i18next';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import type { ButtonProps } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { parseAuthCallback } from '@/features/account/auth-callback';
import { handleAuthCallback, type CallbackResult } from '@/features/account/auth-callback-service';
import { NewPasswordForm } from '@/features/account/components/new-password-form';
import { completePasswordReset, continueWithLinkSession } from '@/features/account/service';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/stores/session';

type Shown = Exclude<CallbackResult, { kind: 'recovery' | 'other_account' }>;
type Action = 'continue' | 'home' | 'signIn' | 'newLink' | 'changeEmail';

/** Copy and buttons for each result (the reset form and the wait state are handled inline). */
function describe(t: TFunction, result: Shown, signedIn: boolean): { title: string; body: string; actions: Action[] } {
  switch (result.kind) {
    case 'local':
      return {
        title: t('auth.callback.localTitle'),
        body: t('auth.callback.localBody'),
        actions: [signedIn ? 'home' : 'signIn'],
      };
    case 'verified':
      return {
        title: t('auth.callback.verifiedTitle'),
        body: signedIn || result.hasSession ? t('auth.callback.verifiedBody') : t('auth.callback.verifiedSignIn'),
        actions: [signedIn ? 'home' : result.hasSession ? 'continue' : 'signIn'],
      };
    case 'email_changed':
      return {
        title: t('auth.callback.emailChangedTitle'),
        body: t('auth.callback.emailChangedBody'),
        actions: [signedIn ? 'home' : 'continue'],
      };
    case 'confirm_other':
      return {
        title: t('auth.callback.confirmOtherTitle'),
        body: t('auth.callback.confirmOtherBody'),
        actions: [signedIn ? 'home' : 'signIn'],
      };
    case 'error': {
      const [title, body] =
        result.reason === 'expired'
          ? [t('auth.callback.expiredTitle'), t('auth.callback.expiredBody')]
          : result.reason === 'other_device'
            ? [t('auth.callback.otherDeviceTitle'), t('auth.callback.otherDeviceBody')]
            : [t('auth.callback.invalidTitle'), t('auth.callback.invalidBody')];
      // Signed in, a failed link is almost always an e-mail change; signed out, a reset or
      // a verification (signing in resends the verification e-mail).
      return signedIn
        ? { title, body, actions: ['changeEmail', 'home'] }
        : { title, body: `${body} ${t('auth.callback.signInHint')}`, actions: ['newLink', 'signIn'] };
    }
  }
}

/**
 * US-71: studyflow://auth/callback — where every e-mail link lands (sign-up verification,
 * password reset, e-mail change). A public route outside the guarded groups, so it opens
 * signed in or out. It turns the link into a session and says what happened; a reset link
 * continues on /new-password.
 */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const linkingUrl = Linking.useLinkingURL();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [result, setResult] = useState<CallbackResult | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    // A code works once; never run the exchange twice for one screen.
    if (handled.current) return;
    handled.current = true;
    void handleAuthCallback(parseAuthCallback(linkingUrl, params))
      .catch((): CallbackResult => ({ kind: 'error', reason: 'invalid' }))
      .then((next) => {
        // Signed out, a reset continues on its own screen in the (auth) group.
        if (next.kind === 'recovery' && useSession.getState().status !== 'signedIn') {
          router.replace('/new-password');
          return;
        }
        setResult(next);
      });
  }, [linkingUrl, params]);

  const home = () => router.replace('/');
  const signIn = () => router.replace('/sign-in');
  const proceed = async () => {
    const outcome = await continueWithLinkSession();
    // On success the root layout moves on to onboarding or Today.
    if (!outcome.ok) signIn();
  };

  const onAction: Record<Action, ButtonProps> = {
    continue: { label: t('auth.callback.continue'), onPress: () => void proceed() },
    home: { label: t('auth.callback.backToApp'), onPress: home },
    signIn: { label: t('auth.callback.signIn'), onPress: signIn },
    newLink: { label: t('auth.callback.newLink'), onPress: () => router.replace('/reset-password') },
    changeEmail: { label: t('auth.callback.changeEmailAgain'), onPress: () => router.replace('/settings/email') },
  };

  let content: ReactNode;
  if (!result || result.kind === 'other_account') {
    // other_account: we signed out; the root layout opens the welcome screen with a note.
    content = (
      <View style={styles.working} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.pen} />
        <AppText variant="callout" color="inkSoft">
          {t('auth.callback.working')}
        </AppText>
      </View>
    );
  } else if (result.kind === 'recovery') {
    // Already signed in on this device (rare): set the new password right here.
    content = (
      <View style={styles.form}>
        <AppText variant="display" accessibilityRole="header">
          {t('auth.callback.recoveryTitle')}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {t('auth.callback.recoveryIntro')}
        </AppText>
        <NewPasswordForm
          onSubmit={async (password) => {
            const saved = await completePasswordReset(password);
            if (saved.ok) home();
            return saved;
          }}
          secondary={{ label: t('auth.newPassword.cancel'), onPress: home }}
        />
      </View>
    );
  } else {
    const view = describe(t, result, signedIn);
    content = <EmptyState title={view.title} body={view.body} actions={view.actions.map((a) => onAction[a])} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Page>
        <View style={styles.top}>{content}</View>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingTop: Space.xxl,
  },
  working: {
    alignItems: 'center',
    gap: Space.md,
    paddingTop: Space.xxl,
  },
  form: {
    gap: Space.md,
  },
});
