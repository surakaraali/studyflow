import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { validateParentEmail, type EmailError } from '@/features/account/onboarding-logic';
import { useSession } from '@/stores/session';

type ParentEmailFormProps = {
  onSubmit: (email: string) => Promise<boolean>;
  onCancel: () => void;
  busy: boolean;
};

/** "Change the parent's email": the new address gets a fresh link (counts as a resend). */
export function ParentEmailForm({ onSubmit, onCancel, busy }: ParentEmailFormProps) {
  const { t } = useTranslation();
  const ownEmail = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const [email, setEmail] = useState('');
  const [showError, setShowError] = useState(false);
  const validation = validateParentEmail(email, ownEmail);

  const messages: Record<EmailError, string> = {
    required: t('onboarding.parent.required'),
    invalid: t('onboarding.parent.invalid'),
    same_as_own: t('onboarding.parent.sameAsOwn'),
  };

  const submit = async () => {
    setShowError(true);
    if (validation) return;
    if (await onSubmit(email)) onCancel();
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('consent.changeEmailLabel')}
        placeholder={t('onboarding.parent.placeholder')}
        value={email}
        onChangeText={setEmail}
        error={showError && validation ? messages[validation] : null}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <View style={styles.row}>
        <Button label={t('consent.changeEmailSubmit')} onPress={submit} loading={busy} />
        <Button label={t('common.cancel')} variant="plain" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
});
