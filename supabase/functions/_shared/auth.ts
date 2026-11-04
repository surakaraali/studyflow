/**
 * Who is calling: verifies the user's access token (the `Authorization: Bearer <jwt>` header that
 * supabase-js `functions.invoke` sends) against Supabase Auth.
 */

import type { User } from 'npm:@supabase/supabase-js@2.118.0';

import { adminClient } from './admin.ts';
import { HttpError, safeEqual } from './http.ts';

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/** The signed-in user, or a 401 error. */
export async function requireUser(req: Request): Promise<User> {
  const user = await optionalUser(req);
  if (!user) throw new HttpError(401, 'unauthorized');
  return user;
}

/** The signed-in user, or null for anonymous calls (anon key or no header). */
export async function optionalUser(req: Request): Promise<User | null> {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** For server-to-server calls (pg_cron, webhooks): the header must carry the shared secret. */
export function requireSecret(req: Request, secret: string | undefined) {
  if (!secret) throw new HttpError(500, 'not_configured');
  // Accept "Bearer <secret>" and the bare secret (RevenueCat sends the header value as typed).
  const header = req.headers.get('authorization') ?? '';
  const token = bearer(req) ?? header;
  if (!safeEqual(token, secret) && !safeEqual(header, secret)) throw new HttpError(401, 'unauthorized');
}
