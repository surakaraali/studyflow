import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BubbleRow } from '@/components/bubble-row';
import { Space } from '@/constants/theme';

const PER_ROW = 5;

type DayBubblesProps = {
  total: number;
  done: number;
  size?: 'regular' | 'large';
};

/**
 * A day's blocks as optik form rows: one bubble per block, filled when done.
 * More than five blocks continue on the next numbered row, like the next question.
 */
export function DayBubbles({ total, done, size = 'regular' }: DayBubblesProps) {
  const { t } = useTranslation();
  const rows = Math.max(1, Math.ceil(total / PER_ROW));

  return (
    <View
      accessible
      accessibilityLabel={t('bubbles.a11y', { done, total })}
      style={styles.wrap}>
      {Array.from({ length: rows }, (_, row) => (
        <BubbleRow
          key={row}
          size={size}
          filled={Math.max(0, Math.min(PER_ROW, done - row * PER_ROW))}
          // An empty day keeps a full blank row; otherwise one bubble per block.
          count={total === 0 ? PER_ROW : Math.min(PER_ROW, total - row * PER_ROW)}
          label={rows > 1 ? String(row + 1) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
});
