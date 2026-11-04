import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SectionProps = {
  title?: string;
  /** Text under the group, for explanations. */
  footer?: string;
  /** Right side of the title line, e.g. a "Tümü" link. */
  action?: ReactNode;
  children: ReactNode;
};

/** A titled group of rows on a sheet of paper, with hairlines between rows. */
export function Section({ title, footer, action, children }: SectionProps) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.wrap}>
      {title || action ? (
        <View style={styles.header}>
          {title ? (
            <AppText variant="title" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
          ) : null}
          {action}
        </View>
      ) : null}
      {items.length > 0 ? (
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {items.map((child, index) => (
            <Fragment key={index}>
              {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.line }]} /> : null}
              {child}
            </Fragment>
          ))}
        </View>
      ) : null}
      {footer ? (
        <AppText variant="footnote" color="inkSoft" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  title: {
    flex: 1,
  },
  group: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Space.lg,
  },
  footer: {
    paddingHorizontal: Space.xs,
  },
});
