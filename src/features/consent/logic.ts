/**
 * Consent timing rules (BR-04, US-17). Pure functions, unit tested.
 */

import type { ConsentPurpose, ConsentRecord, ConsentRequest } from '@/db/types';
import {
  CONSENT_DEADLINE_DAYS,
  CONSENT_LINK_DAYS,
  CONSENT_RESENDS_PER_DAY,
} from '@/domain/rules';
import { formatDate } from '@/lib/dates';

const DAY_MS = 24 * 60 * 60 * 1000;

export function linkExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + CONSENT_LINK_DAYS * DAY_MS);
}

/** A link is valid for 7 days (BR-04). */
export function isRequestExpired(request: Pick<ConsentRequest, 'expires_at'>, now: Date = new Date()): boolean {
  return new Date(request.expires_at).getTime() <= now.getTime();
}

/**
 * "Send the link again" works 3 times a day (US-17). The very first link (sent at the end of
 * onboarding) is not a resend, so it doesn't count. `createdAt` are ISO timestamps of every
 * request ever made for this account; "today" is the student's local day.
 */
export function resendsLeft(createdAt: readonly string[], now: Date = new Date()): number {
  if (createdAt.length === 0) return CONSENT_RESENDS_PER_DAY;
  const sorted = [...createdAt].sort();
  const today = formatDate(now);
  const usedToday = sorted.slice(1).filter((iso) => formatDate(new Date(iso)) === today).length;
  return Math.max(0, CONSENT_RESENDS_PER_DAY - usedToday);
}

/** BR-04: an under-13 account without consent is deleted 30 days after it was created. */
export function consentDeadline(accountCreatedAt: string): Date {
  return new Date(new Date(accountCreatedAt).getTime() + CONSENT_DEADLINE_DAYS * DAY_MS);
}

export function consentDeadlinePassed(accountCreatedAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= consentDeadline(accountCreatedAt).getTime();
}

/** Whole days left before the deadline, at least 0. */
export function daysUntilConsentDeadline(accountCreatedAt: string, now: Date = new Date()): number {
  const ms = consentDeadline(accountCreatedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

const PURPOSES: readonly ConsentPurpose[] = ['ai', 'notifications'];

export function parsePurposes(json: string | null | undefined): ConsentPurpose[] {
  try {
    const value: unknown = JSON.parse(json ?? '[]');
    return Array.isArray(value) ? PURPOSES.filter((p) => value.includes(p)) : [];
  } catch {
    return [];
  }
}

type DecisionRow = Pick<ConsentRecord, 'action' | 'purposes' | 'created_at'>;

/** The parent's latest grant or revoke; 'requested' rows are ignored. `records` may be in any order. */
function latestDecision(records: readonly DecisionRow[]): DecisionRow | undefined {
  return records
    .filter((r) => r.action === 'granted' || r.action === 'revoked')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .at(-1);
}

/** Purposes that are on after the parent's latest decision. */
export function grantedPurposes(records: readonly DecisionRow[]): ConsentPurpose[] {
  const last = latestDecision(records);
  return last?.action === 'granted' ? parsePurposes(last.purposes) : [];
}

/**
 * True only when the latest decision on this device is a grant without the AI purpose.
 * No decision on the device (e.g. the server recorded it) means "trust the status".
 */
export function latestDecisionDeniesAi(records: readonly DecisionRow[]): boolean {
  const last = latestDecision(records);
  return last?.action === 'granted' && !parsePurposes(last.purposes).includes('ai');
}
