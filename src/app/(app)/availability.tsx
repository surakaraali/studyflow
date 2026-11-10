import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import type { DayType } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { defaultSleep, segmentForGrade, toMinutes, type Segment } from '@/domain/rules';
import { defaultAvailability, type Availability } from '@/features/availability/defaults';
import { getAvailability, saveAvailability } from '@/features/availability/repo';
import { RangeFields } from '@/features/timetable/components/range-fields';
import { nextRange, validateRanges, type RangeError, type TimeRange } from '@/features/timetable/ranges';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/stores/session';

type Draft = Record<DayType, (TimeRange & { key: string })[]>;

let keySeq = 0;
const withKeys = (value: Availability): Draft => ({
  weekday: value.weekday.map((r) => ({ ...r, key: `range-${++keySeq}` })),
  weekend: value.weekend.map((r) => ({ ...r, key: `range-${++keySeq}` })),
});

/** True when a range runs past bedtime (bedtimes after midnight are left alone). */
function pastBedtime(range: TimeRange, bedtime: string): boolean {
  const bed = toMinutes(bedtime);
  if (bed < 12 * 60) return false;
  return toMinutes(range.end) > bed;
}

/** US-47: when the student can study, separately for weekdays and weekends. */
export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();
  const segment: Segment =
    profile?.segment ?? (profile?.grade ? segmentForGrade(profile.grade) : 'ortaokul');
  const sleep = defaultSleep(segment);
  const bedtime = profile?.bedtime ?? sleep.bedtime;
  const wake = profile?.wake_time ?? sleep.wake;

  const { data: saved } = useDbQuery(`availability:${segment}`, () => getAvailability(segment), [
    'availability',
  ]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // Copy the saved ranges (or our suggestions) into the editor once.
  if (saved && draft === null) {
    setDraft(withKeys(saved));
    setIsDefault(saved.isDefault);
  }

  const errors: Record<DayType, (RangeError | null)[]> = {
    weekday: validateRanges(draft?.weekday ?? []),
    weekend: validateRanges(draft?.weekend ?? []),
  };
  const total = (draft?.weekday.length ?? 0) + (draft?.weekend.length ?? 0);
  const invalid = total === 0 || [...errors.weekday, ...errors.weekend].some(Boolean);

  const update = (type: DayType, next: Draft[DayType]) =>
    setDraft((prev) => (prev ? { ...prev, [type]: next } : prev));

  const add = (type: DayType) => {
    const list = draft?.[type] ?? [];
    const first = type === 'weekday' ? defaultAvailability(segment).weekday[0] : { start: '10:00', end: '12:00' };
    update(type, [...list, { ...nextRange(list, { first, length: 60, gap: 30 }), key: `range-${++keySeq}` }]);
  };

  const save = async () => {
    if (!draft) return;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await saveAvailability(draft);
      router.back();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  const errorText = (error: RangeError | null) =>
    error === 'endBeforeStart'
      ? t('availability.errorEndBeforeStart')
      : error === 'overlap'
        ? t('availability.errorOverlap')
        : null;

  const renderDay = (type: DayType) => {
    const list = draft?.[type] ?? [];
    const title = t(`availability.${type}`);
    return (
      <View style={styles.day}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {list.length === 0 ? (
          <AppText variant="callout" color="inkSoft">
            {t('availability.noRanges')}
          </AppText>
        ) : null}
        {list.map((range, index) => (
          <RangeFields
            key={range.key}
            value={range}
            labels={{
              start: t('availability.start'),
              end: t('availability.end'),
              remove: t('availability.removeRange'),
            }}
            error={errorText(errors[type][index])}
            note={pastBedtime(range, bedtime) ? t('availability.pastBedtime') : null}
            onChange={(next) => update(type, list.map((r) => (r.key === range.key ? { ...r, ...next } : r)))}
            onRemove={() => update(type, list.filter((r) => r.key !== range.key))}
          />
        ))}
        <Button
          variant="secondary"
          label={t('availability.addRange')}
          accessibilityHint={t('availability.addRangeA11y', { day: title })}
          icon={{ ios: 'plus', android: 'add', web: 'add' }}
          onPress={() => add(type)}
        />
        <AppText variant="footnote" color="inkSoft">
          {t(type === 'weekday' ? 'availability.weekdayFooter' : 'availability.weekendFooter')}
        </AppText>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('availability.title') }} />
      <Page
        intro={t('availability.intro')}
        footer={
          <Button label={t('common.save')} onPress={save} loading={saving} disabled={!draft} block />
        }>
        <Card>
          <View style={styles.sleepHeader}>
            <SymbolView
              name={{ ios: 'moon.zzz', android: 'bedtime', web: 'bedtime' }}
              size={22}
              tintColor={colors.inkSoft}
            />
            <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
              {t('availability.sleepTitle')}
            </AppText>
          </View>
          <AppText variant="callout" color="inkSoft">
            {t('availability.sleepBody', { bedtime, wake })}
          </AppText>
          <View style={styles.sleepAction}>
            <Button
              variant="plain"
              label={t('availability.sleepLink')}
              onPress={() => router.push('/settings/profile')}
            />
          </View>
        </Card>

        {isDefault ? <Banner tone="info" message={t('availability.defaultsBanner')} /> : null}
        {showErrors && invalid ? (
          <Banner
            tone="warning"
            message={total === 0 ? t('availability.errorEmpty') : t('availability.errorSummary')}
          />
        ) : null}

        {draft ? (
          <>
            {renderDay('weekday')}
            {renderDay('weekend')}
            <View style={styles.reset}>
              <Button
                variant="plain"
                label={t('availability.reset')}
                icon={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }}
                onPress={() => {
                  setDraft(withKeys(defaultAvailability(segment)));
                  setShowErrors(false);
                }}
              />
            </View>
          </>
        ) : null}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sleepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  sleepAction: {
    alignItems: 'flex-start',
    marginLeft: -Space.lg,
    marginTop: -Space.sm,
  },
  day: {
    gap: Space.md,
  },
  reset: {
    alignItems: 'flex-start',
  },
});
