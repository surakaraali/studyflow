import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localeTag } from '@/lib/dates';

import type { Adherence } from '../stats';

type TileProps = {
  label: string;
  value: string;
  a11y: string;
};

/** A label and its figure: the number is the content, so the tile carries no icon. */
function Tile({ label, value, a11y }: TileProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <AppText variant="footnote" color="inkSoft">
        {label}
      </AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}

type StatTilesProps = {
  streak: number;
  weekMinutes: number;
  adherence: Adherence;
};

/** Streak, this week's minutes and plan adherence at a glance. */
export function StatTiles({ streak, weekMinutes, adherence }: StatTilesProps) {
  const { t, i18n } = useTranslation();
  const percent = new Intl.NumberFormat(localeTag(i18n.language), { style: 'percent' });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Tile
          label={t('progress.tiles.streak')}
          value={t('progress.tiles.streakValue', { count: streak })}
          a11y={t('progress.tiles.streakA11y', { count: streak })}
        />
        <Tile
          label={t('progress.tiles.minutes')}
          value={t('common.minutes', { count: weekMinutes })}
          a11y={t('progress.tiles.minutesA11y', { minutes: weekMinutes })}
        />
        <Tile
          label={t('progress.tiles.adherence')}
          value={adherence.ratio == null ? t('progress.tiles.adherenceNone') : percent.format(adherence.ratio)}
          a11y={
            adherence.ratio == null
              ? t('progress.tiles.adherenceNoneA11y')
              : t('progress.tiles.adherenceA11y', { percent: Math.round(adherence.ratio * 100) })
          }
        />
      </View>
      {streak === 0 ? (
        <AppText variant="footnote" color="inkSoft">
          {t('progress.tiles.streakZero')}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Space.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 96,
    gap: Space.xs,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
