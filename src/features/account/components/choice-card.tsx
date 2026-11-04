import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChoiceCardProps = {
  title: string;
  description?: string;
  /** Small note above the title, e.g. "Önerilen". */
  badge?: string;
  selected: boolean;
  onPress: () => void;
  /** Round optik bubble for single choice, square box for independent choices. */
  kind?: 'radio' | 'checkbox';
  children?: ReactNode;
};

/** A big, easy-to-hit answer card. The mark on the left fills in like an answer bubble. */
export function ChoiceCard({
  title,
  description,
  badge,
  selected,
  onPress,
  kind = 'radio',
  children,
}: ChoiceCardProps) {
  const { colors } = useTheme();
  const label = [badge, title, description].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.pen : colors.line,
          borderWidth: selected ? 2 : 1,
        },
        pressed && { backgroundColor: colors.sunken },
      ]}>
      <View
        style={[
          kind === 'radio' ? styles.bubble : styles.box,
          {
            borderColor: selected ? colors.pen : colors.exam,
            backgroundColor: selected ? colors.pen : 'transparent',
          },
        ]}>
        {selected ? (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={14}
            weight="bold"
            tintColor={colors.onPen}
          />
        ) : null}
      </View>
      <View style={styles.text}>
        {badge ? (
          <AppText variant="footnote" color="pen" style={styles.badge}>
            {badge}
          </AppText>
        ) : null}
        <AppText variant="heading">{title}</AppText>
        {description ? (
          <AppText variant="callout" color="inkSoft">
            {description}
          </AppText>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.md,
  },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  text: {
    flex: 1,
    gap: Space.xs,
  },
  badge: {
    fontWeight: '600',
  },
});
