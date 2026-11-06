import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Space } from '@/constants/theme';
import { PASSWORD_MIN } from '@/domain/rules';
import { authErrorMessage } from '@/features/account/auth-errors';
import { PasswordField } from '@/features/account/components/password-field';
import { validateNewPassword } from '@/features/account/credentials';
import { changePassword } from '@/features/account/service';
import { useSignInMethods } from '@/features/account/use-sign-in-methods';
import type { AuthError } from '@/services/auth';

/** US-72: the current password is checked again before the new one is saved. */
export default function PasswordScreen() {
  const { t } = useTranslation();
  const methods = useSignInMethods();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [done, setDone] = useState(false);

  const nextError = validateNewPassword(next, current || undefined);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings/account'));

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (!current || nextError) return;
    setBusy(true);
    try {
      const result = await changePassword(current, next);
      if (result.ok) setDone(true);
      else setError(result.error);
    } catch {
      setError('unknown');
    } finally {
      setBusy(false);
    }
  };

  const header = <Stack.Screen options={{ title: t('account.password.title') }} />;

  if (methods && !methods.password) {
    return (
      <>
        {header}
        <Page>
          <Banner tone="info" message={t('account.password.appleOnly')} />
        </Page>
      </>
    );
  }

  if (done) {
    return (
      <>
        {header}
        <Page footer={<Button label={t('common.done')} onPress={close} block />}>
          <Banner tone="success" message={t('account.password.done')} />
        </Page>
      </>
    );
  }

  return (
    <>
      {header}
      <Page
        intro={t('account.password.intro')}
        footer={<Button label={t('account.password.submit')} onPress={submit} loading={busy} block />}>
        <View style={styles.form}>
          <PasswordField
            purpose="current"
            label={t('account.password.current')}
            value={current}
            onChangeText={setCurrent}
            error={showErrors && !current ? t('auth.errors.passwordRequired') : null}
            returnKeyType="next"
          />
          <PasswordField
            purpose="new"
            label={t('account.password.next')}
            hint={t('auth.fields.passwordHint', { count: PASSWORD_MIN })}
            value={next}
            onChangeText={setNext}
            error={
              showErrors && nextError
                ? nextError === 'same'
                  ? t('auth.errors.samePassword')
                  : t('auth.errors.passwordShort', { count: PASSWORD_MIN })
                : null
            }
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
        {error ? (
          <Banner
            tone="warning"
            message={error === 'invalid_credentials' ? t('account.password.wrongCurrent') : authErrorMessage(t, error)}
          />
        ) : null}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Space.lg,
  },
});
