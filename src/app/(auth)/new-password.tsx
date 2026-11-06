import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/ui/page';
import { NewPasswordForm } from '@/features/account/components/new-password-form';
import { cancelPasswordReset, completePasswordReset } from '@/features/account/service';
import { auth } from '@/services/auth';
import { isLocalMode } from '@/services/config';

/**
 * US-71: "Yeni şifre belirle" after a reset link. The callback screen already turned the
 * link into a Supabase session; saving the password starts the app session and the root
 * layout opens Today (or onboarding). Opened without a link, it explains how to get one.
 */
export default function NewPasswordScreen() {
  const { t } = useTranslation();
  const [hasLinkSession, setHasLinkSession] = useState<boolean | null>(isLocalMode ? false : null);

  useEffect(() => {
    if (isLocalMode) return;
    let alive = true;
    auth
      .restore()
      .then((user) => alive && setHasLinkSession(user != null))
      .catch(() => alive && setHasLinkSession(false));
    return () => {
      alive = false;
    };
  }, []);

  const cancel = async () => {
    await cancelPasswordReset();
    router.replace('/welcome');
  };

  if (hasLinkSession === false) {
    return (
      <Page>
        <EmptyState
          title={t('auth.newPassword.noSessionTitle')}
          body={isLocalMode ? t('auth.reset.localStartOver') : t('auth.newPassword.noSessionBody')}
          actions={[
            isLocalMode
              ? { label: t('auth.reset.localSignUp'), onPress: () => router.replace('/sign-up') }
              : { label: t('auth.newPassword.requestLink'), onPress: () => router.replace('/reset-password') },
          ]}
        />
      </Page>
    );
  }

  return (
    <Page title={t('auth.newPassword.title')} intro={t('auth.newPassword.intro')}>
      {hasLinkSession ? (
        <NewPasswordForm
          onSubmit={completePasswordReset}
          secondary={{ label: t('auth.newPassword.cancel'), onPress: () => void cancel() }}
        />
      ) : null}
    </Page>
  );
}
