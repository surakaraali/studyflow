import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { useDbQuery } from '@/db/use-query';
import { todayString } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';

import { dueSummary } from '../repo';
import { useSegment } from '../use-segment';

/**
 * CONTRACT (owned by the flashcards feature): cards due today and a "start review" action (US-50).
 * Renders nothing when the student has no cards at all.
 */
export function DueCardsSummary() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const segment = useSegment();
  // The date in the key makes the count roll over at midnight on the next refresh.
  const { data } = useDbQuery(
    `due-summary:${segment}:${todayString()}`,
    () => dueSummary(segment),
    ['cards', 'decks', 'card_reviews', 'content_reports'],
  );

  if (!data || data.total === 0) return null;

  if (data.today === 0) {
    return (
      <View style={styles.calm}>
        <SymbolView
          name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
          size={18}
          tintColor={colors.success}
        />
        <AppText variant="callout" color="inkSoft" style={styles.flex}>
          {t('flashcards.summary.none')}
        </AppText>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => router.push('/decks')}
          style={styles.link}>
          <AppText variant="callout" color="pen" style={styles.linkText}>
            {t('flashcards.summary.decks')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <Card>
      <View style={styles.head}>
        <SymbolView
          name={{ ios: 'rectangle.stack', android: 'style', web: 'style' }}
          size={22}
          tintColor={colors.pen}
        />
        <HighlightMark active style={styles.mark}>
          <AppText variant="heading" color="onHighlight">
            {t('flashcards.summary.due', { count: data.today })}
          </AppText>
        </HighlightMark>
      </View>
      <View style={styles.actions}>
        <Button label={t('flashcards.summary.start')} onPress={() => router.push('/review')} />
        <Button
          label={t('flashcards.summary.decks')}
          variant="plain"
          onPress={() => router.push('/decks')}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  calm: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  flex: {
    flex: 1,
    minWidth: 160,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontWeight: '600',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  mark: {
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
  },
});
