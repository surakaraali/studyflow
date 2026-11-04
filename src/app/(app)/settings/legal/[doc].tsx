import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/ui/page';
import { LegalDocumentView } from '@/features/legal/components/legal-document-view';
import { isLegalDocId, LEGAL_DOCUMENTS } from '@/features/legal/texts';

/** US-20: one legal text with its version and date. */
export default function LegalDocScreen() {
  const { t } = useTranslation();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = isLegalDocId(doc) ? LEGAL_DOCUMENTS[doc] : null;

  return (
    <>
      <Stack.Screen options={{ title: document?.title ?? t('legal.title') }} />
      <Page>
        {document ? (
          <LegalDocumentView doc={document} />
        ) : (
          <EmptyState title={t('legal.notFound')} body={t('legal.intro')} />
        )}
      </Page>
    </>
  );
}
