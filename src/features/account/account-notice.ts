import { create } from 'zustand';

/** A message for the welcome screen after the account went away (US-13, US-17). */
export type AccountNotice = 'deleted' | 'closed_no_consent';

export const useAccountNotice = create<{ notice: AccountNotice | null }>(() => ({ notice: null }));

export function setAccountNotice(notice: AccountNotice | null) {
  useAccountNotice.setState({ notice });
}
