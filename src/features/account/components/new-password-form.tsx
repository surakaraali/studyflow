import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Space } from '@/constants/theme';
import { PASSWORD_MIN } from '@/domain/rules';
import { authErrorMessage } from '@/features/account/auth-errors';
import { validateNewPassword } from '@/features/account/credentials';
import type { AuthError, SimpleResult } from '@/services/auth';

import { PasswordField } from './password-field';

type NewPasswordFormProps = {
  onSubmit: (password: string) => Promise<SimpleResult>;
  /** Shown under the button, e.g. "Vazgeç". */
  secondary?: { label: string; onPress: () => void };
};

/** US-71: one new password (at least 8 characters) after a reset link. */
export function NewPasswordForm({ onSubmit, secondary }: NewPasswordFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const invalid = validateNewPassword(password) != null;

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (invalid) return;
    setBusy(true);
    try {
      const result = await onSubmit(password);
      // On success the root layout usually moves on; the form may already be gone.
      if (!result.ok) setError(result.error);
    } catch {
      setError('unknown');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <PasswordField
        purpose="new"
        label={t('auth.newPassword.label')}
        hint={t('auth.fields.passwordHint', { count: PASSWORD_MIN })}
        value={password}
        onChangeText={setPassword}
        error={showErrors && invalid ? t('auth.errors.passwordShort', { count: PASSWORD_MIN }) : null}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <Banner tone="warning" message={authErrorMessage(t, error)} /> : null}
      <Button label={t('auth.newPassword.submit')} onPress={submit} loading={busy} block />
      {secondary ? <Button label={secondary.label} variant="plain" onPress={secondary.onPress} block /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg,
  },
});
