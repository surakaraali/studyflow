import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, parseDate } from '@/lib/dates';

type DateTimeFieldProps = {
  label: string;
  mode: 'date' | 'time';
  /** "YYYY-MM-DD" for dates, "HH:MM" for times */
  value: string | null;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string | null;
};

function toDate(mode: 'date' | 'time', value: string | null): Date {
  if (!value) return new Date();
  if (mode === 'date') return parseDate(value);
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fromDate(mode: 'date' | 'time', date: Date): string {
  if (mode === 'date') return formatDate(date);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Date or time input. iOS shows the compact system picker inline;
 * Android opens the system dialog from a pressable field.
 */
export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  error,
}: DateTimeFieldProps) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) onChange(fromDate(mode, date));
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: error ? colors.exam : colors.line }]}>
        <AppText variant="body" style={styles.label}>
          {label}
        </AppText>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            accessibilityLabel={label}
            value={toDate(mode, value)}
            mode={mode}
            display="compact"
            locale="tr-TR"
            minuteInterval={mode === 'time' ? 5 : undefined}
            themeVariant={scheme}
            accentColor={colors.pen}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handle}
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)}>
            <AppText variant="body" color={value ? 'pen' : 'inkFaint'}>
              {value ?? placeholder ?? '—'}
            </AppText>
          </Pressable>
        )}
      </View>
      {Platform.OS !== 'ios' && open ? (
        <DateTimePicker
          value={toDate(mode, value)}
          mode={mode}
          is24Hour
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handle}
        />
      ) : null}
      {error ? (
        <AppText variant="footnote" color="exam">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.xs,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Space.md,
  },
  label: {
    flexShrink: 1,
  },
});
