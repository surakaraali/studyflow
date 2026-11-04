/**
 * Account actions that touch more than one module: Apple sign-in (US-09), finishing
 * onboarding (US-11, US-15), the primary-school waitlist and account deletion (US-13).
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { deleteUserDb } from '@/db/client';
import { patch } from '@/db/write';
import { requestConsent } from '@/features/consent/service';
import { syncOfficialExams } from '@/features/exams/official';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { track } from '@/services/analytics';
import { auth, type AuthError, type SimpleResult } from '@/services/auth';
import { endSession, startSession, useSession } from '@/stores/session';

import { setAccountNotice, type AccountNotice } from './account-notice';
import { buildOnboardingProfile, type DraftError } from './onboarding-logic';
import { resetOnboarding, useOnboarding } from './onboarding-store';

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple, then start the session. The root layout sends a new account to
 * onboarding and a returning one to Today. We only ask for the email (never the name);
 * with "Hide my email" Apple gives a relay address, or no address on later sign-ins.
 */
export async function signInWithApple(): Promise<SimpleResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { ok: false, error: code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'unknown' };
  }
  if (!credential.identityToken) return { ok: false, error: 'unknown' };

  const result = await auth.signInWithApple(credential.identityToken, credential.user, credential.email);
  if (!result.ok) return result;
  await startSession(result.user);
  return { ok: true };
}

/** Signs in with email and password and starts the session. */
export async function signInWithEmail(email: string, password: string): Promise<SimpleResult> {
  const result = await auth.signIn(email, password);
  if (!result.ok) return result;
  await startSession(result.user);
  return { ok: true };
}

export type FinishResult = { ok: true } | { ok: false; error: DraftError | 'save' };

/**
 * Writes the onboarding answers to the profile. `onboarding_done` is set last: it flips the
 * root guard to the app (or to the locked screen for under-13s).
 */
export async function finishOnboarding(): Promise<FinishResult> {
  const { user, profile } = useSession.getState();
  if (!profile) return { ok: false, error: 'save' };
  const built = buildOnboardingProfile(useOnboarding.getState(), user?.email ?? profile.email);
  if (!built.ok) return built;

  try {
    await patch('profile', profile.id, built.profile);
    try {
      await syncOfficialExams(built.profile.target_exam, built.profile.track);
    } catch (error) {
      console.warn('Official exams could not be added', error);
    }
    if (built.profile.consent_status === 'pending' && built.profile.parent_email) {
      // A failed send isn't fatal: the waiting screens offer "send again".
      await requestConsent(built.profile.parent_email).catch(() => undefined);
    }
    await patch('profile', profile.id, { onboarding_done: 1 });
  } catch (error) {
    console.warn('Onboarding could not be saved', error);
    return { ok: false, error: 'save' };
  }

  schedulePlanRegeneration('onboarding');
  track('onboarding_completed', {
    segment: built.profile.segment,
    has_target_exam: built.profile.target_exam != null,
    needs_consent: built.profile.consent_status === 'pending',
  });
  resetOnboarding();
  return { ok: true };
}

/** Grades 1–4: R1 can't serve them yet; keep the parent's address to tell them later. */
export async function joinPrimaryWaitlist(parentEmail: string): Promise<void> {
  const profile = useSession.getState().profile;
  if (!profile) throw new Error('No profile');
  await patch('profile', profile.id, { waitlist_parent_email: parentEmail.trim().toLowerCase() });
}

export async function signOut(): Promise<void> {
  resetOnboarding();
  await endSession();
}

/** PDFs are stored under Documents/documents/<userId>/ by the documents feature. */
function deleteLocalDocuments(userId: string) {
  try {
    const dir = new Directory(Paths.document, 'documents', userId);
    if (dir.exists) dir.delete();
  } catch (error) {
    console.warn('Local documents could not be deleted', error);
  }
}

/**
 * US-13 / BR-18: deletes the account on the server (or device), the local PDFs and the
 * user's database, then signs out. `remote: false` skips the server call, for accounts the
 * server already removed (e.g. an under-13 account without consent after 30 days).
 */
export async function deleteAccountAndData(
  options: { remote?: boolean; notice?: AccountNotice } = {},
): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  const userId = useSession.getState().user?.id;
  if (!userId) return { ok: false, error: 'unknown' };

  if (options.remote !== false) {
    const result = await auth.deleteAccount();
    if (!result.ok) return result;
  }

  deleteLocalDocuments(userId);
  setAccountNotice(options.notice ?? 'deleted');
  resetOnboarding();
  try {
    // Runs the signed-out hooks (sync, notifications) and closes the database.
    await endSession();
  } catch (error) {
    console.warn('Sign-out after deletion failed', error);
  }
  try {
    await deleteUserDb(userId);
  } catch (error) {
    console.warn('Local database could not be deleted', error);
  }
  useSession.setState({ status: 'signedOut', user: null, profile: null });
  return { ok: true };
}
