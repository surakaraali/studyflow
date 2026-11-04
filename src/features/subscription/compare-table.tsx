import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { quota } from '@/domain/rules';
import { useTheme } from '@/hooks/use-theme';

type Row = {
  feature: string;
  /** A number to show, or true for "included". */
  free: string | true;
  pro: string | true;
};

function Cell({ value, pro }: { value: string | true; pro?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cell}>
      {value === true ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={16}
          weight="bold"
          tintColor={pro ? colors.pen : colors.inkSoft}
        />
      ) : (
        <AppText variant="heading" color={pro ? 'pen' : 'ink'}>
          {value}
        </AppText>
      )}
    </View>
  );
}

/**
 * Free vs Pro (FR-SUB-01). Only real differences: the monthly document quota and the page
 * limit (BR-14). Everything else is listed as included in both plans.
 */
export function CompareTable() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const free = quota('free');
  const pro = quota('pro');

  const rows: Row[] = [
    { feature: t('paywall.compare.documents'), free: String(free.documents), pro: String(pro.documents) },
    { feature: t('paywall.compare.pages'), free: String(free.pages), pro: String(pro.pages) },
    { feature: t('paywall.compare.ai'), free: true, pro: true },
    { feature: t('paywall.compare.plan'), free: true, pro: true },
    { feature: t('paywall.compare.review'), free: true, pro: true },
    { feature: t('paywall.compare.tracking'), free: true, pro: true },
    { feature: t('paywall.compare.noAds'), free: true, pro: true },
  ];

  const spoken = (value: string | true) => (value === true ? t('paywall.compare.included') : value);

  return (
    <View style={styles.wrap}>
      <AppText variant="title" accessibilityRole="header">
        {t('paywall.compare.title')}
      </AppText>
      <View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <AppText variant="footnote" color="inkSoft" style={styles.feature}>
            {t('paywall.compare.feature')}
          </AppText>
          <View style={styles.cell}>
            <AppText variant="footnote" color="inkSoft">
              {t('paywall.compare.free')}
            </AppText>
          </View>
          <View style={styles.cell}>
            <AppText variant="footnote" color="pen" style={styles.bold}>
              {t('paywall.compare.pro')}
            </AppText>
          </View>
        </View>
        {rows.map((row) => (
          <Fragment key={row.feature}>
            <View style={[styles.rule, { backgroundColor: colors.line }]} />
            <View
              accessible
              accessibilityLabel={t('paywall.compare.rowA11y', {
                feature: row.feature,
                free: spoken(row.free),
                pro: spoken(row.pro),
              })}
              style={styles.row}>
              <AppText variant="callout" style={styles.feature}>
                {row.feature}
              </AppText>
              <Cell value={row.free} />
              <Cell value={row.pro} pro />
            </View>
          </Fragment>
        ))}
      </View>
      <AppText variant="footnote" color="inkSoft">
        {t('paywall.compare.quotaNote')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm + 2,
  },
  table: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
    gap: Space.sm,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Space.lg,
  },
  feature: {
    flex: 1,
  },
  cell: {
    width: 64,
    alignItems: 'center',
  },
  bold: {
    fontWeight: '700',
  },
});
