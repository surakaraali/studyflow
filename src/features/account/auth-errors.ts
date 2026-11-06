import type { TFunction } from 'i18next';

import type { AuthError } from '@/services/auth';

/** Turns an auth error into a sentence that says what happened and what to do. */
export function authErrorMessage(t: TFunction, error: AuthError): string {
  switch (error) {
    case 'email_exists':
      return t('auth.errors.emailExists');
    case 'invalid_credentials':
      return t('auth.errors.invalidCredentials');
    case 'email_not_verified':
      return t('auth.errors.emailNotVerified');
    case 'invalid_email':
      return t('auth.errors.invalidEmail');
    case 'weak_password':
      return t('auth.errors.weakPassword');
    case 'same_password':
      return t('auth.errors.samePassword');
    case 'network':
      return t('auth.errors.network');
    default:
      return t('auth.errors.unknown');
  }
}
