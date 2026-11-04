/**
 * Full account removal (BR-18), used by delete-account and consent-maintenance.
 *
 * 1. Storage objects under "<user id>/" are removed first and right away ("belgeler depodan
 *    hemen silinir").
 * 2. Deleting the auth user cascades to every user table (on delete cascade).
 *    The BEFORE DELETE trigger on auth.users (private.before_user_deleted) first copies consent
 *    records and subscriptions into private.retained_* tables without a foreign key. We chose
 *    copying over anonymising in place because a consent record is only useful as proof if it
 *    still says who consented and when; keeping it in a server-only table with a retention date
 *    keeps it out of every API and lets the account itself disappear completely.
 * Everything else is deleted immediately, which is stricter than the 30 days BR-18 allows.
 * Database backups roll off on the provider's schedule (see analysis/security_review.md).
 */

import type { SupabaseClient } from './admin.ts';

const BUCKET = 'documents';

async function listAll(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`storage list failed: ${error.message}`);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id == null) paths.push(...(await listAll(admin, path)));
      else paths.push(path);
    }
    if (!data || data.length < pageSize) break;
  }
  return paths;
}

export async function deleteUserFiles(admin: SupabaseClient, userId: string): Promise<number> {
  const paths = await listAll(admin, userId);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`storage remove failed: ${error.message}`);
  }
  return paths.length;
}

export async function deleteAccountCompletely(admin: SupabaseClient, userId: string): Promise<{ files: number }> {
  const files = await deleteUserFiles(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`auth delete failed: ${error.message}`);
  return { files };
}
