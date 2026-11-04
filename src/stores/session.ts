import type { Href } from 'expo-router';
import { create } from 'zustand';

import { closeUserDb, getDb, openUserDb } from '@/db/client';
import { notifyAll, subscribeTables } from '@/db/events';
import { nowIso } from '@/db/ids';
import type { Profile } from '@/db/types';
import { accessLevel, ageFromBirthYear, type AccessLevel } from '@/domain/rules';
import { auth, type AuthUser } from '@/services/auth';

type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  user: AuthUser | null;
  profile: Profile | null;
};

export const useSession = create<SessionState>(() => ({
  status: 'loading',
  user: null,
  profile: null,
}));

let unsubscribeProfile: (() => void) | null = null;
const signedInHooks = new Set<(user: AuthUser) => void | Promise<void>>();
const signedOutHooks = new Set<() => void | Promise<void>>();

/** Runs after every sign-in (sync, notifications, purchases register here). */
export function onSignedIn(hook: (user: AuthUser) => void | Promise<void>) {
  signedInHooks.add(hook);
  return () => signedInHooks.delete(hook);
}

export function onSignedOut(hook: () => void | Promise<void>) {
  signedOutHooks.add(hook);
  return () => signedOutHooks.delete(hook);
}

export async function loadProfile(): Promise<Profile | null> {
  return getDb().getFirstAsync<Profile>('SELECT * FROM profile LIMIT 1');
}

async function ensureProfile(user: AuthUser) {
  const db = getDb();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM profile WHERE id = ?', user.id);
  if (!existing) {
    const now = nowIso();
    await db.runAsync(
      'INSERT INTO profile (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
      user.id,
      user.email,
      now,
      now,
    );
  }
}

/** Opens the user's database, makes sure a profile row exists and marks the session signed in. */
export async function startSession(user: AuthUser) {
  await openUserDb(user.id);
  await ensureProfile(user);
  const profile = await loadProfile();

  unsubscribeProfile?.();
  unsubscribeProfile = subscribeTables(['profile'], async () => {
    const next = await loadProfile();
    useSession.setState({ profile: next });
  });

  useSession.setState({ status: 'signedIn', user, profile });
  notifyAll();
  for (const hook of signedInHooks) await hook(user);
}

/** Restores the last session at app start. */
export async function bootstrapSession() {
  try {
    const user = await auth.restore();
    if (user) {
      await startSession(user);
      return;
    }
  } catch (error) {
    console.warn('Session restore failed', error);
  }
  useSession.setState({ status: 'signedOut', user: null, profile: null });
}

export async function endSession() {
  for (const hook of signedOutHooks) await hook();
  unsubscribeProfile?.();
  unsubscribeProfile = null;
  await auth.signOut();
  await closeUserDb();
  useSession.setState({ status: 'signedOut', user: null, profile: null });
}

/** Age-based access (BR-02, BR-03). Before onboarding there is no birth year yet. */
export function profileAccess(profile: Profile | null, now: Date = new Date()): AccessLevel {
  if (!profile?.birth_year) return 'full';
  return accessLevel(ageFromBirthYear(profile.birth_year, now), profile.consent_status);
}

export function profileAge(profile: Profile | null, now: Date = new Date()): number | null {
  return profile?.birth_year ? ageFromBirthYear(profile.birth_year, now) : null;
}

/** Hook: the current profile and access level. Only use under the signed-in part of the app. */
export function useProfile() {
  const profile = useSession((s) => s.profile);
  return { profile, access: profileAccess(profile), age: profileAge(profile) };
}

/** The first screen for the current state: welcome, onboarding, the consent wait or Today. */
export function homeHref(status: SessionStatus, profile: Profile | null): Href {
  if (status !== 'signedIn') return '/welcome';
  if (profile?.onboarding_done !== 1) return '/onboarding';
  if (profileAccess(profile) === 'locked') return '/waiting';
  return '/today';
}
