import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { validateParentEmail } from '@/features/account/onboarding-logic';
import { joinPrimaryWaitlist, signOut } from '@/features/account/service';
import { useSession } from '@/stores/session';

/** US-11: grades 1–4 aren't supported in R1. Collect the parent's email for a notify list. */
export default function PrimaryScreen() {
  const { t } = useTranslation();
  const saved = useSession((s) => s.profile?.waitlist_parent_email ?? null);
  const [email, setEmail] = useState('');
  const [showError, setShowError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The parent's own address is fine here (often the account is the parent's too).
  const validation = validateParentEmail(email, null);
  const error =
    showError && validation
      ? validation === 'required'
        ? t('onboarding.parent.required')
        : t('onboarding.parent.invalid')
      : null;

  const submit = async () => {
    setShowError(true);
    setFailed(false);
    if (validation) return;
    setBusy(true);
    try {
      await joinPrimaryWaitlist(email);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={t('onboarding.primary.title')}
      intro={t('onboarding.primary.body')}
      footer={
        <>
          {saved ? (
            <Button label={t('onboarding.primary.signOut')} onPress={() => void signOut()} block />
          ) : (
            <Button label={t('onboarding.primary.submit')} onPress={submit} loading={busy} block />
          )}
          <Button
            label={t('onboarding.primary.changeGrade')}
            variant="plain"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
            block
          />
        </>
      }>
      {saved ? (
        <Banner tone="success" message={t('onboarding.primary.saved')} />
      ) : (
        <>
          <TextField
            label={t('onboarding.primary.label')}
            placeholder={t('onboarding.parent.placeholder')}
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          {failed ? <Banner tone="warning" message={t('onboarding.saveError')} /> : null}
          <Button label={t('onboarding.primary.signOut')} variant="plain" onPress={() => void signOut()} />
        </>
      )}
    </Page>
  );
}

