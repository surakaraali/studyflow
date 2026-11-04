/**
 * Server → student messages. Every message is stored in user_notifications; the Expo push is
 * best effort and respects the quiet hours (BR-16), like the app's local notifications.
 */

import type { SupabaseClient } from './admin.ts';

export type StudentMessage = {
  kind: 'consent' | 'plan' | 'exam' | 'homework' | 'ai';
  title: string;
  body: string;
  /** App route to open, e.g. '/consent'. */
  url?: string;
};

/** BR-16: under 13 no pushes 20:30–08:00, otherwise 23:00–07:30 (Türkiye time, UTC+3). */
export function isQuietTime(now: Date, age: number | null): boolean {
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [from, to] = age != null && age < 13 ? [20 * 60 + 30, 8 * 60] : [23 * 60, 7 * 60 + 30];
  return minutes >= from || minutes < to;
}

export async function notifyStudent(
  admin: SupabaseClient,
  userId: string,
  message: StudentMessage,
  options: { age: number | null; now?: Date } = { age: null },
): Promise<void> {
  const { error } = await admin.from('user_notifications').insert({
    user_id: userId,
    kind: message.kind,
    title: message.title,
    body: message.body,
    url: message.url ?? null,
  });
  if (error) console.error('notification insert failed', error.message);

  if (isQuietTime(options.now ?? new Date(), options.age)) return;

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  const to = (tokens ?? []).map((row) => row.token as string).filter((t) => t.startsWith('ExponentPushToken'));
  if (to.length === 0) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(
        to.map((token) => ({
          to: token,
          title: message.title,
          body: message.body,
          data: { kind: message.kind, url: message.url },
          sound: null,
        })),
      ),
    });
    if (!response.ok) console.error('expo push failed', response.status);
  } catch (error) {
    console.error('expo push failed', error instanceof Error ? error.message : String(error));
  }
}
