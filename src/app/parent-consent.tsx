import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { ConsentPurpose } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { ChoiceCard } from '@/features/account/components/choice-card';
import { formatFullDate } from '@/features/account/format';
import { isRequestExpired } from '@/features/consent/logic';
import {
  findConsentRequest,
  grantConsent,
  listConsentRecords,
  revokeConsent,
} from '@/features/consent/service';
import { LegalDocumentView } from '@/features/legal/components/legal-document-view';
import { LEGAL_DOCUMENTS } from '@/features/legal/texts';
import { useTheme } from '@/hooks/use-theme';
import { isLocalMode } from '@/services/config';
import { useSession } from '@/stores/session';

const PURPOSES: readonly ConsentPurpose[] = ['ai', 'notifications'];

/**
 * US-16: local-mode stand-in for the web page the parent opens from the consent email.
 * In Supabase mode the real page lives on the web; this route then only explains the link.
 */
export default function ParentConsentScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const profile = useSession((s) => s.profile);
  const [purposes, setPurposes] = useState<ConsentPurpose[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<'granted' | 'revoked' | null>(null);

  const { data, loading } = useDbQuery(
    `parent-consent-${token ?? ''}-${signedIn ? profile?.id : 'out'}`,
    async () => {
      if (!token || !signedIn) return { request: null, grantedAt: null };
      const [found, records] = await Promise.all([findConsentRequest(token), listConsentRecords()]);
      const grant = records.filter((r) => r.action === 'granted').at(-1);
      return { request: found, grantedAt: grant?.created_at ?? null };
    },
    ['consent_requests', 'consent_records'],
  );
  const request = data?.request ?? null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const toggle = (purpose: ConsentPurpose) =>
    setPurposes((current) =>
      current.includes(purpose) ? current.filter((p) => p !== purpose) : [...current, purpose],
    );

  const approve = async () => {
    if (!request) return;
    setBusy(true);
    setFailed(false);
    try {
      await grantConsent(request, purposes);
      setDone('granted');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const revoke = () => {
    if (!request) return;
    Alert.alert(t('consent.parentPage.revokeConfirmTitle'), t('consent.parentPage.revokeConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consent.parentPage.revoke'),
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeConsent(request.parent_email);
            setDone('revoked');
          } catch {
            setFailed(true);
          }
        },
      },
    ]);
  };

  const header = <Stack.Screen options={{ title: t('consent.parentPage.title'), headerShown: true }} />;
  const devNote = isLocalMode ? <Banner tone="info" message={t('consent.parentPage.devNote')} /> : null;
  const closeFooter = <Button label={t('common.close')} onPress={close} block />;

  if (loading) {
    return (
      <>
        {header}
        <View style={[styles.center, { backgroundColor: colors.paper }]}>
          <ActivityIndicator color={colors.pen} />
        </View>
      </>
    );
  }

  if (done) {
    return (
      <>
        {header}
        <Page footer={closeFooter}>
          {devNote}
          <EmptyState
            title={done === 'granted' ? t('consent.parentPage.approvedTitle') : t('consent.parentPage.revokedTitle')}
            body={done === 'granted' ? t('consent.parentPage.approvedBody') : t('consent.parentPage.revokedBody')}
          />
        </Page>
      </>
    );
  }

  // Supabase mode: the parent decides on the web page; the app never records consent itself.
  if (!request || !isLocalMode) {
    return (
      <>
        {header}
        <Page footer={closeFooter}>
          {devNote}
          <EmptyState title={t('consent.parentPage.invalidTitle')} body={t('consent.parentPage.invalidBody')} />
        </Page>
      </>
    );
  }

  // Already approved: the email's "Onayımı geri al" link lands here.
  if (profile?.consent_status === 'granted') {
    return (
      <>
        {header}
        <Page
          footer={
            <>
              <Button label={t('consent.parentPage.revoke')} variant="destructive" onPress={revoke} block />
              <Button label={t('common.close')} variant="plain" onPress={close} block />
            </>
          }>
          {devNote}
          <EmptyState
            title={t('consent.status.granted')}
            body={t('consent.parentPage.grantedAlready', {
              date: formatFullDate(data?.grantedAt ?? profile.updated_at, i18n.language),
            })}
          />
          {failed ? <Banner tone="warning" message={t('consent.parentPage.failed')} /> : null}
        </Page>
      </>
    );
  }

  if (isRequestExpired(request)) {
    return (
      <>
        {header}
        <Page footer={closeFooter}>
          {devNote}
          <EmptyState title={t('consent.parentPage.expiredTitle')} body={t('consent.parentPage.expiredBody')} />
        </Page>
      </>
    );
  }

  const aydinlatma = LEGAL_DOCUMENTS.aydinlatma;

  return (
    <>
      {header}
      <Page
        footer={
          <>
            <AppText variant="footnote" color="inkSoft">
              {t('consent.parentPage.approveHint')}
            </AppText>
            <Button label={t('consent.parentPage.approve')} onPress={approve} loading={busy} block />
          </>
        }>
        {devNote}
        <View style={styles.block}>
          <AppText variant="body">{t('consent.parentPage.intro')}</AppText>
          {profile?.email ? (
            <AppText variant="callout" color="inkSoft">
              {t('consent.parentPage.account', { email: profile.email })}
            </AppText>
          ) : null}
        </View>

        <Card>
          <AppText variant="title" accessibilityRole="header">
            {t('consent.parentPage.textTitle')}
          </AppText>
          <LegalDocumentView doc={aydinlatma} />
        </Card>

        <View style={styles.block}>
          <AppText variant="title" accessibilityRole="header">
            {t('consent.parentPage.purposesTitle')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {t('consent.parentPage.purposesHint')}
          </AppText>
          {PURPOSES.map((purpose) => (
            <ChoiceCard
              key={purpose}
              kind="checkbox"
              title={purpose === 'ai' ? t('consent.purpose.ai') : t('consent.purpose.notifications')}
              description={purpose === 'ai' ? t('consent.purpose.aiBody') : t('consent.purpose.notificationsBody')}
              selected={purposes.includes(purpose)}
              onPress={() => toggle(purpose)}
            />
          ))}
        </View>

        {failed ? <Banner tone="warning" message={t('consent.parentPage.failed')} /> : null}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    gap: Space.md,
  },
});
