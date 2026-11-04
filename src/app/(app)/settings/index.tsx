import * as Application from 'expo-application';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';

import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { canPurchase } from '@/domain/rules';
import { usePlanActions } from '@/features/subscription/use-plan-actions';
import { track } from '@/services/analytics';
import { isLocalMode } from '@/services/config';
import { purchaseMode, restore } from '@/services/purchases';
import { endSession, useProfile } from '@/stores/session';

/** Settings hub: account, plan, app settings, help, sign-out and version. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { profile, access, age } = useProfile();
  const { manage, gateElement } = usePlanActions();
  const [restoring, setRestoring] = useState(false);

  const isPro = profile?.plan === 'pro';
  const showConsent = (age != null && age < 18) || (profile?.consent_status ?? 'not_required') !== 'not_required';

  const restorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restore().catch(() => ({ ok: false, reason: 'unknown' }) as const);
    setRestoring(false);
    if (!result.ok) {
      Alert.alert(t('settings.plan.restore'), t(`paywall.errors.${result.reason}`));
      return;
    }
    track('purchase_restored', { active: result.active });
    Alert.alert(
      t('settings.plan.restore'),
      result.active ? t('paywall.restoreDone') : t('paywall.restoreNone'),
    );
  };

  const confirmSignOut = () => {
    Alert.alert(t('settings.signOutTitle'), t('settings.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: () => {
          endSession().catch(() => Alert.alert(t('common.genericError')));
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Page>
        <Section title={t('settings.account.title')}>
          <ListRow
            title={t('settings.account.profile')}
            subtitle={t('settings.account.profileHint')}
            icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            onPress={() => router.push('/settings/profile')}
          />
          <ListRow
            title={t('settings.account.account')}
            subtitle={t('settings.account.accountHint')}
            icon={{ ios: 'key', android: 'manage_accounts', web: 'manage_accounts' }}
            onPress={() => router.push('/settings/account')}
          />
        </Section>

        <Section
          title={t('settings.plan.title')}
          footer={!isPro && !canPurchase(access) ? t('settings.plan.limited') : undefined}>
          <ListRow
            title={t('settings.plan.current')}
            subtitle={isPro ? t('settings.plan.proQuota') : t('settings.plan.freeQuota')}
            detail={isPro ? t('settings.plan.pro') : t('settings.plan.free')}
            detailColor={isPro ? 'pen' : 'inkSoft'}
            icon={{ ios: 'star', android: 'workspace_premium', web: 'workspace_premium' }}
          />
          {isPro ? (
            <ListRow
              title={purchaseMode === 'test' ? t('settings.plan.testCancel') : t('settings.plan.manage')}
              icon={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
              onPress={manage}
            />
          ) : (
            <ListRow
              title={t('settings.plan.upgrade')}
              icon={{ ios: 'arrow.up.circle', android: 'upgrade', web: 'upgrade' }}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'settings' } })}
            />
          )}
          {purchaseMode !== 'off' ? (
            <ListRow
              title={t('settings.plan.restore')}
              icon={{ ios: 'arrow.clockwise', android: 'restore', web: 'restore' }}
              onPress={restorePurchases}
              chevron={false}
            />
          ) : null}
        </Section>

        <Section title={t('settings.app.title')}>
          <ListRow
            title={t('settings.app.notifications')}
            icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
            onPress={() => router.push('/settings/notifications')}
          />
          <ListRow
            title={t('settings.app.aiNotice')}
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            onPress={() => router.push('/ai-notice')}
          />
          {showConsent ? (
            <ListRow
              title={t('settings.app.consent')}
              detail={t(`settings.app.consentStatus.${profile?.consent_status ?? 'not_required'}`)}
              detailColor={profile?.consent_status === 'granted' ? 'success' : 'exam'}
              icon={{ ios: 'person.2', android: 'family_restroom', web: 'family_restroom' }}
              onPress={() => router.push('/consent')}
            />
          ) : null}
          <ListRow
            title={t('settings.app.legal')}
            subtitle={t('settings.app.legalHint')}
            icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
            onPress={() => router.push('/settings/legal')}
          />
        </Section>

        <Section title={t('settings.help.title')}>
          <ListRow
            title={t('settings.help.faq')}
            icon={{ ios: 'questionmark.circle', android: 'help', web: 'help' }}
            onPress={() => router.push('/settings/faq')}
          />
          <ListRow
            title={t('settings.help.support')}
            subtitle={t('settings.help.supportHint')}
            icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
            onPress={() => router.push('/settings/support')}
          />
          <ListRow
            title={t('settings.help.feedback')}
            subtitle={t('settings.help.feedbackHint')}
            icon={{ ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' }}
            onPress={() => router.push('/settings/feedback')}
          />
        </Section>

        {isLocalMode ? (
          <Section title={t('settings.dev.title')} footer={t('settings.dev.body')}>
            <ListRow
              title={t('settings.dev.reports')}
              subtitle={t('settings.dev.reportsHint')}
              icon={{ ios: 'flag', android: 'flag', web: 'flag' }}
              onPress={() => router.push('/dev/reports')}
            />
          </Section>
        ) : null}

        <Section>
          <ListRow
            title={t('settings.signOut')}
            icon={{
              ios: 'rectangle.portrait.and.arrow.right',
              android: 'logout',
              web: 'logout',
            }}
            destructive
            onPress={confirmSignOut}
          />
        </Section>

        <AppText variant="footnote" color="inkSoft" style={styles.version}>
          {t('settings.version', {
            version: Application.nativeApplicationVersion ?? '—',
            build: Application.nativeBuildVersion ?? '—',
          })}
        </AppText>
      </Page>
      {gateElement}
    </>
  );
}

const styles = StyleSheet.create({
  version: {
    textAlign: 'center',
  },
});
