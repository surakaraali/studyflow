import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { OptikSheet } from '@/features/account/components/optik-sheet';
import { Page } from '@/components/ui/page';
import { Space } from '@/constants/theme';

/**
 * US-71: an unknown link (an old e-mail, a typo in a deep link). "/" sends the student to
 * whatever fits their state: welcome, onboarding, the consent wait or Today.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Page>
        <View style={styles.body}>
          <OptikSheet />
          <EmptyState
            title={t('auth.notFound.title')}
            body={t('auth.notFound.body')}
            actions={[{ label: t('auth.notFound.home'), onPress: () => router.replace('/') }]}
          />
        </View>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Space.xxl,
    paddingTop: Space.xxl,
  },
});
