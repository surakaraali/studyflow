import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ProOffering, ProPackage } from '@/services/purchases';

type PackagePickerProps = {
  /** undefined while loading, null when the store could not be reached. */
  offering: ProOffering | null | undefined;
  selected: string | null;
  onSelect: (id: string) => void;
  onRetry?: () => void;
  disabled?: boolean;
};

/** The subscription periods with the store's own localized prices (Q-05: price comes from the store). */
export function PackagePicker({ offering, selected, onSelect, onRetry, disabled }: PackagePickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const name = (pkg: ProPackage) => t(`paywall.packages.${pkg.period}`);
  const price = (pkg: ProPackage) => {
    if (offering?.test) return t('paywall.test.price');
    if (pkg.period === 'monthly') return t('paywall.packages.perMonth', { price: pkg.priceString });
    if (pkg.period === 'annual') return t('paywall.packages.perYear', { price: pkg.priceString });
    return pkg.priceString;
  };

  if (offering === undefined) {
    return (
      <View style={styles.loading} accessible accessibilityLabel={t('paywall.packages.loading')}>
        <ActivityIndicator color={colors.pen} />
        <AppText variant="callout" color="inkSoft">
          {t('paywall.packages.loading')}
        </AppText>
      </View>
    );
  }

  if (offering === null) {
    return (
      <Banner
        tone="warning"
        message={onRetry ? t('paywall.packages.loadError') : t('paywall.packages.unavailable')}
        actionLabel={onRetry ? t('common.retry') : undefined}
        onAction={onRetry}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="title" accessibilityRole="header">
        {t('paywall.packages.title')}
      </AppText>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {offering.packages.map((pkg) => {
          const checked = pkg.id === selected;
          return (
            <Pressable
              key={pkg.id}
              accessibilityRole="radio"
              accessibilityLabel={`${name(pkg)}, ${price(pkg)}`}
              accessibilityState={{ checked, selected: checked, disabled }}
              disabled={disabled}
              onPress={() => onSelect(pkg.id)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: colors.surface,
                  borderColor: checked ? colors.pen : colors.line,
                  borderWidth: checked ? 2 : 1,
                },
                pressed && { opacity: 0.75 },
                disabled && { opacity: 0.45 },
              ]}>
              <SymbolView
                name={
                  checked
                    ? { ios: 'largecircle.fill.circle', android: 'radio_button_checked', web: 'radio_button_checked' }
                    : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }
                }
                size={22}
                tintColor={checked ? colors.pen : colors.inkSoft}
              />
              <View style={styles.text}>
                <AppText variant="heading">{name(pkg)}</AppText>
                <AppText variant="callout" color="inkSoft">
                  {price(pkg)}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm + 2,
  },
  list: {
    gap: Space.sm,
  },
  option: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
    borderRadius: Radius.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 48,
  },
});
