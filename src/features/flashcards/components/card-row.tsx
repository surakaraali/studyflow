import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AiLabel } from '@/components/ui/ai-label';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { CardRow } from '@/db/types';
import { State } from '@/domain/fsrs';
import { EDITED_ICON, Tag } from '@/features/quiz/components/tag';
import { useTheme } from '@/hooks/use-theme';

/** A card in a deck list: front, back preview, AI label (BR-06), source page and status tags. */
export function CardListRow({ card, onPress }: { card: CardRow; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tags = [
    card.state === State.New ? t('flashcards.card.newBadge') : null,
    card.edited ? t('flashcards.card.edited') : null,
    card.source_page != null ? t('flashcards.card.source', { page: card.source_page }) : null,
    card.ai_generated ? t('common.aiLabel') : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[card.front, card.back, ...tags].join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sunken }]}>
      <View style={styles.text}>
        <AppText variant="body" numberOfLines={3}>
          {card.front}
        </AppText>
        <AppText variant="callout" color="inkSoft" numberOfLines={2}>
          {card.back}
        </AppText>
        <View style={styles.meta}>
          {card.ai_generated ? <AiLabel /> : null}
          {card.state === State.New ? <Tag label={t('flashcards.card.newBadge')} tone="pen" /> : null}
          {card.edited ? <Tag label={t('flashcards.card.edited')} icon={EDITED_ICON} /> : null}
          {card.source_page != null ? (
            <AppText variant="footnote" color="inkSoft">
              {t('flashcards.card.source', { page: card.source_page })}
            </AppText>
          ) : null}
        </View>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={13}
        weight="semibold"
        tintColor={colors.inkFaint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.xs + 2,
    marginTop: 2,
  },
});
