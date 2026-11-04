import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { AppText } from '@/components/ui/text';
import { Radius, Space } from '@/constants/theme';
import type { TimetableSlot } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { CourseSelect } from '@/features/courses/components/course-select';
import { listCourses } from '@/features/courses/repo';
import { RangeFields } from '@/features/timetable/components/range-fields';
import { nextRange, sortRanges, validateRanges, type RangeError } from '@/features/timetable/ranges';
import { listTimetable, saveTimetable, type SlotDraft } from '@/features/timetable/repo';
import { SCHOOL_DAYS, WEEKDAYS, weekdayName } from '@/features/timetable/weekdays';
import { useTheme } from '@/hooks/use-theme';
import { localeTag } from '@/lib/dates';

type Days = Record<number, SlotDraft[]>;

let keySeq = 0;
const nextKey = () => `slot-${++keySeq}`;

function groupByDay(slots: TimetableSlot[]): Days {
  const days: Days = {};
  for (const day of WEEKDAYS) days[day] = [];
  for (const slot of slots) {
    days[slot.weekday]?.push({
      key: slot.id,
      id: slot.id,
      course_id: slot.course_id,
      start: slot.start_time,
      end: slot.end_time,
    });
  }
  return days;
}

/** US-23: weekly school timetable. The plan never puts study blocks in these hours (BR-09). */
export default function TimetableScreen() {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const { data: slots } = useDbQuery('timetable', () => listTimetable(), ['timetable_slots']);
  const { data: courses } = useDbQuery('courses:active', () => listCourses(), ['courses']);

  const [days, setDays] = useState<Days | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Copy the saved timetable into the editor once it has loaded.
  if (slots && days === null) setDays(groupByDay(slots));

  const errors: Record<number, (RangeError | null)[]> = {};
  for (const day of WEEKDAYS) errors[day] = validateRanges(days?.[day] ?? []);
  const firstInvalidDay = WEEKDAYS.find((day) => errors[day].some(Boolean));

  const updateDay = (day: number, update: (slots: SlotDraft[]) => SlotDraft[]) =>
    setDays((prev) => (prev ? { ...prev, [day]: update(prev[day] ?? []) } : prev));

  const addSlot = (day: number) =>
    updateDay(day, (list) => [
      ...list,
      {
        key: nextKey(),
        course_id: null,
        ...nextRange(list, { first: { start: '08:30', end: '09:10' }, length: 40, gap: 10 }),
      },
    ]);

  const copyToSchoolDays = (day: number) => {
    const apply = () =>
      setDays((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const target of SCHOOL_DAYS) {
          if (target === day) continue;
          next[target] = prev[day].map((slot) => ({
            key: nextKey(),
            course_id: slot.course_id,
            start: slot.start,
            end: slot.end,
          }));
        }
        return next;
      });

    const overwrites = SCHOOL_DAYS.some((d) => d !== day && (days?.[d]?.length ?? 0) > 0);
    if (!overwrites) {
      apply();
      return;
    }
    const name = weekdayName(day, tag);
    Alert.alert(t('timetable.copyConfirmTitle', { day: name }), t('timetable.copyConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('timetable.copyAction'), onPress: apply },
    ]);
  };

  const save = async () => {
    if (!days) return;
    if (firstInvalidDay != null) {
      setShowErrors(true);
      setOpenDay(firstInvalidDay);
      return;
    }
    setSaving(true);
    try {
      await saveTimetable(days);
      router.back();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  const errorText = (error: RangeError | null) =>
    error === 'endBeforeStart'
      ? t('timetable.errorEndBeforeStart')
      : error === 'overlap'
        ? t('timetable.errorOverlap')
        : null;

  return (
    <>
      <Stack.Screen options={{ title: t('timetable.title') }} />
      <Page
        intro={t('timetable.intro')}
        footer={
          <Button label={t('common.save')} onPress={save} loading={saving} disabled={!days} block />
        }>
        <AppText variant="footnote" color="inkSoft">
          {t('timetable.hint')}
        </AppText>

        {showErrors && firstInvalidDay != null ? (
          <Banner tone="warning" message={t('timetable.errorSummary')} />
        ) : null}

        {days
          ? WEEKDAYS.map((day) => {
              const list = days[day] ?? [];
              const name = weekdayName(day, tag);
              const sorted = sortRanges(list);
              const summary =
                list.length === 0
                  ? t('timetable.dayEmpty')
                  : t('timetable.daySummary', {
                      count: list.length,
                      from: sorted[0].start,
                      to: sorted.reduce((max, s) => (s.end > max ? s.end : max), sorted[0].end),
                    });
              return (
                <DayCard
                  key={day}
                  title={name}
                  summary={summary}
                  open={openDay === day}
                  invalid={errors[day].some(Boolean)}
                  onToggle={() => setOpenDay(openDay === day ? null : day)}>
                  {list.map((slot, index) => (
                    <RangeFields
                      key={slot.key}
                      value={slot}
                      labels={{
                        start: t('timetable.start'),
                        end: t('timetable.end'),
                        remove: t('timetable.removeSlot'),
                      }}
                      error={errorText(errors[day][index])}
                      onChange={(range) =>
                        updateDay(day, (l) => l.map((s) => (s.key === slot.key ? { ...s, ...range } : s)))
                      }
                      onRemove={() => updateDay(day, (l) => l.filter((s) => s.key !== slot.key))}>
                      <CourseSelect
                        label={t('courses.courseLabel')}
                        courses={courses ?? []}
                        value={slot.course_id}
                        allowNone
                        onChange={(courseId) =>
                          updateDay(day, (l) =>
                            l.map((s) => (s.key === slot.key ? { ...s, course_id: courseId } : s)),
                          )
                        }
                      />
                    </RangeFields>
                  ))}
                  <Button
                    variant="secondary"
                    label={t('timetable.addSlot')}
                    accessibilityHint={t('timetable.addSlotA11y', { day: name })}
                    icon={{ ios: 'plus', android: 'add', web: 'add' }}
                    onPress={() => addSlot(day)}
                  />
                  {list.length > 0 && (SCHOOL_DAYS as readonly number[]).includes(day) ? (
                    <Button
                      variant="plain"
                      label={t('timetable.copy')}
                      accessibilityHint={t('timetable.copyA11y', { day: name })}
                      icon={{ ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }}
                      onPress={() => copyToSchoolDays(day)}
                    />
                  ) : null}
                </DayCard>
              );
            })
          : null}
      </Page>
    </>
  );
}

function DayCard({
  title,
  summary,
  open,
  invalid,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  invalid: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.day,
        { backgroundColor: colors.surface, borderColor: invalid ? colors.exam : colors.line },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.dayHeader, pressed && { backgroundColor: colors.sunken }]}>
        <View style={styles.dayText}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="footnote" color={invalid ? 'exam' : 'inkSoft'}>
            {summary}
          </AppText>
        </View>
        {invalid ? (
          <SymbolView
            name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
            size={18}
            tintColor={colors.exam}
          />
        ) : null}
        <SymbolView
          name={
            open
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={14}
          weight="semibold"
          tintColor={colors.inkFaint}
        />
      </Pressable>
      {open ? <View style={styles.dayBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dayHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  dayText: {
    flex: 1,
    gap: 2,
  },
  dayBody: {
    gap: Space.md,
    paddingHorizontal: Space.md,
    paddingBottom: Space.lg,
  },
});
