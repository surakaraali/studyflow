import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/ui/date-time-field';
import { IconButton } from '@/components/ui/icon-button';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { TimeRange } from '@/features/timetable/ranges';
import { useTheme } from '@/hooks/use-theme';

type RangeFieldsProps = {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  onRemove: () => void;
  labels: { start: string; end: string; remove: string };
  /** Shown under the times in the exam color, with a warning icon. */
  error?: string | null;
  /** A softer note (e.g. past bedtime). */
  note?: string | null;
  /** Extra fields, e.g. the course of a timetable slot. */
  children?: ReactNode;
};

/** One start–end range on its own sheet, with a delete button. */
export function RangeFields({ value, onChange, onRemove, labels, error, note, children }: RangeFieldsProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.paper, borderColor: error ? colors.exam : colors.line },
      ]}>
      <View style={styles.header}>
        <AppText variant="heading" style={styles.title}>
          {value.start}–{value.end}
        </AppText>
        <IconButton
          icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
          label={`${labels.remove}, ${value.start}–${value.end}`}
          tone="inkSoft"
          size={20}
          onPress={onRemove}
        />
      </View>
      <DateTimeField
        label={labels.start}
        mode="time"
        value={value.start}
        onChange={(start) => onChange({ ...value, start })}
      />
      <DateTimeField
        label={labels.end}
        mode="time"
        value={value.end}
        onChange={(end) => onChange({ ...value, end })}
      />
      {children}
      {error ? (
        <View style={styles.message} accessible accessibilityRole="alert">
          <SymbolView
            name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
            size={16}
            tintColor={colors.exam}
          />
          <AppText variant="footnote" color="exam" style={styles.messageText}>
            {error}
          </AppText>
        </View>
      ) : note ? (
        <View style={styles.message} accessible>
          <SymbolView
            name={{ ios: 'moon', android: 'bedtime', web: 'bedtime' }}
            size={16}
            tintColor={colors.inkSoft}
          />
          <AppText variant="footnote" color="inkSoft" style={styles.messageText}>
            {note}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Space.xs,
  },
  title: {
    flex: 1,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    paddingHorizontal: Space.xs,
  },
  messageText: {
    flex: 1,
  },
});
