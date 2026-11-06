import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { deviceInfo, osLabel } from '@/features/support/device-info';
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_TOPICS,
  sendSupportMessage,
  validateSupport,
  type SupportResult,
  type SupportTopic,
} from '@/features/support/send';
import { useProfile } from '@/stores/session';

/**
 * US-66: support form. The reply email is the only personal data asked for.
 * `?preset=dataCopy` (US-14, US-80) opens it as a ready data-copy request.
 */
export default function SupportScreen() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const dataCopy = preset === 'dataCopy';
  const [email, setEmail] = useState(profile?.email ?? '');
  const [topic, setTopic] = useState<SupportTopic | null>(dataCopy ? 'account' : null);
  const [message, setMessage] = useState(dataCopy ? t('support.dataCopy.message') : '');
  const title = dataCopy ? t('support.dataCopy.title') : t('support.title');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<SupportResult | null>(null);

  const info = deviceInfo();
  const errors = submitted ? validateSupport({ email, topic, message }) : {};

  const send = async () => {
    setSubmitted(true);
    setFailed(false);
    const problems = validateSupport({ email, topic, message });
    if (Object.keys(problems).length > 0 || !topic) return;
    setSending(true);
    try {
      setResult(await sendSupportMessage({ email, topic, message }));
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Page
          footer={<Button label={t('support.back')} onPress={() => router.back()} block />}>
          <View style={styles.done} accessibilityLiveRegion="polite">
            <AppText variant="display" accessibilityRole="header">
              {t('support.sentTitle')}
            </AppText>
            <AppText variant="body">
              {dataCopy
                ? t('support.dataCopy.sentBody', { email: email.trim() })
                : t('support.sentBody', { email: email.trim() })}
            </AppText>
            {result === 'queued' ? <Banner tone="info" message={t('support.sentQueued')} /> : null}
            {result === 'local' ? <Banner tone="info" message={t('support.sentLocal')} /> : null}
          </View>
        </Page>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Page
        intro={dataCopy ? t('support.dataCopy.intro') : t('support.intro')}
        footer={
          <Button label={t('support.send')} onPress={send} loading={sending} block />
        }>
        {failed ? <Banner tone="warning" message={t('support.error')} /> : null}
        <TextField
          label={t('support.email')}
          hint={t('support.emailHint')}
          error={errors.email ? t('support.emailError') : null}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <View style={styles.field}>
          <Segmented
            label={t('support.topic')}
            wrap
            value={topic}
            onChange={setTopic}
            options={SUPPORT_TOPICS.map((value) => ({ value, label: t(`support.topics.${value}`) }))}
          />
          {errors.topic ? (
            <AppText variant="footnote" color="exam" accessibilityLiveRegion="polite">
              {t('support.topicError')}
            </AppText>
          ) : null}
        </View>
        <TextField
          label={t('support.message')}
          hint={t('support.messageHint')}
          error={errors.message ? t('support.messageError', { min: SUPPORT_MESSAGE_MIN }) : null}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={SUPPORT_MESSAGE_MAX}
        />
        <AppText variant="footnote" color="inkSoft">
          {t('support.auto', { version: info.app_version, os: osLabel(info) })}
        </AppText>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Space.xs + 2,
  },
  done: {
    gap: Space.lg,
  },
});
