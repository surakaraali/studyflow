import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

let current: { userId: string; db: SQLite.SQLiteDatabase } | null = null;

function fileName(userId: string) {
  return `user-${userId}.db`;
}

/**
 * Opens (and migrates) the signed-in user's database. Each user gets their own file,
 * so signing out and in with another account never mixes data.
 */
export async function openUserDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  if (current?.userId === userId) return current.db;
  await closeUserDb();

  const db = await SQLite.openDatabaseAsync(fileName(userId));
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
  await migrate(db);
  current = { userId, db };
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[i]);
    });
    await db.execAsync(`PRAGMA user_version = ${i + 1}`);
  }
}

export async function closeUserDb() {
  if (!current) return;
  const { db } = current;
  current = null;
  await db.closeAsync();
}

/** Deletes the user's database file (account deletion, BR-18). */
export async function deleteUserDb(userId: string) {
  if (current?.userId === userId) await closeUserDb();
  await SQLite.deleteDatabaseAsync(fileName(userId));
}

/** The signed-in user's database. Throws when nobody is signed in. */
export function getDb(): SQLite.SQLiteDatabase {
  if (!current) throw new Error('No user database is open');
  return current.db;
}

export function hasDb(): boolean {
  return current != null;
}

export function currentUserId(): string | null {
  return current?.userId ?? null;
}
