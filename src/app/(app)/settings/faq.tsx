import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Order of the questions on screen; texts live in i18n under faq.items. */
const FAQ_IDS = [
  'plan',
  'missed',
  'streak',
  'ai',
  'aiWrong',
  'quota',
  'consent',
  'offline',
  'notifications',
  'subscription',
  'restore',
  'deleteAccount',
] as const;

type FaqId = (typeof FAQ_IDS)[number];

function FaqItem({ id, open, onToggle }: { id: FaqId; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={t('faq.expandHint')}
        onPress={onToggle}
        style={({ pressed }) => [styles.question, pressed && { backgroundColor: colors.sunken }]}>
        <AppText variant="body" style={styles.flex}>
          {t(`faq.items.${id}.q`)}
        </AppText>
        <SymbolView
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={13}
          weight="semibold"
          tintColor={colors.inkSoft}
        />
      </Pressable>
      {open ? (
        <AppText variant="callout" color="inkSoft" style={styles.answer}>
          {t(`faq.items.${id}.a`)}
        </AppText>
      ) : null}
    </View>
  );
}

/** US-66: answers about the plan, AI, quota, consent, offline use, subscription and deletion. */
export default function FaqScreen() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<FaqId | null>(null);

  return (
    <>
      <Stack.Screen options={{ title: t('faq.title') }} />
      <Page intro={t('faq.intro')}>
        <Section>
          {FAQ_IDS.map((id) => (
            <FaqItem
              key={id}
              id={id}
              open={open === id}
              onToggle={() => setOpen((current) => (current === id ? null : id))}
            />
          ))}
        </Section>
        <Button
          label={t('faq.contact')}
          variant="secondary"
          icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
          onPress={() => router.push('/settings/support')}
        />
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  question: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
  },
  flex: {
    flex: 1,
  },
  answer: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
  },
});
