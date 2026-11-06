import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { isGradeSupported, type Track } from '@/domain/rules';
import { gradeHasTracks, suggestedCourses } from '@/features/courses/catalog';
import { CheckRow } from '@/features/courses/components/check-row';
import { addCatalogCourses } from '@/features/courses/repo';
import { useProfile } from '@/stores/session';

type TrackFilter = Track | 'all';
const TRACK_FILTERS: TrackFilter[] = ['all', 'sayisal', 'esit', 'sozel', 'dil'];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/today');
}

/**
 * US-74: right after onboarding, offer the grade's suggested courses in one go. Every course
 * starts ticked; the student unticks the ones they don't take. Today opens this once
 * (setup.coursesOffered); afterwards courses are added from the Courses tab.
 */
export default function SetupScreen() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const grade = profile?.grade ?? null;
  const supported = grade != null && isGradeSupported(grade);
  const [track, setTrack] = useState<TrackFilter>(profile?.track ?? 'all');
  // Keys the student unticked; everything else on the list is selected.
  const [unticked, setUnticked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const suggestions = supported ? suggestedCourses(grade, track === 'all' ? null : track) : [];
  const selected = suggestions.filter((c) => !unticked.includes(c.key)).map((c) => c.key);
  const allSelected = suggestions.length > 0 && selected.length === suggestions.length;

  const toggle = (key: string) =>
    setUnticked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleAll = () => setUnticked(allSelected ? suggestions.map((c) => c.key) : []);

  const save = async () => {
    setSaving(true);
    try {
      await addCatalogCourses(selected);
      close();
    } catch {
      Alert.alert(t('common.genericError'));
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: '', presentation: 'modal' }} />
      <Page
        title={t('setup.title')}
        intro={supported ? t('setup.intro', { grade }) : t('setup.introNoGrade')}
        footer={
          <View style={styles.footer}>
            {supported ? (
              <Button
                label={t('setup.continue')}
                onPress={save}
                loading={saving}
                disabled={selected.length === 0}
                block
              />
            ) : null}
            <Button variant="plain" label={t('setup.skip')} onPress={close} disabled={saving} block />
          </View>
        }>
        {supported && gradeHasTracks(grade) ? (
          <Segmented
            label={t('catalog.trackLabel')}
            options={TRACK_FILTERS.map((value) => ({ value, label: t(`catalog.tracks.${value}`) }))}
            value={track}
            onChange={setTrack}
            wrap
          />
        ) : null}

        {suggestions.length > 0 ? (
          <Section
            title={t('catalog.listTitle')}
            footer={
              selected.length > 0
                ? t('setup.selectedCount', { count: selected.length })
                : t('setup.noneSelected')
            }
            action={
              <Button
                variant="plain"
                label={allSelected ? t('catalog.clearAll') : t('catalog.selectAll')}
                onPress={toggleAll}
              />
            }>
            {suggestions.map((item) => (
              <CheckRow
                key={item.key}
                title={item.name}
                checked={selected.includes(item.key)}
                onToggle={() => toggle(item.key)}
              />
            ))}
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

        <AppText variant="footnote" color="inkSoft">
          {t('setup.later')}
        </AppText>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: Space.xs,
  },
});
