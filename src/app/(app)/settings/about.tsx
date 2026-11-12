import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { HighlightMark } from '@/components/highlight-mark';
import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Space } from '@/constants/theme';
import { LEGAL_DOC_IDS, LEGAL_DOCUMENTS } from '@/features/legal/texts';
import { config, isLocalMode } from '@/services/config';
import { appVersion } from '@/lib/app-version';

/** Main open-source parts of the app and their licenses (checked against node_modules). */
const LICENSES: readonly { name: string; license: string }[] = [
  { name: 'React Native', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: 'Expo ve Expo Router', license: 'MIT' },
  { name: 'SQLite (expo-sqlite)', license: 'Kamu malı · MIT' },
  { name: 'Supabase JS', license: 'MIT' },
  { name: 'Reanimated, Gesture Handler, Screens', license: 'MIT' },
  { name: 'i18next ve react-i18next', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'ts-fsrs (aralıklı tekrar)', license: 'MIT' },
  { name: 'pdf-lib', license: 'MIT' },
  { name: 'RevenueCat (react-native-purchases)', license: 'MIT' },
  { name: 'Literata yazı tipi', license: 'SIL OFL 1.1' },
];

/** US-80: version, build, open-source licenses and the legal texts. */
export default function AboutScreen() {
  const { t } = useTranslation();
  const info = appVersion();
  const version = info.version ?? '—';
  const build = info.build ?? '—';

  return (
    <>
      <Stack.Screen options={{ title: t('settings.about.title') }} />
      <Page>
        <View style={styles.brand}>
          <HighlightMark active>
            <AppText variant="display" color="onHighlight" accessibilityRole="header">
              StudyMark
            </AppText>
          </HighlightMark>
          <AppText variant="callout" color="inkSoft">
            {t('settings.about.tagline')}
          </AppText>
        </View>

        <Section>
          <ListRow title={t('settings.about.version')} detail={version} />
          <ListRow title={t('settings.about.build')} detail={build} />
          <ListRow
            title={t('settings.about.data')}
            detail={isLocalMode ? t('settings.about.dataLocal') : t('settings.about.dataServer')}
          />
        </Section>

        <Section title={t('settings.about.legalTitle')}>
          {LEGAL_DOC_IDS.map((doc) => (
            <ListRow
              key={doc}
              title={LEGAL_DOCUMENTS[doc].title}
              onPress={() => router.push({ pathname: '/settings/legal/[doc]', params: { doc } })}
            />
          ))}
          <ListRow
            title={t('settings.about.contact')}
            subtitle={config.supportEmail}
            icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
            onPress={() => void Linking.openURL(`mailto:${config.supportEmail}`).catch(() => undefined)}
            chevron={false}
          />
        </Section>

        <Section title={t('settings.about.licensesTitle')} footer={t('settings.about.licensesFooter')}>
          {LICENSES.map((item) => (
            <ListRow key={item.name} title={item.name} detail={item.license} />
          ))}
        </Section>

        <AppText variant="footnote" color="inkSoft" style={styles.center}>
          {t('settings.version', { version, build })}
        </AppText>
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'flex-start',
    gap: Space.sm,
  },
  center: {
    textAlign: 'center',
  },
});
