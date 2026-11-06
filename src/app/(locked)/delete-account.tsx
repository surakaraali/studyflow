import { useTranslation } from 'react-i18next';

import { Page } from '@/components/ui/page';
import { DeleteAccountForm } from '@/features/account/components/delete-account-form';

/** US-75: a student waiting for consent can delete the account instead of waiting 30 days. */
export default function LockedDeleteAccountScreen() {
  const { t } = useTranslation();

  return (
    <Page title={t('consent.locked.deleteTitle')} intro={t('consent.locked.deleteIntro')}>
      <DeleteAccountForm />
    </Page>
  );
}
