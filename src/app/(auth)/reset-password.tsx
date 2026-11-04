import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { isValidEmail } from '@/domain/rules';
import { authErrorMessage } from '@/features/account/auth-errors';
import { auth } from '@/services/auth';
import { isLocalMode } from '@/services/config';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const emailError = showErrors && !isValidEmail(email) ? t('auth.errors.invalidEmail') : null;
  const normalized = email.trim().toLowerCase();

  const submit = async () => {
    setShowErrors(true);
    setResult(null);
    if (!isValidEmail(email)) return;
    setBusy(true);
    try {
      const response = await auth.sendPasswordReset(normalized);
      // Same message whether or not the account exists, so addresses can't be probed.
      setResult(
        response.ok || response.error === 'invalid_credentials'
          ? { tone: 'success', text: t('auth.reset.sent') }
          : { tone: 'warning', text: authErrorMessage(t, response.error) },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={t('auth.reset.title')}
      intro={t('auth.reset.intro')}
      footer={
        result?.tone === 'success' ? (
          <Button
            label={t('auth.reset.backToSignIn')}
            onPress={() => router.replace({ pathname: '/sign-in', params: { email: normalized } })}
            block
          />
        ) : (
          <Button label={t('auth.reset.submit')} onPress={submit} loading={busy} disabled={isLocalMode} block />
        )
      }>
      {isLocalMode ? <Banner tone="info" message={t('auth.reset.localNote')} /> : null}
      <TextField
        label={t('auth.fields.email')}
        placeholder={t('auth.fields.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      {result ? <Banner tone={result.tone} message={result.text} /> : null}
    </Page>
  );
}
