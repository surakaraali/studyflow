import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type HighlightMarkProps = {
  active: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A slightly crooked highlighter stroke behind its content. Marks "today". */
export function HighlightMark({ active, children, style }: HighlightMarkProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      {active ? <View style={[styles.mark, { backgroundColor: colors.highlight }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  mark: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 0,
    right: 0,
    borderRadius: 4,
    transform: [{ rotate: '-4deg' }],
  },
});
