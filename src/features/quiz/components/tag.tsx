import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TagProps = {
  label: string;
  icon?: SymbolViewProps['name'];
  tone?: 'inkSoft' | 'pen' | 'exam';
};

/** Small status label next to an item: "Düzenlendi", "Gizli", "Yeni". */
export function Tag({ label, icon, tone = 'inkSoft' }: TagProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { borderColor: colors.line }]} accessible accessibilityLabel={label}>
      {icon ? <SymbolView name={icon} size={12} tintColor={colors[tone]} /> : null}
      <AppText variant="footnote" color={tone}>
        {label}
      </AppText>
    </View>
  );
}

export const EDITED_ICON = { ios: 'pencil', android: 'edit', web: 'edit' } as const;
export const HIDDEN_ICON = { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } as const;
export const FLAG_ICON = { ios: 'flag', android: 'flag', web: 'flag' } as const;

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
