import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { OptikSheet } from '@/features/account/components/optik-sheet';
import { useTheme } from '@/hooks/use-theme';

type GateScreenProps = {
  greeting: string;
  title: string;
  body: string;
  safe: string;
  /** A short status line under the text (e.g. "still in maintenance"). */
  note?: string | null;
  footer: ReactNode;
};

/** Full-screen state with the same look as the consent waiting screen. */
export function GateScreen({ greeting, title, body, safe, note, footer }: GateScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // iOS scroll views clear the status bar themselves; Android draws edge to edge.
    <View style={[styles.root, { backgroundColor: colors.paper, paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <Page footer={footer}>
        <OptikSheet />
        <View style={styles.header}>
          <AppText variant="title" color="inkSoft">
            {greeting}
          </AppText>
          <AppText variant="display" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body">{body}</AppText>
          <AppText variant="callout" color="inkSoft">
            {safe}
          </AppText>
          {note ? (
            <AppText variant="callout" color="exam" accessibilityLiveRegion="polite" accessibilityRole="alert">
              {note}
            </AppText>
          ) : null}
        </View>
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    gap: Space.md,
  },
});
