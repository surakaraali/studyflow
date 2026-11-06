import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Page } from '@/components/ui/page';
import { BirthYearCorrection } from '@/features/account/components/birth-year-correction';

/**
 * US-75: "Doğum yılım yanlış" from the locked screen. If the new age opens the app, the root
 * layout moves on by itself; otherwise the student stays here and sees the result.
 */
export default function LockedBirthYearScreen() {
  const { t } = useTranslation();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/waiting'));

  return (
    <Page title={t('consent.locked.birthYearTitle')}>
      <BirthYearCorrection onCancel={back} />
    </Page>
  );
}
