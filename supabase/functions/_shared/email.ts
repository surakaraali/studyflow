/**
 * Transactional e-mail behind a tiny provider interface (ADR-004). Q-06 is still open, so the
 * functions only call sendEmail(); switching provider means adding one adapter here.
 *
 * Env:
 *   EMAIL_PROVIDER   'resend' (default) | 'console' (logs instead of sending; local dev)
 *   RESEND_API_KEY   Resend API key (server secret)
 *   EMAIL_FROM       e.g. 'StudyFlow <no-reply@studyflow.app>' (domain verified at the provider)
 *   EMAIL_REPLY_TO   optional, e.g. 'destek@studyflow.app'
 */

import { maskEmail } from './http.ts';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Short label for the provider's dashboard, e.g. 'consent_request'. No personal data. */
  tag?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

export class EmailError extends Error {}

const resendProvider: EmailProvider = {
  async send(message) {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('EMAIL_FROM');
    if (!apiKey || !from) throw new EmailError('RESEND_API_KEY or EMAIL_FROM is missing');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo ?? Deno.env.get('EMAIL_REPLY_TO') ?? undefined,
        tags: message.tag ? [{ name: 'type', value: message.tag }] : undefined,
      }),
    });
    if (!response.ok) {
      // The body may echo the recipient; log the status only.
      throw new EmailError(`Resend responded ${response.status}`);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { id: body.id ?? null };
  },
};

const consoleProvider: EmailProvider = {
  send(message) {
    console.log(`[email:console] ${message.tag ?? 'email'} → ${maskEmail(message.to)} · ${message.subject}`);
    return Promise.resolve({ id: null });
  },
};

export function emailProvider(): EmailProvider {
  const name = (Deno.env.get('EMAIL_PROVIDER') ?? 'resend').toLowerCase();
  if (name === 'console') return consoleProvider;
  return resendProvider;
}

export async function sendEmail(message: EmailMessage): Promise<{ id: string | null }> {
  return emailProvider().send(message);
}
