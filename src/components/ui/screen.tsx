import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { BottomTabInset, Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

/**
 * Scrollable tab screen with a large serif title.
 * iOS adjusts for the status bar and tab bar on its own; Android needs manual padding.
 */
export function Screen({ title, subtitle, children }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        isIOS
          ? styles.contentIOS
          : {
              paddingTop: insets.top + Space.xl,
              paddingBottom: insets.bottom + BottomTabInset + Space.xl,
            },
      ]}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="callout" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Gutter,
    gap: Space.xxl,
  },
  contentIOS: {
    paddingTop: Space.xl,
    paddingBottom: Space.xxl,
  },
  header: {
    gap: Space.xs,
  },
});
