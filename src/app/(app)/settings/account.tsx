import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Space } from '@/constants/theme';
import { isDeleteConfirmation } from '@/features/account/onboarding-logic';
import { deleteAccountAndData, signOut } from '@/features/account/service';
import { useTheme } from '@/hooks/use-theme';
import { config, isLocalMode } from '@/services/config';
import { useSession } from '@/stores/session';

/** US-13: sign out, and delete the account with everything in it (BR-18). */
export default function AccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const email = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const plan = useSession((s) => s.profile?.plan ?? 'free');
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirmed = isDeleteConfirmation(confirm);

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setFailed(false);
    try {
      const result = await deleteAccountAndData();
      // On success the root layout switches to the welcome screen.
      if (!result.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  const leave = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
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
    <>
      <Stack.Screen options={{ title: t('account.title') }} />
      <Page>
        <Section title={t('account.signedInAs')} footer={t('account.signOutHint')}>
          <ListRow
            icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            title={email ?? t('account.appleHiddenEmail')}
          />
        </Section>
        <Button
          label={t('account.signOut')}
          variant="secondary"
          icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          onPress={leave}
          loading={signingOut}
          block
        />

        <View style={styles.group}>
          <AppText variant="title" accessibilityRole="header">
            {t('account.deleteTitle')}
          </AppText>
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

          {plan === 'pro' ? (
            <Banner tone="warning" title={t('account.proTitle')} message={t('account.proBody')} />
          ) : null}

          {isLocalMode ? <Banner tone="info" message={t('account.localNote')} /> : null}

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
          {failed ? <Banner tone="warning" message={t('account.deleteError')} /> : null}

          <AppText variant="footnote" color="inkSoft">
            {t('account.webForm', { email: config.supportEmail })}
          </AppText>
        </View>
      </Page>
    </>
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
