import { useState } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

/**
 * Paper strip behind the status bar for screens without a navigation header (tab screens,
 * welcome). Content that scrolls up slides under it instead of under the clock; a hairline
 * shows once the content has moved.
 */
export function TopEdge({ scrolled }: { scrolled: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.edge,
        {
          height: insets.top,
          backgroundColor: colors.paper,
          borderBottomColor: scrolled ? colors.line : 'transparent',
        },
      ]}
    />
  );
}

/** Tracks whether a scroll view has moved past its top, for TopEdge's hairline. */
export function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentInset } = event.nativeEvent;
    // On iOS the automatic inset makes the resting offset negative; measure from there.
    const next = contentOffset.y + (contentInset?.top ?? 0) > threshold;
    if (next !== scrolled) setScrolled(next);
  };
  return { scrolled, onScroll };
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
