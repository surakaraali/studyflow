import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { isValidEmail, PASSWORD_MIN } from '@/domain/rules';
import { authErrorMessage } from '@/features/account/auth-errors';
import { PasswordField } from '@/features/account/components/password-field';
import { signInWithEmail } from '@/features/account/service';
import { LegalLinks } from '@/features/legal/components/legal-links';
import { auth, type AuthError } from '@/services/auth';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const emailError = showErrors && !isValidEmail(email) ? t('auth.errors.invalidEmail') : null;
  const passwordError =
    showErrors && password.length < PASSWORD_MIN ? t('auth.errors.passwordShort', { count: PASSWORD_MIN }) : null;

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (!isValidEmail(email) || password.length < PASSWORD_MIN) return;
    setBusy(true);
    try {
      const normalized = email.trim().toLowerCase();
      const result = await auth.signUp(normalized, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.needsVerification) {
        router.replace({ pathname: '/verify-email', params: { email: normalized } });
        return;
      }
      // Projects without email confirmation sign the new account in straight away.
      const signedIn = await signInWithEmail(normalized, password);
      if (!signedIn.ok) setError(signedIn.error);
    } catch {
      setError('unknown');
    } finally {
      setBusy(false);
    }
  };

  const normalizedEmail = email.trim().toLowerCase();

  return (
    <Page
      title={t('auth.signUp.title')}
      intro={t('auth.signUp.intro')}
      footer={
        <>
          <Button label={t('auth.signUp.submit')} onPress={submit} loading={busy} block />
          <Button
            label={t('auth.signUp.haveAccount')}
            variant="plain"
            onPress={() => router.replace({ pathname: '/sign-in', params: { email: normalizedEmail } })}
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
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <PasswordField
          purpose="new"
          label={t('auth.fields.password')}
          hint={t('auth.fields.passwordHint', { count: PASSWORD_MIN })}
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      {error === 'email_exists' ? (
        <View style={styles.exists}>
          <Banner tone="warning" message={t('auth.errors.emailExists')} />
          <View style={styles.row}>
            <Button
              label={t('auth.signIn.submit')}
              variant="secondary"
              onPress={() => router.replace({ pathname: '/sign-in', params: { email: normalizedEmail } })}
            />
            <Button
              label={t('auth.signIn.forgot')}
              variant="plain"
              onPress={() => router.push({ pathname: '/reset-password', params: { email: normalizedEmail } })}
            />
          </View>
        </View>
      ) : error ? (
        <Banner tone="warning" message={authErrorMessage(t, error)} />
      ) : null}

      <LegalLinks context="signUp" />
    </Page>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Space.lg,
  },
  exists: {
    gap: Space.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});
