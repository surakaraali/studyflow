import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { PlanItem } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

type PlanBlockRowProps = {
  item: PlanItem;
  courseName: string;
  courseColor?: string | null;
  topicName?: string | null;
  /** The next block of the day: highlighted time and a "Başla" button. */
  isNext?: boolean;
  onPress: () => void;
  onStart?: () => void;
};

const STATUS_ICON = {
  done: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  skipped: { ios: 'arrow.uturn.right.circle', android: 'redo', web: 'redo' },
  planned: { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
} as const;

/** One plan block: time, course color, kind and topic, and its status (icon + spoken text). */
export function PlanBlockRow({
  item,
  courseName,
  courseColor,
  topicName,
  isNext = false,
  onPress,
  onStart,
}: PlanBlockRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const kind = t(`plan.kind.${item.kind}`);
  const status = t(`plan.status.${item.status}`);
  const muted = item.status !== 'planned';
  const detail = topicName ? `${kind} · ${topicName}` : kind;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('plan.rowA11y', {
          time: `${item.start_time}–${item.end_time}`,
          course: courseName,
          kind: detail,
          status,
        })}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}>
        <View style={styles.time}>
          <HighlightMark active={isNext}>
            <AppText variant="heading" color={isNext ? 'onHighlight' : muted ? 'inkSoft' : 'ink'}>
              {item.start_time}
            </AppText>
          </HighlightMark>
          <AppText variant="footnote" color="inkSoft">
            {item.end_time}
          </AppText>
        </View>
        <View
          style={[styles.bar, { backgroundColor: courseColor ?? colors.inkFaint }]}
        />
        <View style={styles.text}>
          <AppText variant="body" color={muted ? 'inkSoft' : 'ink'}>
            {courseName}
          </AppText>
          <AppText variant="footnote" color="inkSoft">
            {detail}
          </AppText>
        </View>
        {!isNext || !onStart ? (
          <SymbolView
            name={STATUS_ICON[item.status]}
            size={22}
            tintColor={
              item.status === 'done' ? colors.success : item.status === 'skipped' ? colors.inkSoft : colors.exam
            }
          />
        ) : null}
      </Pressable>
      {isNext && onStart ? (
        <Button
          label={t('today.start')}
          accessibilityHint={t('today.startA11y', { course: courseName })}
          icon={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
          onPress={onStart}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  main: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.xs,
  },
  time: {
    minWidth: 64,
    alignItems: 'flex-start',
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: Radius.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
