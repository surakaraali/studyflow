import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { Space } from '@/constants/theme';
import type { Course } from '@/db/types';
import { useDbQuery } from '@/db/use-query';
import { isGradeSupported, type Track } from '@/domain/rules';
import { gradeHasTracks, suggestedCourses, type CatalogCourse } from '@/features/courses/catalog';
import { CheckRow } from '@/features/courses/components/check-row';
import { CourseForm } from '@/features/courses/components/course-form';
import { pickCourseColor } from '@/features/courses/colors';
import { addCatalogCourses, createCourse, listCourses } from '@/features/courses/repo';
import { sameCourseName, validateCourseName } from '@/features/courses/validation';
import { useProfile } from '@/stores/session';

type TrackFilter = Track | 'all';
const TRACK_FILTERS: TrackFilter[] = ['all', 'sayisal', 'esit', 'sozel', 'dil'];

/** US-21 (suggested courses, multi-select) and US-22 (?custom=1: a course of your own). */
export default function NewCourseScreen() {
  const { custom } = useLocalSearchParams<{ custom?: string }>();
  return custom ? <CustomCourse /> : <CatalogPicker />;
}

function findExisting(item: CatalogCourse, courses: readonly Course[]): Course | undefined {
  return courses.find((c) => c.catalog_key === item.key || sameCourseName(c.name, item.name));
}

function CatalogPicker() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const grade = profile?.grade ?? null;
  const supported = grade != null && isGradeSupported(grade);
  const [track, setTrack] = useState<TrackFilter>(profile?.track ?? 'all');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: courses } = useDbQuery(
    'courses:all',
    () => listCourses({ includeArchived: true }),
    ['courses'],
  );

  const suggestions = supported ? suggestedCourses(grade, track === 'all' ? null : track) : [];
  const existing = courses ?? [];
  // Active courses are already added; archived ones can be picked to bring them back.
  const selectable = suggestions.filter((item) => {
    const match = findExisting(item, existing);
    return !match || match.archived_at != null;
  });
  const allSelected = selectable.length > 0 && selectable.every((item) => selected.includes(item.key));

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const changeTrack = (next: TrackFilter) => {
    setTrack(next);
    // Keep only choices that are still on the list, so nothing hidden gets added.
    const visible = suggestedCourses(grade, next === 'all' ? null : next).map((c) => c.key);
    setSelected((prev) => prev.filter((key) => visible.includes(key)));
  };

  const add = async () => {
    setSaving(true);
    try {
      await addCatalogCourses(selected);
      router.back();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('catalog.title') }} />
      <Page
        intro={supported ? t('catalog.intro', { grade }) : t('catalog.introNoGrade')}
        footer={
          supported ? (
            <Button
              label={
                selected.length > 0
                  ? t('catalog.addSelected', { count: selected.length })
                  : t('catalog.chooseFirst')
              }
              onPress={add}
              loading={saving}
              disabled={selected.length === 0 || !courses}
              block
            />
          ) : undefined
        }>
        {supported && gradeHasTracks(grade) ? (
          <Segmented
            label={t('catalog.trackLabel')}
            options={TRACK_FILTERS.map((value) => ({ value, label: t(`catalog.tracks.${value}`) }))}
            value={track}
            onChange={changeTrack}
            wrap
          />
        ) : null}

        {supported && courses ? (
          <Section
            title={t('catalog.listTitle')}
            action={
              selectable.length > 0 ? (
                <Button
                  variant="plain"
                  label={allSelected ? t('catalog.clearAll') : t('catalog.selectAll')}
                  onPress={() => setSelected(allSelected ? [] : selectable.map((c) => c.key))}
                />
              ) : undefined
            }>
            {suggestions.map((item) => {
              const match = findExisting(item, existing);
              if (match && !match.archived_at) {
                return (
                  <CheckRow
                    key={item.key}
                    title={item.name}
                    detail={t('catalog.added')}
                    color={match.color}
                    checked
                    disabled
                  />
                );
              }
              return (
                <CheckRow
                  key={item.key}
                  title={item.name}
                  subtitle={match ? t('catalog.archivedHint') : undefined}
                  detail={match ? t('catalog.archived') : undefined}
                  color={match?.color}
                  checked={selected.includes(item.key)}
                  onToggle={() => toggle(item.key)}
                />
              );
            })}
          </Section>
        ) : null}

        <Section>
          <ListRow
            title={t('catalog.custom')}
            subtitle={t('catalog.customHint')}
            icon={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }}
            onPress={() => router.push({ pathname: '/course/new', params: { custom: '1' } })}
          />
        </Section>
      </Page>
    </>
  );
}

function CustomCourse() {
  const { t } = useTranslation();
  const { data: courses } = useDbQuery(
    'courses:all',
    () => listCourses({ includeArchived: true }),
    ['courses'],
  );
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);

  const existing = courses ?? [];
  const shownColor =
    color ?? pickCourseColor(existing.filter((c) => !c.archived_at).map((c) => c.color));
  const error = validateCourseName(name, existing);

  const save = async () => {
    if (error) {
      setShowError(true);
      return;
    }
    setSaving(true);
    try {
      await createCourse({ name, color: shownColor });
      router.back();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('courses.customTitle') }} />
      <Page
        intro={t('courses.customIntro')}
        footer={
          <Button label={t('courses.add')} onPress={save} loading={saving} disabled={!courses} block />
        }>
        <View style={styles.form}>
          <CourseForm
            name={name}
            onChangeName={(text) => {
              setName(text);
              if (showError) setShowError(false);
            }}
            color={shownColor}
            onChangeColor={setColor}
            error={showError ? error : null}
            onSubmit={save}
            autoFocus
          />
        </View>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Space.xl,
  },
});
