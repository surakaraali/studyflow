import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** BR-06: every piece of AI-generated content carries this label. */
export function AiLabel() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.sunken }]} accessible>
      <SymbolView
        name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
        size={14}
        tintColor={colors.inkSoft}
      />
      <AppText variant="footnote" color="inkSoft">
        {t('common.aiLabel')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs + 2,
    paddingHorizontal: Space.sm + 2,
    paddingVertical: Space.xs,
    borderRadius: Radius.sm,
  },
});
