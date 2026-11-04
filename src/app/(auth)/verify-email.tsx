import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { authErrorMessage } from '@/features/account/auth-errors';
import { auth, markEmailVerifiedLocally } from '@/services/auth';
import { isLocalMode } from '@/services/config';

const RESEND_COOLDOWN_MS = 30_000;

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setBusy(true);
    const result = await auth.resendVerification(email);
    setBusy(false);
    if (result.ok) {
      setCooldown(true);
      setMessage({ tone: 'success', text: t('auth.verify.resent') });
    } else {
      setMessage({ tone: 'warning', text: authErrorMessage(t, result.error) });
    }
  };

  const markVerified = async () => {
    await markEmailVerifiedLocally(email);
    setVerified(true);
    setMessage({ tone: 'success', text: t('auth.verify.devDone') });
  };

  const goSignIn = () => router.replace({ pathname: '/sign-in', params: { email } });

  return (
    <Page
      title={t('auth.verify.title')}
      footer={
        <>
          <Button label={t('auth.verify.goSignIn')} onPress={goSignIn} block />
          {!isLocalMode ? (
            <Button
              label={t('auth.verify.resend')}
              variant="plain"
              onPress={resend}
              loading={busy}
              disabled={cooldown || !email}
              block
            />
          ) : null}
        </>
      }>
      <View style={styles.text}>
        <AppText variant="body">{t('auth.verify.body', { email })}</AppText>
        {!isLocalMode ? (
          <AppText variant="callout" color="inkSoft">
            {t('auth.verify.spamHint')}
          </AppText>
        ) : null}
      </View>

      {message ? <Banner tone={message.tone} message={message.text} /> : null}

      {isLocalMode && !verified ? (
        <Card>
          <View style={styles.text}>
            <AppText variant="heading">{t('auth.verify.devTitle')}</AppText>
            <AppText variant="callout" color="inkSoft">
              {t('auth.verify.devBody')}
            </AppText>
          </View>
          <Button
            label={t('auth.verify.devAction')}
            variant="secondary"
            icon={{ ios: 'hammer', android: 'build', web: 'build' }}
            onPress={markVerified}
            disabled={!email}
          />
        </Card>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: Space.sm,
  },
});
