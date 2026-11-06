import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { formatDateTime, formatFullDate } from '@/features/account/format';
import { useTheme } from '@/hooks/use-theme';
import { isLocalMode } from '@/services/config';
import { profileAccess } from '@/stores/session';

import { openParentPage, useConsentActions, useConsentState } from '../use-consent';
import { ParentEmailForm } from './parent-email-form';

const ICONS = {
  pending: { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' },
  granted: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  revoked: { ios: 'xmark.octagon', android: 'block', web: 'block' },
  not_required: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
} as const;

type ConsentPanelProps = {
  /** Lists what is open and closed while waiting (13–17, BR-03). */
  showAccessSummary?: boolean;
};

/** Consent status with the student's actions: resend, change the parent's email, dev link. */
export function ConsentPanel({ showAccessSummary = false }: ConsentPanelProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const state = useConsentState();
  const actions = useConsentActions();
  const [editing, setEditing] = useState(false);

  const status = state.profile?.consent_status ?? 'pending';
  const devToken = isLocalMode && status !== 'not_required' ? state.latestRequest?.token : undefined;
  const waiting = status === 'pending' || status === 'revoked';
  const accent = status === 'granted' || status === 'not_required' ? colors.success : colors.exam;
  const purposeNames = state.purposes.map((p) =>
    p === 'ai' ? t('consent.purpose.ai') : t('consent.purpose.notifications'),
  );

  // Under 13 nothing opens before the parent says yes, so the "already open" text would mislead.
  const locked = profileAccess(state.profile ?? null) === 'locked';
  const body = locked
    ? t('consent.lockedBody')
    : status === 'granted'
      ? t('consent.grantedBody')
      : status === 'revoked'
        ? t('consent.revokedBody')
        : status === 'not_required'
          ? t('consent.notRequiredBody')
          : t('consent.limitedBody');

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.statusRow}>
          <SymbolView name={ICONS[status]} size={26} tintColor={accent} style={styles.icon} />
          <View style={styles.flex}>
            <AppText variant="title" accessibilityRole="header">
              {t(`consent.status.${status}`)}
            </AppText>
            <AppText variant="callout" color="inkSoft">
              {body}
            </AppText>
          </View>
        </View>

        {state.profile?.parent_email && status !== 'not_required' ? (
          <View style={styles.detail}>
            <AppText variant="footnote" color="inkSoft">
              {t('consent.parentEmail')}
            </AppText>
            <AppText variant="body" selectable>
              {state.profile.parent_email}
            </AppText>
          </View>
        ) : null}

        {waiting && state.latestRequest ? (
          <AppText variant="footnote" color="inkSoft">
            {t('consent.lastSent', { date: formatDateTime(state.latestRequest.created_at, i18n.language) })}
          </AppText>
        ) : null}

        {status === 'granted' && state.lastGrant ? (
          <View style={styles.detail}>
            <AppText variant="footnote" color="inkSoft">
              {t('consent.grantedOn', { date: formatFullDate(state.lastGrant.created_at, i18n.language) })}
            </AppText>
            {purposeNames.length > 0 ? (
              <AppText variant="footnote" color="inkSoft">
                {t('consent.purposes', { list: purposeNames.join(', ') })}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Card>

      {status === 'granted' && state.aiDenied ? (
        <Banner tone="info" message={t('consent.aiPurposeMissing')} />
      ) : null}

      {waiting && state.linkExpired ? <Banner tone="warning" message={t('consent.linkExpired')} /> : null}

      {showAccessSummary && waiting ? (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
              size={20}
              tintColor={colors.success}
              style={styles.smallIcon}
            />
            <View style={styles.flex}>
              <AppText variant="heading">{t('consent.openTitle')}</AppText>
              <AppText variant="callout" color="inkSoft">
                {t('consent.openList')}
              </AppText>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <SymbolView
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              size={20}
              tintColor={colors.exam}
              style={styles.smallIcon}
            />
            <View style={styles.flex}>
              <AppText variant="heading">{t('consent.closedTitle')}</AppText>
              <AppText variant="callout" color="inkSoft">
                {t('consent.closedList')}
              </AppText>
            </View>
          </View>
        </View>
      ) : null}

      {actions.feedback ? <Banner tone={actions.feedback.tone} message={actions.feedback.text} /> : null}

      {waiting ? (
        <View style={styles.actions}>
          <Button
            label={t('consent.resend')}
            variant="secondary"
            icon={{ ios: 'paperplane', android: 'send', web: 'send' }}
            onPress={() => void actions.resend()}
            loading={actions.busy === 'resend'}
            disabled={state.resendsLeft === 0 || !state.profile?.parent_email}
            block
          />
          <AppText variant="footnote" color="inkSoft" style={styles.center}>
            {state.resendsLeft > 0
              ? t('consent.resendLeft', { count: state.resendsLeft })
              : t('consent.resendLimit')}
          </AppText>

          {editing ? (
            <ParentEmailForm
              onSubmit={actions.changeEmail}
              onCancel={() => setEditing(false)}
              busy={actions.busy === 'change'}
            />
          ) : (
            <Button
              label={t('consent.changeEmail')}
              variant="plain"
              onPress={() => setEditing(true)}
              disabled={state.resendsLeft === 0}
              block
            />
          )}
        </View>
      ) : null}

      {devToken ? (
        <Card style={styles.dev}>
          <AppText variant="footnote" color="inkSoft">
            {t('consent.devHint')}
          </AppText>
          <Button
            label={t('consent.devLink')}
            variant="secondary"
            icon={{ ios: 'hammer', android: 'build', web: 'build' }}
            onPress={() => openParentPage(devToken)}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg,
  },
  flex: {
    flex: 1,
    gap: Space.xs,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  icon: {
    width: 28,
    height: 28,
    marginTop: 2,
  },
  smallIcon: {
    width: 22,
    height: 22,
    marginTop: 1,
  },
  detail: {
    gap: 2,
  },
  summary: {
    gap: Space.lg,
    paddingHorizontal: Space.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  actions: {
    gap: Space.sm,
  },
  center: {
    textAlign: 'center',
  },
  dev: {
    gap: Space.md,
  },
});
