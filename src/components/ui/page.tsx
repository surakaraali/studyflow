import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { Gutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PageProps = {
  /** Large serif title inside the page. Leave out when the native header shows the title. */
  title?: string;
  intro?: string;
  children?: ReactNode;
  /** Pinned to the bottom (primary action of a form or flow). */
  footer?: ReactNode;
  scroll?: boolean;
};

/**
 * Body of a pushed (non-tab) screen: paper background, page margins, keyboard-aware,
 * with an optional pinned footer for the main action.
 */
export function Page({ title, intro, children, footer, scroll = true }: PageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <>
      {title || intro ? (
        <View style={styles.header}>
          {title ? (
            <AppText variant="display" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {intro ? (
            <AppText variant="callout" color="inkSoft">
              {intro}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content]}>{body}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, Space.lg), borderTopColor: colors.line, backgroundColor: colors.paper },
          ]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl,
    gap: Space.xl,
  },
  header: {
    gap: Space.sm,
  },
  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    gap: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
