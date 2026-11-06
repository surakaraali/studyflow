import { create } from 'zustand';

/**
 * A message for the welcome screen after the account went away (US-13, US-17), after an
 * e-mail link for another account signed this one out (US-71), or after the server ended
 * the session (US-77, src/services/auth-watch.ts).
 */
export type AccountNotice = 'deleted' | 'closed_no_consent' | 'link_other_account' | 'session_expired';

export const useAccountNotice = create<{ notice: AccountNotice | null }>(() => ({ notice: null }));

export function setAccountNotice(notice: AccountNotice | null) {
  useAccountNotice.setState({ notice });
}
