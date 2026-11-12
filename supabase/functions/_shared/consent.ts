/**
 * Parent consent rules shared by consent-request, consent and consent-maintenance.
 * Numbers mirror src/domain/rules.ts (BR-04, US-17); keep them in step.
 */

import type { SupabaseClient } from './admin.ts';
import type { Purpose } from './email-templates.ts';

export const CONSENT_LINK_DAYS = 7;
export const CONSENT_DEADLINE_DAYS = 30;
export const CONSENT_RESENDS_PER_DAY = 3;
export const PURPOSES: readonly Purpose[] = ['ai', 'notifications'];

/**
 * Version of the aydınlatma/rıza text shown on the consent page (stored with every record).
 * Same value as LEGAL_VERSION in src/features/legal/texts.ts.
 */
export function consentTextVersion(): string {
  return Deno.env.get('CONSENT_TEXT_VERSION') ?? '1.0';
}

export function consentPageUrl(token: string): string {
  const base = Deno.env.get('CONSENT_WEB_URL') ?? 'https://studymark.app/veli-onayi/';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Türkiye has used UTC+3 all year since 2016. */
export function istanbulDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 3 * 60 * 60 * 1000);
}

/** Age from the birth year only, like ageFromBirthYear in the app. */
export function ageFromBirthYear(birthYear: number | null, now: Date = new Date()): number | null {
  if (!birthYear) return null;
  const year = new Date(now.getTime() + 3 * 60 * 60 * 1000).getUTCFullYear();
  return year - birthYear;
}

/** 32 random bytes, base64url. Only its SHA-256 is stored. */
export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function parsePurposes(value: unknown): Purpose[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((p) => typeof p === 'string' && (PURPOSES as readonly string[]).includes(p))) return null;
  return PURPOSES.filter((p) => value.includes(p));
}

export type ConsentTokenRow = {
  id: string;
  user_id: string;
  parent_email: string;
  source: 'student' | 'reminder';
  created_at: string;
  expires_at: string;
  used_at: string | null;
  superseded_at: string | null;
};

/**
 * Creates a link token for the parent. Older unused links to a different address stop working,
 * so only the latest parent the student named can decide.
 */
export async function issueConsentToken(
  admin: SupabaseClient,
  input: { userId: string; parentEmail: string; source: 'student' | 'reminder'; now?: Date },
): Promise<{ token: string; id: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const token = newToken();
  const expiresAt = addDays(now, CONSENT_LINK_DAYS);

  const { error: supersedeError } = await admin
    .from('consent_tokens')
    .update({ superseded_at: now.toISOString() })
    .eq('user_id', input.userId)
    .neq('parent_email', input.parentEmail)
    .is('used_at', null)
    .is('superseded_at', null);
  if (supersedeError) throw new Error(`supersede failed: ${supersedeError.message}`);

  const { data, error } = await admin
    .from('consent_tokens')
    .insert({
      user_id: input.userId,
      token_hash: await hashToken(token),
      parent_email: input.parentEmail,
      source: input.source,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`token insert failed: ${error?.message}`);
  return { token, id: data.id as string, expiresAt };
}
