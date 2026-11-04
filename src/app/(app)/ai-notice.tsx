import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { nowIso } from '@/db/ids';
import { patch } from '@/db/write';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, localeTag } from '@/lib/dates';
import { useProfile } from '@/stores/session';

function Item({ icon, text, tone }: { icon: SymbolViewProps['name']; text: string; tone: 'success' | 'exam' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.item}>
      <SymbolView name={icon} size={18} tintColor={colors[tone]} style={styles.itemIcon} />
      <AppText variant="body" style={styles.itemText}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * US-18: what is sent to the AI and what is not (BR-05), and that results may contain mistakes
 * (BR-06). Accepting it is required before the first upload; it can be reopened from Settings.
 */
export default function AiNoticeScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useProfile();
  const params = useLocalSearchParams<{ next?: string; courseId?: string }>();
  const [saving, setSaving] = useState(false);
  const acceptedAt = profile?.ai_notice_accepted_at;

  const close = () => {
    if (params.next === 'upload') {
      router.replace({ pathname: '/document/upload', params: params.courseId ? { courseId: params.courseId } : {} });
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const accept = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await patch('profile', profile.id, { ai_notice_accepted_at: nowIso() });
      close();
    } finally {
      setSaving(false);
    }
  };

  const check = { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } as const;
  const cross = { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' } as const;

  return (
    <>
      <Stack.Screen options={{ title: '', presentation: 'modal' }} />
      <Page
        title={t('aiNotice.title')}
        intro={t('aiNotice.intro')}
        footer={
          acceptedAt ? (
            <>
              <AppText variant="footnote" color="inkSoft" style={styles.center}>
                {t('aiNotice.acceptedOn', { date: formatLongDate(new Date(acceptedAt), localeTag(i18n.language)) })}
              </AppText>
              <Button
                block
                label={params.next === 'upload' ? t('common.continue') : t('common.close')}
                variant={params.next === 'upload' ? 'primary' : 'secondary'}
                onPress={close}
              />
            </>
          ) : (
            <Button block label={t('aiNotice.accept')} loading={saving} onPress={accept} />
          )
        }>
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t('aiNotice.sentTitle')}
          </AppText>
          <View style={styles.list}>
            <Item icon={check} tone="success" text={t('aiNotice.sentDocument')} />
            <Item icon={check} tone="success" text={t('aiNotice.sentGrade')} />
            <Item icon={check} tone="success" text={t('aiNotice.sentCourse')} />
          </View>
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t('aiNotice.notSentTitle')}
          </AppText>
          <Item icon={cross} tone="exam" text={t('aiNotice.notSentBody')} />
        </Card>

        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t('aiNotice.mistakesTitle')}
          </AppText>
          <AppText variant="body" color="inkSoft">
            {t('aiNotice.mistakesBody')}
          </AppText>
        </Card>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Space.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  itemIcon: {
    width: 22,
    height: 22,
    marginTop: 2,
  },
  itemText: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
});
