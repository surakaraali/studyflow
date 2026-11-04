import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { OptikSheet } from '@/features/account/components/optik-sheet';
import { deleteAccountAndData, signOut } from '@/features/account/service';
import { ConsentPanel } from '@/features/consent/components/consent-panel';
import { consentDeadlinePassed, daysUntilConsentDeadline } from '@/features/consent/logic';
import { isLocalMode } from '@/services/config';
import { useProfile } from '@/stores/session';

/**
 * BR-02 / US-17: an under-13 student waiting for consent only sees this screen and the
 * parent page. After 30 days without consent the account is closed (BR-04); the server job
 * does this in Supabase mode, the app does it on the device in local mode.
 */
export default function LockedScreen() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const closing = useRef(false);

  const pending = profile?.consent_status === 'pending';
  const deadlinePassed = pending && profile != null && consentDeadlinePassed(profile.created_at);
  const daysLeft = profile ? daysUntilConsentDeadline(profile.created_at) : 0;

  useEffect(() => {
    if (!deadlinePassed || closing.current) return;
    closing.current = true;
    void deleteAccountAndData({ remote: isLocalMode, notice: 'closed_no_consent' });
  }, [deadlinePassed]);

  return (
    <Page
      footer={<Button label={t('consent.locked.signOut')} variant="secondary" onPress={() => void signOut()} block />}>
      <OptikSheet />
      <View style={styles.header}>
        <AppText variant="title" color="inkSoft">
          {t('consent.locked.greeting')}
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          {t('consent.locked.title')}
        </AppText>
        <AppText variant="body">{t('consent.locked.body')}</AppText>
        {pending ? (
          <AppText variant="callout" color="inkSoft">
            {t('consent.locked.deadline', { count: daysLeft })}
          </AppText>
        ) : (
          <AppText variant="callout" color="inkSoft">
            {t('consent.locked.revoked')}
          </AppText>
        )}
      </View>
      <ConsentPanel />
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Space.md,
  },
});
