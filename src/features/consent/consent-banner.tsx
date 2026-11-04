import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isLocalMode } from '@/services/config';

import { openParentPage, useConsentActions, useConsentState } from './use-consent';

/**
 * CONTRACT (owned by the account feature): banner for 13–17 year olds waiting for consent
 * (BR-03). Renders nothing when access is full. Shows why AI and purchases are off, and
 * lets the student resend the link (3 a day) or change the parent's email.
 */
export function ConsentBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const state = useConsentState();
  const actions = useConsentActions();

  if (state.access !== 'limited' || !state.profile) return null;

  const revoked = state.profile.consent_status === 'revoked';
  const canResend = state.resendsLeft > 0 && !!state.profile.parent_email;
  const devToken = isLocalMode ? state.latestRequest?.token : undefined;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.line, borderLeftColor: colors.exam },
      ]}>
      <View style={styles.header} accessible>
        <SymbolView
          name={
            revoked
              ? { ios: 'xmark.octagon', android: 'block', web: 'block' }
              : { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' }
          }
          size={20}
          tintColor={colors.exam}
          style={styles.icon}
        />
        <View style={styles.text}>
          <AppText variant="heading">
            {revoked ? t('consent.status.revoked') : t('consent.status.pending')}
          </AppText>
          <AppText variant="callout" color="inkSoft">
            {revoked ? t('consent.revokedBody') : t('consent.limitedBody')}
          </AppText>
          {state.linkExpired ? (
            <AppText variant="footnote" color="exam">
              {t('consent.linkExpired')}
            </AppText>
          ) : null}
          {actions.feedback ? (
            <AppText
              variant="footnote"
              color={actions.feedback.tone === 'success' ? 'success' : 'exam'}
              accessibilityLiveRegion="polite">
              {actions.feedback.text}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label={t('consent.resend')}
            variant="secondary"
            onPress={() => void actions.resend()}
            loading={actions.busy === 'resend'}
            disabled={!canResend}
            accessibilityHint={
              state.resendsLeft > 0
                ? t('consent.resendLeft', { count: state.resendsLeft })
                : t('consent.resendLimit')
            }
          />
          <AppText variant="footnote" color="inkSoft">
            {state.resendsLeft > 0
              ? t('consent.resendLeft', { count: state.resendsLeft })
              : t('consent.resendLimit')}
          </AppText>
        </View>
        <View style={styles.links}>
          <Button label={t('consent.changeEmail')} variant="plain" onPress={() => router.push('/consent')} />
          {devToken ? (
            <Button label={t('consent.devLink')} variant="plain" onPress={() => openParentPage(devToken)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    gap: Space.md,
  },
  icon: {
    width: 22,
    height: 22,
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
  actions: {
    gap: Space.xs,
    paddingLeft: 22 + Space.md,
  },
  action: {
    alignItems: 'flex-start',
    gap: Space.xs,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -Space.lg,
  },
});
