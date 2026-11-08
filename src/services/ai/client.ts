/**
 * Two AI backends behind one interface (US-32):
 * - local mode: POST the PDF to the development server (server/dev-ai.ts);
 * - Supabase mode: upload to Storage, start the process-document Edge Function, poll the
 *   document row every 5 s and pull the generated rows when it is ready.
 * The API key never ships in the app (PLAN §3 rule 1).
 */

import { File } from 'expo-file-system';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import type { Course, DocumentRow, Profile } from '@/db/types';
import { config, isLocalMode } from '@/services/config';
import { requireSupabase } from '@/services/supabase';

import { buildAiRequest } from './request';
import { findOrCreateDeck, importServerRows, logUsage, saveLocalResult, setJobState, type ServerRows } from './store';
import { asErrorCode, type AiErrorCode, type AiResult, type JobOutcome } from './types';

export type JobContext = {
  doc: DocumentRow;
  profile: Profile;
  course: Course | null;
  userId: string;
  signal: AbortSignal;
};

export interface AiBackend {
  run(job: JobContext): Promise<JobOutcome>;
}

/** Long documents can take minutes (PERF-05: 100 pages p95 ≤ 10 min). */
const LOCAL_TIMEOUT_MS = 15 * 60_000;
const POLL_MS = 5_000;
/** Stop polling after this; the runner comes back later and resumes. */
const POLL_LIMIT_MS = 20 * 60_000;
/** Same value as the Edge Function: a 'processing' row older than this was cut off. */
const STALE_PROCESSING_MS = 15 * 60_000;
/** Server codes that a retry from the app may fix. */
const RETRYABLE: readonly AiErrorCode[] = ['provider_unavailable', 'invalid_output', 'truncated', 'server_config', 'network', 'dev_server'];

const error = (code: AiErrorCode, retryable = RETRYABLE.includes(code)): JobOutcome => ({ kind: 'error', code, retryable });

function pdfFile(doc: DocumentRow): File | null {
  if (!doc.file_uri) return null;
  const file = new File(doc.file_uri);
  return file.exists ? file : null;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Local mode

const localBackend: AiBackend = {
  async run({ doc, profile, course, signal }) {
    // Release builds have no development server (see config.aiDevUrl).
    if (!config.aiDevUrl) return error('server_config', false);
    const file = pdfFile(doc);
    if (!file) return error('file_missing', false);

    const body = JSON.stringify(buildAiRequest(doc, profile, course, await file.base64()));
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), LOCAL_TIMEOUT_MS);
    const onAbort = () => timeout.abort();
    signal.addEventListener('abort', onAbort);

    let response: Response;
    try {
      response = await fetch(`${config.aiDevUrl}/v1/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: timeout.signal,
      });
    } catch {
      return error('dev_server');
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { code?: string; retryable?: boolean } } | null;
      const raw = payload?.error?.code;
      const code: AiErrorCode = raw === 'no_key' ? 'server_config' : raw === 'too_large' ? 'bad_request' : asErrorCode(raw);
      return error(code, payload?.error?.retryable ?? response.status >= 500);
    }

    const result = (await response.json()) as AiResult;
    if (result.flagged) {
      await logUsage(doc.id, result.usage ?? []);
      return { kind: 'flagged' };
    }
    await saveLocalResult(doc, course, result);
    return { kind: 'ready' };
  },
};

// ---------------------------------------------------------------------------------------------
// Supabase mode

type RemoteState = {
  status: DocumentRow['status'];
  error_code: string | null;
  next_attempt_at: string | null;
  updated_at: string;
};

async function readRemote(id: string): Promise<RemoteState | null> {
  const { data, error: err } = await requireSupabase()
    .from('documents')
    .select('status, error_code, next_attempt_at, updated_at')
    .eq('id', id)
    .maybeSingle<RemoteState>();
  if (err) throw err;
  return data;
}

/** Uploads the PDF and creates the server row (both idempotent). */
async function pushDocument(doc: DocumentRow, userId: string): Promise<JobOutcome | null> {
  const file = pdfFile(doc);
  if (!file) return error('file_missing', false);
  const sb = requireSupabase();
  const storagePath = `${userId}/${doc.id}.pdf`;

  const upload = await sb.storage
    .from('documents')
    // React Native's fetch sends an ArrayBuffer body as-is (the pattern Supabase documents for RN).
    .upload(storagePath, await file.arrayBuffer(), { contentType: 'application/pdf', upsert: true });
  if (upload.error) return error('network');

  // The local file path means nothing on the server.
  const { file_uri: _localPath, ...row } = doc;
  const { error: rowError } = await sb
    .from('documents')
    .upsert({ ...row, storage_path: storagePath, status: 'queued', error_code: null, next_attempt_at: null, user_id: userId });
  if (rowError) return error('network');
  await setJobState(doc.id, { storage_path: storagePath });
  return null;
}

/** Makes sure the course deck exists locally and on the server, so the function can use its id. */
async function ensureDeck(doc: DocumentRow, course: Course | null, userId: string): Promise<string> {
  const deckId = await findOrCreateDeck(course ?? { id: doc.course_id, name: doc.title });
  const sb = requireSupabase();
  const { data } = await sb.from('decks').select('id').eq('id', deckId).maybeSingle();
  if (!data) {
    const now = new Date().toISOString();
    await sb
      .from('decks')
      .upsert({ id: deckId, course_id: doc.course_id, name: course?.name ?? doc.title, created_at: now, updated_at: now, user_id: userId });
  }
  return deckId;
}

type InvokeAnswer = { status: 'ready' | 'processing' | 'queued' | 'error' } | { failure: JobOutcome };

async function invoke(documentId: string, deckId: string): Promise<InvokeAnswer> {
  const { data, error: err } = await requireSupabase().functions.invoke<{
    status?: 'ready' | 'processing' | 'queued' | 'error';
  }>('process-document', { body: { documentId, deckId } });
  if (!err) return { status: data?.status ?? 'processing' };

  if (err instanceof FunctionsHttpError) {
    const response = err.context as Response;
    const payload = (await response.json().catch(() => null)) as { error?: string; status?: string } | null;
    switch (response.status) {
      case 403:
        if (payload?.error === 'quota_exceeded') return { failure: error('quota_exceeded', false) };
        // Consent changed on the server; wait and check again later.
        return { failure: { kind: 'deferred', at: new Date(Date.now() + 5 * 60_000).toISOString() } };
      case 409:
        return { status: 'error' };
      case 422:
        return { failure: error('too_many_pages', false) };
      case 404:
        return { failure: error('file_missing', false) };
      default:
        return { failure: error(response.status >= 500 ? 'server_config' : 'network') };
    }
  }
  if (err instanceof FunctionsFetchError || err instanceof FunctionsRelayError) return { failure: error('network') };
  return { failure: error('unknown', true) };
}

async function pullResults(documentId: string): Promise<void> {
  const sb = requireSupabase();
  const byDoc = (table: string) => sb.from(table).select('*').eq('document_id', documentId).is('deleted_at', null);

  const [summaries, quizzes, cards] = await Promise.all([byDoc('summaries'), byDoc('quizzes'), byDoc('cards')]);
  for (const result of [summaries, quizzes, cards]) if (result.error) throw result.error;

  const quizIds = (quizzes.data ?? []).map((q: { id: string }) => q.id);
  const deckIds = [...new Set((cards.data ?? []).map((c: { deck_id: string }) => c.deck_id))];
  const [questions, decks, usage] = await Promise.all([
    quizIds.length ? sb.from('questions').select('*').in('quiz_id', quizIds).is('deleted_at', null) : null,
    deckIds.length ? sb.from('decks').select('*').in('id', deckIds) : null,
    // The team-side table may not be readable for students; usage is optional on the device.
    sb.from('ai_usage').select('*').eq('document_id', documentId),
  ]);
  if (questions?.error) throw questions.error;

  const rows: ServerRows = {
    summaries: summaries.data ?? [],
    quizzes: quizzes.data ?? [],
    questions: questions?.data ?? [],
    cards: cards.data ?? [],
    decks: decks?.data ?? [],
    ai_usage: usage.error ? [] : (usage.data ?? []),
  };
  await importServerRows(documentId, rows);
}

const supabaseBackend: AiBackend = {
  async run({ doc, course, userId, signal }) {
    let remote: RemoteState | null;
    try {
      remote = await readRemote(doc.id);
      if (!remote) {
        const failed = await pushDocument(doc, userId);
        if (failed) return failed;
        remote = await readRemote(doc.id);
      }
    } catch {
      return error('network');
    }
    if (!remote) return error('network');

    const finishFrom = async (state: RemoteState): Promise<JobOutcome | null> => {
      if (state.status === 'ready') {
        await pullResults(doc.id);
        return { kind: 'ready' };
      }
      if (state.status === 'error') {
        // The function already retried, refunded the quota and sent the push (US-62).
        if (state.error_code === 'inappropriate') return { kind: 'flagged' };
        return { kind: 'error', code: asErrorCode(state.error_code), retryable: false, serverNotified: true };
      }
      return null;
    };

    try {
      const done = await finishFrom(remote);
      if (done) return done;

      const deckId = await ensureDeck(doc, course, userId);
      const started = Date.now();
      let invokeNow = true;

      while (!signal.aborted && Date.now() - started < POLL_LIMIT_MS) {
        if (invokeNow) {
          invokeNow = false;
          const answer = await invoke(doc.id, deckId);
          if ('failure' in answer) return answer.failure;
        }

        await sleep(POLL_MS, signal);
        if (signal.aborted) break;
        const state = await readRemote(doc.id);
        if (!state) return error('network');

        const finished = await finishFrom(state);
        if (finished) return finished;

        if (state.status === 'queued') {
          const due = !state.next_attempt_at || Date.parse(state.next_attempt_at) <= Date.now();
          if (due) invokeNow = true;
          else if (Date.parse(state.next_attempt_at!) - Date.now() > 2 * 60_000) {
            // A long server-side backoff: free the queue and come back then.
            return { kind: 'deferred', at: state.next_attempt_at! };
          }
        } else if (state.status === 'processing' && Date.now() - Date.parse(state.updated_at) > STALE_PROCESSING_MS) {
          invokeNow = true;
        }
      }
      return error('network');
    } catch {
      return error('network');
    }
  },
};

export const aiBackend: AiBackend = isLocalMode ? localBackend : supabaseBackend;

/**
 * Supabase mode: a manual retry resets the server row too (the function refuses 'error' rows).
 * Returns false when the server could not be reached.
 */
export async function resetRemoteForRetry(doc: DocumentRow): Promise<boolean> {
  if (isLocalMode) return true;
  const { error: err } = await requireSupabase()
    .from('documents')
    .update({ status: 'queued', error_code: null, attempts: 0, next_attempt_at: null, counted: 1, quota_month: doc.quota_month })
    .eq('id', doc.id);
  return !err;
}

/** Supabase mode: removes the uploaded PDF from Storage (best effort; the row syncs as deleted). */
export async function removeRemoteFile(doc: DocumentRow): Promise<void> {
  if (isLocalMode || !doc.storage_path) return;
  await requireSupabase().storage.from('documents').remove([doc.storage_path]);
}
