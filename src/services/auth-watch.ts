/**
 * Notices when the server ends the session (US-77): signed out on another device, password
 * changed, refresh token revoked or expired. Supabase mode only.
 *
 * auth-js drops a session it can no longer refresh and emits SIGNED_OUT. Our own sign-out and
 * account deletion emit it too; those are told apart by the signed-out hook (endSession runs it
 * before auth.signOut) and by an account notice the deletion flow sets.
 *
 * Ending the session closes the user's database but keeps the file, so changes still waiting in
 * its outbox are sent after the next sign-in with the same account.
 */

import type { AuthChangeEvent } from '@supabase/supabase-js';

import { setAccountNotice, useAccountNotice } from '@/features/account/account-notice';
import { registerAppService } from '@/services/app-services';
import { backendMode } from '@/services/config';
import { supabase } from '@/services/supabase';
import { endSession, onSignedIn, onSignedOut, useSession } from '@/stores/session';

/** Lets an account deletion that is signing out set its own notice first. */
const SETTLE_MS = 250;

/** True from the start of a sign-out the app asked for until the next sign-in. */
let signingOut = false;
let expiring = false;

/**
 * Ends a session the server no longer accepts and sends the student to the welcome screen
 * with "Oturumun sona erdi, tekrar giriş yap". Safe to call more than once.
 */
export async function expireSession(): Promise<void> {
  if (expiring || signingOut || useSession.getState().status !== 'signedIn') return;
  expiring = true;
  try {
    setAccountNotice('session_expired');
    // Drop the dead tokens on this device only; there is no valid session to revoke.
    await supabase()
      ?.auth.signOut({ scope: 'local' })
      .catch(() => undefined);
    await endSession();
  } catch (error) {
    console.warn('Ending the expired session failed', error);
  } finally {
    expiring = false;
  }
}

async function onServerSignOut(statusAtEvent: string) {
  if (signingOut || useAccountNotice.getState().notice) return;
  if (statusAtEvent === 'signedIn') {
    await expireSession();
  } else if (statusAtEvent === 'loading') {
    // At app start: the saved session could not be refreshed, so restore finds nobody.
    setAccountNotice('session_expired');
  }
}

function onAuthEvent(event: AuthChangeEvent) {
  if (event !== 'SIGNED_OUT') return;
  const status = useSession.getState().status;
  // Never call auth methods inside this callback (auth-js holds its lock); leave it first.
  setTimeout(() => void onServerSignOut(status), SETTLE_MS);
}

registerAppService(() => {
  if (backendMode !== 'supabase') return;
  const client = supabase();
  if (!client) return;

  onSignedIn(() => {
    signingOut = false;
  });
  onSignedOut(() => {
    signingOut = true;
  });

  client.auth.onAuthStateChange(onAuthEvent);
});
