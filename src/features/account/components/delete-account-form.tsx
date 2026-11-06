import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { isDeleteConfirmation } from '@/features/account/onboarding-logic';
import { deleteAccountAndData } from '@/features/account/service';
import { useSignInMethods } from '@/features/account/use-sign-in-methods';
import { useTheme } from '@/hooks/use-theme';
import { config, isLocalMode } from '@/services/config';
import { useSession } from '@/stores/session';

/**
 * US-13 / BR-18: what deletion removes, the "SİL" confirmation and the button. Used by
 * Ayarlar > Hesap and the locked waiting screen (US-75).
 */
export function DeleteAccountForm() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const plan = useSession((s) => s.profile?.plan ?? 'free');
  const methods = useSignInMethods();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = isDeleteConfirmation(confirm);
  const appleConfirm = !isLocalMode && Platform.OS === 'ios' && methods?.apple === true;

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteAccountAndData();
      // On success the root layout switches to the welcome screen.
      if (!result.ok) setError(result.error === 'cancelled' ? t('account.appleCancelled') : t('account.deleteError'));
    } catch {
      setError(t('account.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const items = [
    t('account.deleteDocuments'),
    t('account.deleteData'),
    t('account.deleteDevice'),
    t('account.deleteKept'),
    ...(isLocalMode ? [] : [t('account.deleteEmail')]),
  ];

  return (
    <View style={styles.group}>
      <Card style={styles.card}>
        <AppText variant="body">{t('account.deleteIntro')}</AppText>
        {items.map((item) => (
          <View key={item} style={styles.item}>
            <SymbolView
              name={{ ios: 'circle.fill', android: 'circle', web: 'circle' }}
              size={6}
              tintColor={colors.inkSoft}
              style={styles.dot}
            />
            <AppText variant="callout" style={styles.flex}>
              {item}
            </AppText>
          </View>
        ))}
        <AppText variant="callout" color="exam">
          {t('account.deleteUndo')}
        </AppText>
      </Card>

      {plan === 'pro' ? <Banner tone="warning" title={t('account.proTitle')} message={t('account.proBody')} /> : null}
      {isLocalMode ? <Banner tone="info" message={t('account.localNote')} /> : null}
      {appleConfirm ? <Banner tone="info" message={t('account.appleConfirmNote')} /> : null}

      <TextField
        label={t('account.confirmLabel')}
        placeholder={t('account.confirmPlaceholder')}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
      />
      <Button
        label={t('account.deleteButton')}
        variant="destructive"
        onPress={remove}
        disabled={!confirmed}
        loading={deleting}
        block
      />
      {error ? <Banner tone="warning" message={error} /> : null}

      <AppText variant="footnote" color="inkSoft">
        {t('account.webForm', { email: config.supportEmail })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.md,
  },
  card: {
    gap: Space.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    marginTop: 8,
  },
  flex: {
    flex: 1,
  },
});
