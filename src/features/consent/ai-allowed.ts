import { useDbQuery } from '@/db/use-query';
import { canUseAi } from '@/domain/rules';
import { useProfile } from '@/stores/session';

import { latestDecisionDeniesAi } from './logic';
import { listConsentRecords } from './service';

export type AiBlockReason = 'consent' | 'purpose';

/**
 * Whether this student may use AI features. Access level covers age and consent (BR-03);
 * on top of that, a parent can approve the account but leave the AI purpose unticked (US-16).
 */
export function useAiAllowed(): { allowed: boolean; reason: AiBlockReason | null } {
  const { profile, access } = useProfile();
  const granted = profile?.consent_status === 'granted';
  const { data: denied } = useDbQuery(
    `consent-ai-${profile?.id ?? 'none'}-${granted ? 1 : 0}`,
    async () => (granted ? latestDecisionDeniesAi(await listConsentRecords()) : false),
    ['consent_records'],
  );

  if (!canUseAi(access)) return { allowed: false, reason: 'consent' };
  if (denied) return { allowed: false, reason: 'purpose' };
  return { allowed: true, reason: null };
}
