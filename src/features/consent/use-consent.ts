import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDbQuery } from '@/db/use-query';
import { useProfile } from '@/stores/session';

import { grantedPurposes, isRequestExpired, latestDecisionDeniesAi, resendsLeft } from './logic';
import {
  changeParentEmail,
  listConsentRecords,
  listConsentRequests,
  resendConsent,
  type ConsentSendResult,
} from './service';

/** Everything the consent screens and banner show, kept live. */
export function useConsentState() {
  const { profile, access, age } = useProfile();
  const { data } = useDbQuery(
    `consent-state-${profile?.id ?? 'none'}`,
    async () => {
      const [requests, records] = await Promise.all([listConsentRequests(), listConsentRecords()]);
      return { requests, records };
    },
    ['consent_requests', 'consent_records'],
  );

  const requests = data?.requests ?? [];
  const records = data?.records ?? [];
  const latestRequest = requests.at(-1) ?? null;
  const lastGrant = records.filter((r) => r.action === 'granted').at(-1) ?? null;

  return {
    profile,
    access,
    age,
    loaded: data != null,
    latestRequest,
    linkExpired: latestRequest ? isRequestExpired(latestRequest) : false,
    resendsLeft: resendsLeft(requests.map((r) => r.created_at)),
    lastGrant,
    purposes: grantedPurposes(records),
    aiDenied: latestDecisionDeniesAi(records),
  };
}

export type ConsentFeedback = { tone: 'success' | 'warning'; text: string } | null;

/** Resend / change-address actions with a message for the result. */
export function useConsentActions() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'resend' | 'change' | null>(null);
  const [feedback, setFeedback] = useState<ConsentFeedback>(null);

  const report = (result: ConsentSendResult) => {
    if (result.ok) setFeedback({ tone: 'success', text: t('consent.resent') });
    else if (result.error === 'limit') setFeedback({ tone: 'warning', text: t('consent.resendLimit') });
    else setFeedback({ tone: 'warning', text: t('consent.sendFailed') });
    return result.ok;
  };

  const run = async (kind: 'resend' | 'change', action: () => Promise<ConsentSendResult>) => {
    setBusy(kind);
    setFeedback(null);
    try {
      return report(await action());
    } catch {
      return report({ ok: false, error: 'network' });
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    feedback,
    resend: () => run('resend', resendConsent),
    changeEmail: (email: string) => run('change', () => changeParentEmail(email)),
  };
}

/** Local mode: open the stand-in for the page the parent would open from the email. */
export function openParentPage(token: string) {
  router.push({ pathname: '/parent-consent', params: { token } });
}
