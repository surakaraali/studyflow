import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { isValidEmail } from '@/domain/rules';
import { authErrorMessage } from '@/features/account/auth-errors';
import { PasswordField } from '@/features/account/components/password-field';
import { signInWithEmail } from '@/features/account/service';
import type { AuthError } from '@/services/auth';

export default function SignInScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const normalized = email.trim().toLowerCase();
  const emailError = showErrors && !isValidEmail(email) ? t('auth.errors.invalidEmail') : null;
  const passwordError = showErrors && !password ? t('auth.errors.passwordRequired') : null;

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (!isValidEmail(email) || !password) return;
    setBusy(true);
    try {
      const result = await signInWithEmail(normalized, password);
      if (result.ok) return; // the root layout moves on to onboarding or Today
      if (result.error === 'email_not_verified') {
        router.push({ pathname: '/verify-email', params: { email: normalized } });
        return;
      }
      setError(result.error);
    } catch {
      setError('unknown');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={t('auth.signIn.title')}
      intro={t('auth.signIn.intro')}
      footer={
        <>
          <Button label={t('auth.signIn.submit')} onPress={submit} loading={busy} block />
          <Button
            label={t('auth.signIn.noAccount')}
            variant="plain"
            onPress={() => router.replace('/sign-up')}
            block
          />
        </>
      }>
      <View style={styles.form}>
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
          textContentType="username"
          returnKeyType="next"
        />
        <PasswordField
          purpose="current"
          label={t('auth.fields.password')}
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <View style={styles.forgot}>
          <Button
            label={t('auth.signIn.forgot')}
            variant="plain"
            onPress={() => router.push({ pathname: '/reset-password', params: { email: normalized } })}
          />
        </View>
      </View>

      {error ? <Banner tone="warning" message={authErrorMessage(t, error)} /> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Space.lg,
  },
  forgot: {
    alignSelf: 'flex-start',
    marginLeft: -Space.lg,
  },
});
