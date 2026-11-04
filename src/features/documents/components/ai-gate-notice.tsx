import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Space } from '@/constants/theme';
import { ConsentBanner } from '@/features/consent/consent-banner';

import type { AiGate } from '../gate';

/**
 * Explains why AI uploads are off (consent, AI notice) and shows the way forward.
 * Quota limits are shown by QuotaMeter.
 */
export function AiGateNotice({ gate, courseId }: { gate: AiGate; courseId?: string }) {
  const { t } = useTranslation();

  if (gate.kind === 'consent') {
    return (
      <View style={styles.wrap}>
        <Banner
          tone="warning"
          title={t('study.aiOffTitle')}
          message={
            gate.reason === 'revoked'
              ? t('study.aiOffRevoked')
              : gate.reason === 'purpose'
                ? t('study.aiOffPurpose')
                : t('study.aiOffPending')
          }
        />
        <ConsentBanner />
      </View>
    );
  }

  if (gate.kind === 'notice') {
    return (
      <Banner
        title={t('study.noticeTitle')}
        message={t('study.noticeBody')}
        actionLabel={t('study.noticeAction')}
        onAction={() => router.push({ pathname: '/ai-notice', params: { next: 'upload', ...(courseId ? { courseId } : {}) } })}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.md,
  },
});
