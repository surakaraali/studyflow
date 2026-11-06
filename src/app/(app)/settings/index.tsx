import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { ListRow, type ListRowProps } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { canPurchase } from '@/domain/rules';
import { signOut } from '@/features/account/service';
import { useAppearance } from '@/features/appearance/store';
import { usePlanActions } from '@/features/subscription/use-plan-actions';
import { formatDate, formatShortDate, isSameDay, localeTag } from '@/lib/dates';
import { track } from '@/services/analytics';
import { isLocalMode } from '@/services/config';
import { purchaseMode, restore } from '@/services/purchases';
import { syncNow, useSyncStatus, type SyncStatus } from '@/services/sync';
import { useProfile } from '@/stores/session';
import { appVersion } from '@/lib/app-version';

/** Pieces for "bugün 14:32", "dün 09:05" or "3 Kas 18:40". */
function syncTime(iso: string, tag: string): { day: 'today' | 'yesterday' | null; date: string; time: string } {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return {
    day: isSameDay(date, now) ? 'today' : isSameDay(date, yesterday) ? 'yesterday' : null,
    date: formatShortDate(formatDate(date), tag),
    time: new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }).format(date),
  };
}

type SyncLabel = keyof typeof SYNC_COLORS;

const SYNC_COLORS = {
  idle: 'success',
  waiting: 'inkSoft',
  syncing: 'inkSoft',
  offline: 'inkSoft',
  error: 'exam',
  auth: 'exam',
} as const satisfies Record<string, NonNullable<ListRowProps['detailColor']>>;

function syncLabel({ state, pending, stuck }: SyncStatus): SyncLabel {
  if (state === 'syncing' || state === 'offline' || state === 'auth') return state;
  if (state === 'error' || stuck > 0) return 'error';
  return pending > stuck ? 'waiting' : 'idle';
}

/** US-77: last successful sync, changes still waiting and a manual sync (OFF-03). */
function SyncSection() {
  const { t, i18n } = useTranslation();
  const status = useSyncStatus();

  if (isLocalMode) {
    return (
      <Section title={t('settings.sync.title')} footer={t('settings.sync.localFooter')}>
        <ListRow
          title={t('settings.sync.row')}
          subtitle={t('settings.sync.local')}
          icon={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }}
        />
      </Section>
    );
  }

  const waiting = Math.max(0, status.pending - status.stuck);
  const label = syncLabel(status);
  let last: string = t('settings.sync.never');
  if (status.lastSyncedAt) {
    const { day, date, time } = syncTime(status.lastSyncedAt, localeTag(i18n.language));
    const when =
      day === 'today'
        ? t('settings.sync.today', { time })
        : day === 'yesterday'
          ? t('settings.sync.yesterday', { time })
          : `${date} ${time}`;
    last = t('settings.sync.last', { time: when });
  }
  const queue = waiting > 0 ? t('settings.sync.pending', { count: waiting }) : t('settings.sync.upToDate');
  const footer =
    status.state === 'auth'
      ? t('settings.sync.auth')
      : status.stuck > 0
        ? t('settings.sync.stuck', { count: status.stuck })
        : status.state === 'offline'
          ? t('settings.sync.offline')
          : undefined;

  return (
    <Section title={t('settings.sync.title')} footer={footer}>
      <ListRow
        title={t('settings.sync.row')}
        subtitle={`${last}\n${queue}`}
        detail={t(`settings.sync.state.${label}`)}
        detailColor={SYNC_COLORS[label]}
        icon={{ ios: 'arrow.triangle.2.circlepath.icloud', android: 'cloud_sync', web: 'cloud_sync' }}
      />
      <ListRow
        title={t('settings.sync.now')}
        icon={{ ios: 'arrow.clockwise', android: 'sync', web: 'sync' }}
        onPress={syncNow}
        chevron={false}
      />
    </Section>
  );
}

/** Settings hub: account, plan, app settings, sync, help and sign-out. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { profile, access, age } = useProfile();
  const appearance = useAppearance((s) => s.preference);
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
          signOut().catch(() => Alert.alert(t('common.genericError')));
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
          <ListRow
            title={t('settings.account.dataCopy')}
            subtitle={t('settings.account.dataCopyHint')}
            icon={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
            onPress={() => router.push({ pathname: '/settings/support', params: { preset: 'dataCopy' } })}
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
            title={t('settings.app.appearance')}
            detail={t(`settings.appearance.options.${appearance}`)}
            icon={{ ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' }}
            onPress={() => router.push('/settings/appearance')}
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

        <SyncSection />

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
          <ListRow
            title={t('settings.help.about')}
            detail={appVersion().version ?? undefined}
            icon={{ ios: 'info.circle', android: 'info', web: 'info' }}
            onPress={() => router.push('/settings/about')}
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
      </Page>
      {gateElement}
    </>
  );
}
