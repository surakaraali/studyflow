import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { DeleteAccountForm } from '@/features/account/components/delete-account-form';
import { signOut } from '@/features/account/service';
import { useSignInMethods } from '@/features/account/use-sign-in-methods';
import { useSession } from '@/stores/session';

/**
 * US-13: sign out, and delete the account with everything in it (BR-18).
 * US-72: change the password or the e-mail — hidden for Apple-only accounts.
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const email = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const methods = useSignInMethods();
  const [signingOut, setSigningOut] = useState(false);

  const leave = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

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

        {methods?.password ? (
          <Section title={t('account.security')}>
            <ListRow
              icon={{ ios: 'key', android: 'key', web: 'key' }}
              title={t('account.password.row')}
              onPress={() => router.push('/settings/password')}
            />
            <ListRow
              icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
              title={t('account.email.row')}
              onPress={() => router.push('/settings/email')}
            />
          </Section>
        ) : null}

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
          <DeleteAccountForm />
        </View>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.md,
  },
});
