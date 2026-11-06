import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { authErrorMessage } from '@/features/account/auth-errors';
import { validateNewEmail, type NewEmailError } from '@/features/account/credentials';
import { changeEmail } from '@/features/account/service';
import { useSignInMethods } from '@/features/account/use-sign-in-methods';
import type { AuthError } from '@/services/auth';
import { isLocalMode } from '@/services/config';
import { useSession } from '@/stores/session';

/**
 * US-72: a new e-mail address. With Supabase the old address stays valid until the link in
 * the new one is opened (it lands on /auth/callback); local mode changes it at once.
 */
export default function EmailScreen() {
  const { t } = useTranslation();
  const methods = useSignInMethods();
  const current = useSession((s) => s.user?.email ?? s.profile?.email ?? null);
  const parentEmail = useSession((s) => s.profile?.parent_email ?? null);
  const [email, setEmail] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [result, setResult] = useState<{ email: string; pending: boolean } | null>(null);

  const validation = validateNewEmail(email, current, parentEmail);
  const messages: Record<NewEmailError, string> = {
    invalid: t('auth.errors.invalidEmail'),
    same: t('account.email.same'),
    parent: t('account.email.parent'),
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings/account'));

  const submit = async () => {
    setShowErrors(true);
    setError(null);
    if (validation) return;
    setBusy(true);
    try {
      const normalized = email.trim().toLowerCase();
      const response = await changeEmail(normalized);
      if (response.ok) setResult({ email: normalized, pending: response.needsVerification });
      else setError(response.error);
    } catch {
      setError('unknown');
    } finally {
      setBusy(false);
    }
  };

  const header = <Stack.Screen options={{ title: t('account.email.title') }} />;

  if (methods && !methods.password) {
    return (
      <>
        {header}
        <Page>
          <Banner tone="info" message={t('account.email.appleOnly')} />
        </Page>
      </>
    );
  }

  if (result) {
    return (
      <>
        {header}
        <Page footer={<Button label={t('common.done')} onPress={close} block />}>
          {result.pending ? (
            <Banner
              tone="success"
              title={t('account.email.sentTitle')}
              message={t('account.email.sent', { email: result.email })}
            />
          ) : (
            <Banner tone="success" message={t('account.email.changed', { email: result.email })} />
          )}
        </Page>
      </>
    );
  }

  return (
    <>
      {header}
      <Page
        intro={t('account.email.intro')}
        footer={<Button label={t('account.email.submit')} onPress={submit} loading={busy} block />}>
        {current ? (
          <AppText variant="callout" color="inkSoft">
            {t('account.email.current', { email: current })}
          </AppText>
        ) : null}
        {isLocalMode ? <Banner tone="info" message={t('account.email.localNote')} /> : null}
        <TextField
          label={t('account.email.label')}
          placeholder={t('auth.fields.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={showErrors && validation ? messages[validation] : null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        {error ? (
          <Banner
            tone="warning"
            message={error === 'email_exists' ? t('account.email.taken') : authErrorMessage(t, error)}
          />
        ) : null}
      </Page>
    </>
  );
}
