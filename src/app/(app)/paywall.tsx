import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { canPurchase } from '@/domain/rules';
import { CompareTable } from '@/features/subscription/compare-table';
import { PackagePicker } from '@/features/subscription/package-picker';
import { usePlanActions } from '@/features/subscription/use-plan-actions';
import { track } from '@/services/analytics';
import {
  getOffering,
  purchase,
  purchaseMode,
  restore,
  type ProOffering,
  type PurchaseFailure,
} from '@/services/purchases';
import { useProfile } from '@/stores/session';

type Notice = { tone: 'info' | 'warning' | 'success'; title?: string; message: string };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function paywallSource(value: string | undefined): 'settings' | 'quota' | 'other' {
  return value === 'settings' || value === 'quota' ? value : 'other';
}

/**
 * US-63 / US-64: free vs Pro, store price and period, renewal and cancel terms, restore.
 * The close button is always in the header (USE-08: no hidden exits, no fake urgency).
 * Open with `/paywall?source=quota` (or `settings`) so analytics knows where it came from.
 */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const { profile, access } = useProfile();
  const { underAge, withGate, manage, gateElement } = usePlanActions();
  const params = useLocalSearchParams<{ source?: string }>();

  const [offering, setOffering] = useState<ProOffering | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const isPro = profile?.plan === 'pro';
  const blocked = !canPurchase(access);

  const load = async () => {
    const next = await getOffering();
    setOffering(next);
    setSelected((current) => current ?? next?.packages[0]?.id ?? null);
  };

  useEffect(() => {
    let alive = true;
    getOffering().then((next) => {
      if (!alive) return;
      setOffering(next);
      setSelected(next?.packages[0]?.id ?? null);
      track('paywall_viewed', { source: paywallSource(params.source), test: next?.test ?? false });
    });
    return () => {
      alive = false;
    };
  }, [params.source]);

  const retry = () => {
    setOffering(undefined);
    load();
  };

  const failureNotice = (reason: PurchaseFailure): Notice => ({
    tone: reason === 'cancelled' || reason === 'pending' ? 'info' : 'warning',
    message: t(`paywall.errors.${reason}`),
  });

  const buy = () => {
    const pkg = offering?.packages.find((p) => p.id === selected);
    if (!pkg || blocked) return;
    withGate(async () => {
      setBusy('buy');
      setNotice(null);
      track('purchase_started', { period: pkg.period, under_18: underAge });
      const result = await purchase(pkg).catch(() => ({ ok: false, reason: 'unknown' }) as const);
      setBusy(null);
      if (!result.ok) {
        track('purchase_failed', { reason: result.reason });
        setNotice(failureNotice(result.reason));
        return;
      }
      if (result.plan !== 'pro') {
        // Paid but not active yet, e.g. the store is still confirming.
        setNotice({ tone: 'info', message: t('paywall.pending') });
        return;
      }
      track('purchase_completed', { period: pkg.period, test: offering?.test ?? false });
      setNotice({ tone: 'success', title: t('paywall.success.title'), message: t('paywall.success.body') });
    });
  };

  const restorePurchases = async () => {
    setBusy('restore');
    setNotice(null);
    const result = await restore().catch(() => ({ ok: false, reason: 'unknown' }) as const);
    setBusy(null);
    if (!result.ok) {
      setNotice(failureNotice(result.reason));
      return;
    }
    track('purchase_restored', { active: result.active });
    setNotice(
      result.active
        ? { tone: 'success', message: t('paywall.restoreDone') }
        : { tone: 'info', message: t('paywall.restoreNone') },
    );
  };

  const openLegal = (doc: 'kosullar' | 'gizlilik') =>
    router.push({ pathname: '/settings/legal/[doc]', params: { doc } });

  const canBuy = !isPro && !blocked && offering != null && selected != null && busy == null;
  const ios = Platform.OS !== 'android';

  const footer = (
    <>
      {isPro ? (
        <Button label={t('paywall.current.manage')} variant="secondary" onPress={manage} block />
      ) : (
        <Button
          label={t('paywall.buy')}
          onPress={buy}
          disabled={!canBuy}
          loading={busy === 'buy'}
          block
        />
      )}
      <Button
        label={t('paywall.restore')}
        variant="plain"
        onPress={restorePurchases}
        loading={busy === 'restore'}
        disabled={busy != null || purchaseMode === 'off'}
        block
      />
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: '',
          headerBackVisible: false,
          headerRight: () => (
            <IconButton
              icon={{ ios: 'xmark', android: 'close', web: 'close' }}
              label={t('paywall.close')}
              onPress={close}
            />
          ),
        }}
      />
      <Page title={t('paywall.title')} intro={t('paywall.intro')} footer={footer}>
        {offering?.test ? (
          <Banner tone="info" title={t('paywall.test.title')} message={t('paywall.test.body')} />
        ) : null}
        {notice ? <Banner tone={notice.tone} title={notice.title} message={notice.message} /> : null}
        {isPro && notice?.tone !== 'success' ? (
          <Banner tone="success" title={t('paywall.current.title')} message={t('paywall.current.body')} />
        ) : null}
        {!isPro && blocked ? (
          <Banner
            tone="warning"
            title={t('paywall.limited.title')}
            message={t('paywall.limited.body')}
            actionLabel={t('paywall.limited.action')}
            onAction={() => router.push('/consent')}
          />
        ) : null}

        <CompareTable />

        {!isPro ? (
          <PackagePicker
            offering={offering}
            selected={selected}
            onSelect={setSelected}
            onRetry={purchaseMode === 'off' ? undefined : retry}
            disabled={blocked || busy != null}
          />
        ) : null}

        <View style={styles.terms}>
          <AppText variant="footnote" color="inkSoft">
            {ios ? t('paywall.renewalIos') : t('paywall.renewalAndroid')}
          </AppText>
          <AppText variant="footnote" color="inkSoft">
            {ios ? t('paywall.cancelIos') : t('paywall.cancelAndroid')}
          </AppText>
          {underAge ? (
            <AppText variant="footnote" color="inkSoft">
              {t('paywall.underAge')}
            </AppText>
          ) : null}
          <View style={styles.links}>
            {(['kosullar', 'gizlilik'] as const).map((doc) => {
              const label = doc === 'kosullar' ? t('paywall.legal.terms') : t('paywall.legal.privacy');
              return (
                <Pressable
                  key={doc}
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  onPress={() => openLegal(doc)}
                  hitSlop={8}
                  style={styles.link}>
                  <AppText variant="footnote" color="pen" style={styles.linkText}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Page>
      {gateElement}
    </>
  );
}

const styles = StyleSheet.create({
  terms: {
    gap: Space.sm,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
