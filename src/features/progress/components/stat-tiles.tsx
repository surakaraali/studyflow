import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localeTag } from '@/lib/dates';

import type { Adherence } from '../stats';

type TileProps = {
  icon: SymbolViewProps['name'];
  label: string;
  value: string;
  a11y: string;
};

function Tile({ icon, label, value, a11y }: TileProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.tileHead}>
        <SymbolView name={icon} size={16} tintColor={colors.pen} />
        <AppText variant="footnote" color="inkSoft" style={styles.flex}>
          {label}
        </AppText>
      </View>
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
          icon={{ ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' }}
          label={t('progress.tiles.streak')}
          value={t('progress.tiles.streakValue', { count: streak })}
          a11y={t('progress.tiles.streakA11y', { count: streak })}
        />
        <Tile
          icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
          label={t('progress.tiles.minutes')}
          value={t('common.minutes', { count: weekMinutes })}
          a11y={t('progress.tiles.minutesA11y', { minutes: weekMinutes })}
        />
        <Tile
          icon={{ ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' }}
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
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  flex: {
    flex: 1,
  },
});
