import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/ui/list-row';
import { Page } from '@/components/ui/page';
import { Section } from '@/components/ui/section';
import { LEGAL_DOC_IDS, LEGAL_DOCUMENTS, LEGAL_VERSION } from '@/features/legal/texts';

/** US-20: the legal texts, readable without leaving the app. */
export default function LegalIndexScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('legal.title') }} />
      <Page intro={t('legal.intro')}>
        <Section>
          {LEGAL_DOC_IDS.map((id) => (
            <ListRow
              key={id}
              title={LEGAL_DOCUMENTS[id].title}
              subtitle={LEGAL_DOCUMENTS[id].summary}
              detail={`v${LEGAL_VERSION}`}
              onPress={() => router.push({ pathname: '/settings/legal/[doc]', params: { doc: id } })}
            />
          ))}
        </Section>
      </Page>
    </>
  );
}
