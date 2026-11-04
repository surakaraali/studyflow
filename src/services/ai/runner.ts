/**
 * AI job queue (US-32, US-62). Runs in the foreground while the app is open: one document at a
 * time, queued → processing → ready | error, with automatic retries and backoff. Resumes on
 * app start, on sign-in, when the app comes to the foreground and when the network returns.
 */

import * as Network from 'expo-network';
import type { Href } from 'expo-router';
import { AppState } from 'react-native';

import { currentUserId, getDb, hasDb } from '@/db/client';
import { subscribeTables } from '@/db/events';
import type { ConsentRecord, DocumentRow } from '@/db/types';
import { canUseAi } from '@/domain/rules';
import { latestDecisionDeniesAi } from '@/features/consent/logic';
import { getCourse } from '@/features/courses/repo';
import { cleanupDeletedDocuments } from '@/features/documents/cleanup';
import i18n from '@/i18n';
import { track } from '@/services/analytics';
import { registerAppService } from '@/services/app-services';
import { isLocalMode } from '@/services/config';
import { notifyNow } from '@/services/notifications';
import { onSignedIn, onSignedOut, profileAccess, useSession } from '@/stores/session';

import { aiBackend } from './client';
import { decideRetry, isExpired } from './retry';
import { setJobState } from './store';
import type { AiErrorCode, JobOutcome } from './types';

type FailReason = 'no_text' | 'timeout' | 'ai_error' | 'network' | 'too_many_pages' | 'unknown';

/** Analytics reason for a failed job (fixed list, never free text). */
function failReason(code: AiErrorCode): FailReason {
  switch (code) {
    case 'empty':
      return 'no_text';
    case 'expired':
      return 'timeout';
    case 'network':
    case 'dev_server':
      return 'network';
    case 'too_many_pages':
      return 'too_many_pages';
    case 'provider_unavailable':
    case 'invalid_output':
    case 'truncated':
    case 'refused':
    case 'bad_request':
    case 'server_config':
    case 'inappropriate':
      return 'ai_error';
    default:
      return 'unknown';
  }
}

const OFFLINE_RECHECK_MS = 60_000;

let active = false;
let running = false;
let again = false;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let wakeAt = 0;
let current: AbortController | null = null;

function aiAllowed(): boolean {
  const { status, profile } = useSession.getState();
  return (
    status === 'signedIn' &&
    hasDb() &&
    profile != null &&
    profile.ai_notice_accepted_at != null &&
    canUseAi(profileAccess(profile))
  );
}

/** US-16: a parent can approve the account but leave the AI purpose unticked. */
async function aiPurposeGranted(): Promise<boolean> {
  if (useSession.getState().profile?.consent_status !== 'granted') return true;
  const records = await getDb().getAllAsync<Pick<ConsentRecord, 'action' | 'purposes' | 'created_at'>>(
    'SELECT action, purposes, created_at FROM consent_records',
  );
  return !latestDecisionDeniesAi(records);
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    // The development server may be on the local network without internet access.
    return isLocalMode || state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

async function nextDueDocument(now: Date): Promise<DocumentRow | null> {
  return getDb().getFirstAsync<DocumentRow>(
    `SELECT d.* FROM documents d LEFT JOIN courses c ON c.id = d.course_id
     WHERE d.deleted_at IS NULL AND c.deleted_at IS NULL AND d.status IN ('queued', 'processing')
       AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?)
     ORDER BY d.created_at LIMIT 1`,
    now.toISOString(),
  );
}

/** Wakes the runner later; an earlier wake-up already planned wins. */
function scheduleWake(ms: number) {
  const at = Date.now() + Math.max(1_000, ms);
  if (wakeTimer && wakeAt > Date.now() && wakeAt <= at) return;
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeAt = at;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    kickAiRunner();
  }, at - Date.now());
}

async function scheduleNextRetry() {
  if (!hasDb()) return;
  const row = await getDb().getFirstAsync<{ at: string | null }>(
    `SELECT MIN(next_attempt_at) AS at FROM documents
     WHERE deleted_at IS NULL AND status = 'queued' AND next_attempt_at IS NOT NULL`,
  );
  if (row?.at) scheduleWake(Date.parse(row.at) - Date.now());
}

/**
 * US-62. In Supabase mode the Edge Function sends a push for jobs it finishes (ready, flagged,
 * failed), so the app only notifies for failures it detected itself.
 */
function notifyDone(doc: DocumentRow, ok: boolean, serverNotified = !isLocalMode) {
  if (serverNotified) return;
  const url = `/document/${doc.id}` as Href;
  const payload = ok
    ? { title: i18n.t('documents.notifyReadyTitle'), body: i18n.t('documents.notifyReadyBody', { title: doc.title }) }
    : { title: i18n.t('documents.notifyFailedTitle'), body: i18n.t('documents.notifyFailedBody', { title: doc.title }) };
  notifyNow({ kind: 'ai', url, ...payload }).catch(() => {});
}

/** Permanent failure: the document no longer counts toward this month's quota (BR-14). */
async function failJob(doc: DocumentRow, code: AiErrorCode, serverNotified = false) {
  await setJobState(doc.id, { status: 'error', error_code: code, next_attempt_at: null, counted: 0 });
  track('document_failed', { reason: failReason(code) });
  notifyDone(doc, false, serverNotified);
}

/** Runs one document. Returns false when it could not start, so the loop stops. */
async function processOne(doc: DocumentRow): Promise<boolean> {
  const now = new Date();
  if (isExpired(doc.created_at, now)) {
    await failJob(doc, 'expired');
    return true;
  }

  const { profile } = useSession.getState();
  const userId = currentUserId();
  if (!profile || !userId) return false;

  const attempts = doc.attempts + 1;
  await setJobState(doc.id, { status: 'processing', attempts, next_attempt_at: null });
  const course = await getCourse(doc.course_id);

  current = new AbortController();
  const started = Date.now();
  let outcome: JobOutcome;
  try {
    outcome = await aiBackend.run({ doc: { ...doc, attempts }, profile, course, userId, signal: current.signal });
  } catch {
    outcome = { kind: 'error', code: 'unknown', retryable: true };
  } finally {
    current = null;
  }
  // Signed out (and the database closed) while the job was running.
  if (!active || currentUserId() !== userId) return false;

  switch (outcome.kind) {
    case 'ready':
      await setJobState(doc.id, { status: 'ready', error_code: null, next_attempt_at: null });
      track('document_ready', {
        pages: doc.page_to - doc.page_from + 1,
        duration_sec: Math.round((Date.now() - started) / 1000),
      });
      notifyDone(doc, true);
      return true;
    case 'flagged':
      await failJob(doc, 'inappropriate', !isLocalMode);
      return true;
    case 'deferred':
      // Not a failed try: give the attempt back.
      await setJobState(doc.id, { status: 'queued', attempts: doc.attempts, next_attempt_at: outcome.at });
      return true;
    case 'error': {
      const decision = decideRetry({ attempts, retryable: outcome.retryable, createdAt: doc.created_at });
      if (decision.action === 'retry') {
        await setJobState(doc.id, {
          status: 'queued',
          error_code: outcome.code,
          next_attempt_at: decision.at.toISOString(),
        });
      } else {
        await failJob(doc, outcome.code, outcome.serverNotified === true);
      }
      return true;
    }
  }
}

async function loop() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    if (active && hasDb()) await cleanupDeletedDocuments();
    do {
      again = false;
      while (active && aiAllowed() && (await aiPurposeGranted())) {
        if (!(await isOnline())) {
          scheduleWake(OFFLINE_RECHECK_MS);
          break;
        }
        const doc = await nextDueDocument(new Date());
        if (!doc || !(await processOne(doc))) break;
      }
    } while (again && active);
    if (active) await scheduleNextRetry();
  } catch (error) {
    console.warn('AI runner stopped', error);
    if (active) scheduleWake(OFFLINE_RECHECK_MS);
  } finally {
    running = false;
  }
}

/** Looks for work now (after an upload, a retry or a consent change). */
export function kickAiRunner() {
  if (!active) return;
  loop();
}

/** True while a document is being processed on this device. */
export function isAiRunnerBusy(): boolean {
  return running;
}

function start() {
  active = true;
  kickAiRunner();
}

function stop() {
  active = false;
  current?.abort();
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
  wakeAt = 0;
}

registerAppService(() => {
  onSignedIn(() => {
    start();
  });
  onSignedOut(() => {
    stop();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') kickAiRunner();
  });
  Network.addNetworkStateListener((state) => {
    if (state.isConnected) kickAiRunner();
  });
  // A parent's decision arrived (consent records sync in), or consent / the AI notice changed.
  subscribeTables(['consent_records'], kickAiRunner);
  let lastAllowed = false;
  useSession.subscribe(() => {
    const allowed = aiAllowed();
    if (allowed && !lastAllowed) kickAiRunner();
    lastAllowed = allowed;
  });
  // A session restored before this service registered.
  if (useSession.getState().status === 'signedIn') start();
});
