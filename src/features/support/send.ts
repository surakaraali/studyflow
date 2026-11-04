import { newId } from '@/db/ids';
import { upsert } from '@/db/write';
import { isValidEmail } from '@/domain/rules';
import { supabase } from '@/services/supabase';

import { deviceInfo } from './device-info';

export const SUPPORT_TOPICS = ['account', 'subscription', 'ai', 'plan', 'bug', 'other'] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 2000;

export type SupportInput = {
  email: string;
  topic: SupportTopic | null;
  message: string;
};

export type SupportErrors = Partial<Record<'email' | 'topic' | 'message', true>>;

export function validateSupport(input: SupportInput): SupportErrors {
  const errors: SupportErrors = {};
  if (!isValidEmail(input.email)) errors.email = true;
  if (!input.topic) errors.topic = true;
  if (input.message.trim().length < SUPPORT_MESSAGE_MIN) errors.message = true;
  return errors;
}

/**
 * 'sent': the server got it · 'queued': saved, the feedback row syncs later ·
 * 'local': local mode, kept on this device only.
 */
export type SupportResult = 'sent' | 'queued' | 'local';

/**
 * Saves a support request as a `feedback` row (kind 'support') and, with a backend, hands it to
 * the `support` Edge Function right away. The only personal data is the reply email the student
 * typed (US-66). The function receives the row id, so it can ignore the synced copy of the row.
 */
export async function sendSupportMessage(input: SupportInput & { topic: SupportTopic }): Promise<SupportResult> {
  const id = newId();
  const payload = {
    email: input.email.trim(),
    topic: input.topic,
    message: input.message.trim().slice(0, SUPPORT_MESSAGE_MAX),
    ...deviceInfo(),
  };
  await upsert('feedback', { id, kind: 'support', payload: JSON.stringify(payload) });

  const client = supabase();
  if (!client) return 'local';
  try {
    const { error } = await client.functions.invoke('support', { body: { id, ...payload } });
    return error ? 'queued' : 'sent';
  } catch {
    return 'queued';
  }
}
