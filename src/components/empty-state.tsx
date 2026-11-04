import { StyleSheet, View } from 'react-native';

import { Button, type ButtonProps } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  body: string;
  /** The first action is primary, the rest are secondary unless they say otherwise. */
  actions?: ButtonProps[];
};

export function EmptyState({ title, body, actions = [] }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="callout" color="inkSoft">
          {body}
        </AppText>
      </View>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <Button
              key={action.label}
              {...action}
              variant={action.variant ?? (index === 0 ? 'primary' : 'secondary')}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.lg + 4,
    alignItems: 'flex-start',
  },
  text: {
    gap: Space.sm,
    maxWidth: 520,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
});
