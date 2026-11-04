import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { newId, nowIso } from '@/db/ids';
import type { AuthAdapter, AuthResult, AuthUser } from './types';

/**
 * Device-only accounts for local mode (no Supabase project yet).
 * Passwords are salted SHA-256 hashes; nothing leaves the device.
 * Email verification is simulated: the verify screen offers a "mark as verified" step.
 */

const SESSION_KEY = 'studyflow.local.session';

type Account = {
  id: string;
  email: string | null;
  password_hash: string | null;
  salt: string | null;
  apple_user: string | null;
  verified: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function accountsDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('local-accounts.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT,
          salt TEXT,
          apple_user TEXT UNIQUE,
          verified INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

async function hash(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

function toUser(account: Account): AuthUser {
  return { id: account.id, email: account.email };
}

async function startSession(account: Account): Promise<AuthResult> {
  await SecureStore.setItemAsync(SESSION_KEY, account.id);
  return { ok: true, user: toUser(account) };
}

/** Local mode only: what the link in the verification email would do. */
export async function markEmailVerifiedLocally(email: string) {
  const db = await accountsDb();
  await db.runAsync('UPDATE accounts SET verified = 1 WHERE email = ?', email.trim().toLowerCase());
}

export const localAuth: AuthAdapter = {
  async restore() {
    const id = await SecureStore.getItemAsync(SESSION_KEY);
    if (!id) return null;
    const db = await accountsDb();
    const account = await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
    return account ? toUser(account) : null;
  },

  async signUp(email, password) {
    const db = await accountsDb();
    const normalized = email.trim().toLowerCase();
    const existing = await db.getFirstAsync<Account>(
      'SELECT * FROM accounts WHERE email = ?',
      normalized,
    );
    if (existing) return { ok: false, error: 'email_exists' };
    const salt = newId();
    await db.runAsync(
      'INSERT INTO accounts (id, email, password_hash, salt, verified, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      newId(),
      normalized,
      await hash(password, salt),
      salt,
      nowIso(),
    );
    return { ok: true, needsVerification: true };
  },

  async signIn(email, password) {
    const db = await accountsDb();
    const account = await db.getFirstAsync<Account>(
      'SELECT * FROM accounts WHERE email = ?',
      email.trim().toLowerCase(),
    );
    if (!account?.salt || account.password_hash !== (await hash(password, account.salt))) {
      return { ok: false, error: 'invalid_credentials' };
    }
    if (!account.verified) return { ok: false, error: 'email_not_verified' };
    return startSession(account);
  },

  async signInWithApple(_identityToken, appleUser, email) {
    const db = await accountsDb();
    let account = await db.getFirstAsync<Account>(
      'SELECT * FROM accounts WHERE apple_user = ?',
      appleUser,
    );
    if (!account) {
      const id = newId();
      await db.runAsync(
        'INSERT INTO accounts (id, email, apple_user, verified, created_at) VALUES (?, ?, ?, 1, ?)',
        id,
        email?.toLowerCase() ?? null,
        appleUser,
        nowIso(),
      );
      account = await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
    }
    return account ? startSession(account) : { ok: false, error: 'unknown' };
  },

  async resendVerification() {
    return { ok: true };
  },

  async sendPasswordReset() {
    // Local accounts have no mailbox; the screen explains this in local mode.
    return { ok: true };
  },

  async signOut() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },

  async deleteAccount() {
    const id = await SecureStore.getItemAsync(SESSION_KEY);
    if (id) {
      const db = await accountsDb();
      await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return { ok: true };
  },
};
