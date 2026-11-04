import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Page } from '@/components/ui/page';
import { ConsentPanel } from '@/features/consent/components/consent-panel';

/** US-17: consent status for a student in the app (13–17 waiting, or after a decision). */
export default function ConsentScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('consent.screenTitle') }} />
      <Page>
        <ConsentPanel showAccessSummary />
      </Page>
    </>
  );
}
