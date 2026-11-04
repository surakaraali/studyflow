import type { Profile } from '@/db/types';
import type { AiBlockReason } from '@/features/consent/ai-allowed';
import type { QuotaStatus } from '@/features/quota/quota';

/** Why a student may or may not start an AI upload right now. */
export type AiGate =
  /**
   * BR-03 / BR-16: AI is off until a parent consents, after consent is withdrawn, or when the
   * parent approved the account without the AI purpose (US-16).
   */
  | { kind: 'consent'; reason: 'pending' | 'revoked' | 'purpose' }
  /** US-18: the AI notice has not been accepted yet. */
  | { kind: 'notice' }
  /** BR-14: this month's documents are used up. */
  | { kind: 'quota'; used: number; limit: number }
  | { kind: 'ok' };

/** `ai` is what useAiAllowed() returns (access level plus the parent's AI purpose). */
export function aiGate(
  profile: Pick<Profile, 'consent_status' | 'ai_notice_accepted_at'> | null,
  ai: { allowed: boolean; reason: AiBlockReason | null },
  quota: Pick<QuotaStatus, 'used' | 'limit' | 'full'> | undefined,
): AiGate {
  if (!ai.allowed) {
    if (ai.reason === 'purpose') return { kind: 'consent', reason: 'purpose' };
    return { kind: 'consent', reason: profile?.consent_status === 'revoked' ? 'revoked' : 'pending' };
  }
  if (!profile?.ai_notice_accepted_at) return { kind: 'notice' };
  if (quota?.full) return { kind: 'quota', used: quota.used, limit: quota.limit };
  return { kind: 'ok' };
}
