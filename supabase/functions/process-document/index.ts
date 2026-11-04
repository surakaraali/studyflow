/**
 * process-document (US-32): turns an uploaded PDF into a summary, a quiz and flashcards.
 *
 * POST { documentId, deckId? } with the student's JWT (supabase.functions.invoke does this).
 * Imports resolve through supabase/functions/deno.json.
 * Answers 202 at once and does the work in EdgeRuntime.waitUntil; the app polls the documents
 * row and pulls the generated rows when the status is 'ready'.
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   provided by Supabase
 *   ANTHROPIC_API_KEY        required (supabase secrets set ANTHROPIC_API_KEY=...)
 *   AI_MODEL                 optional, default claude-opus-5-5
 *   AI_MONTHLY_BUDGET_USD    optional, default 250 (AIQ-07 warning at 80%)
 *
 * Tables: supabase/migrations (mirror of src/db/schema.ts with user_id; flags are 0/1 smallints,
 * summaries.content and questions.options are jsonb). Only the service role writes job state and generated rows. The PDF is read from
 * Storage bucket `documents` at <userId>/<documentId>.pdf. Request bodies and document text are
 * never logged (PRIV-02).
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

import { adminClient, type SupabaseClient } from '../_shared/admin.ts';
import { budgetStatus, DEFAULT_MODEL, MONTHLY_AI_BUDGET_USD } from '../_shared/ai/pricing.ts';
import { processDocument } from '../_shared/ai/process.ts';
import { AiError, type ProcessInput, type ProcessResult, type Segment, type UsageEntry } from '../_shared/ai/types.ts';
import { notifyStudent } from '../_shared/push.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const AI_MODEL = Deno.env.get('AI_MODEL') || DEFAULT_MODEL;
const MONTHLY_BUDGET = Number(Deno.env.get('AI_MONTHLY_BUDGET_USD')) || MONTHLY_AI_BUDGET_USD;

const QUIZ_COUNT = 10;
const CARD_COUNT = 15;
const MAX_BYTES = 25 * 1024 * 1024;
/** One try plus three automatic retries (REL-03). */
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [5_000, 20_000, 60_000];
/** Retries that would end after this hand over to the app, which re-invokes when due. */
const TIME_BUDGET_MS = 280_000;
/** A 'processing' row older than this was cut off (e.g. wall-clock limit) and may be resumed. */
const STALE_MS = 15 * 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// BR-12, mirrored from src/domain/rules.ts. Quota limits come from public.document_quota().
const OPTION_COUNT: Record<Segment, number> = { ilkokul: 3, ortaokul: 4, lise: 5 };

type DocumentRow = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  page_from: number;
  page_to: number;
  status: 'queued' | 'processing' | 'ready' | 'error';
  attempts: number;
  counted: number;
  next_attempt_at: string | null;
  quota_month: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  notif_ai: number;
  grade: number | null;
  segment: Segment | null;
  birth_year: number | null;
  consent_status: string;
  plan: 'free' | 'pro';
};

type Job = {
  admin: SupabaseClient;
  userId: string;
  doc: DocumentRow;
  deckId: string | null;
  courseName: string;
  input: Omit<ProcessInput, 'pdf'>;
  attempts: number;
  /** For quiet hours and the AI notification switch (US-60, US-62). */
  age: number | null;
  notify: boolean;
};

const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function canUseAi(profile: ProfileRow): boolean {
  if (!profile.birth_year) return false;
  const age = new Date().getFullYear() - profile.birth_year;
  return age >= 18 || profile.consent_status === 'granted';
}

function purposesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed: unknown = JSON.parse(String(value ?? '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** US-16: the parent's latest decision must include the AI purpose (mirrors consent/logic.ts). */
async function aiPurposeGranted(admin: SupabaseClient, userId: string, profile: ProfileRow): Promise<boolean> {
  if (profile.consent_status !== 'granted') return true;
  const { data } = await admin
    .from('consent_records')
    .select('action, purposes, created_at')
    .eq('user_id', userId)
    .in('action', ['granted', 'revoked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ action: string; purposes: unknown }>();
  return !data || data.action !== 'granted' || purposesOf(data.purposes).includes('ai');
}

async function updateDocument(admin: SupabaseClient, id: string, changes: Record<string, unknown>) {
  const { error } = await admin.from('documents').update({ ...changes, updated_at: nowIso() }).eq('id', id);
  if (error) console.error('[process-document] could not update document', id, error.message);
}

/** Ends the job. A failed job no longer counts toward the monthly quota (BR-14). */
async function finish(job: Job, outcome: { status: 'ready' } | { status: 'error'; code: string }) {
  await updateDocument(
    job.admin,
    job.doc.id,
    outcome.status === 'ready'
      ? { status: 'ready', error_code: null, next_attempt_at: null }
      : { status: 'error', error_code: outcome.code, next_attempt_at: null, counted: 0 },
  );
  // US-62: the student hears about it even with the app closed; tapping opens the document.
  if (!job.notify) return;
  const ready = outcome.status === 'ready';
  await notifyStudent(
    job.admin,
    job.userId,
    {
      kind: 'ai',
      title: ready ? 'Belgen hazır' : 'Belge işlenemedi',
      body: ready
        ? `${job.doc.title}: özet, quiz ve kartlar hazır.`
        : `${job.doc.title} işlenemedi. Ne olduğunu görmek için dokun.`,
      url: `/document/${job.doc.id}`,
    },
    { age: job.age },
  );
}

async function logUsage(job: Job, usage: UsageEntry[]) {
  if (usage.length === 0) return;
  const created = nowIso();
  const { error } = await job.admin.from('ai_usage').insert(
    usage.map((u) => ({ id: crypto.randomUUID(), user_id: job.userId, document_id: job.doc.id, created_at: created, ...u })),
  );
  if (error) console.error('[process-document] could not log usage', error.message);
}

async function checkBudget(admin: SupabaseClient) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data, error } = await admin.from('ai_usage').select('cost_usd').gte('created_at', monthStart);
  if (error || !data) return;
  const spent = data.reduce((sum: number, row: { cost_usd: number }) => sum + Number(row.cost_usd || 0), 0);
  const status = budgetStatus(spent, MONTHLY_BUDGET);
  if (status.warn) {
    // Picked up by the log drain alert (AIQ-07).
    console.warn(
      `[ai-budget] ${Math.round(status.ratio * 100)}% of the monthly AI budget used ($${spent.toFixed(2)} / $${MONTHLY_BUDGET})`,
    );
  }
}

async function findOrCreateDeck(job: Job): Promise<string> {
  const { admin, userId, doc } = job;
  if (job.deckId) {
    const { data } = await admin.from('decks').select('id, user_id').eq('id', job.deckId).maybeSingle();
    if (data && data.user_id === userId) return data.id;
    if (!data) {
      // The app created this deck offline and has not synced it yet: create it with its id.
      const now = nowIso();
      const { error } = await admin
        .from('decks')
        .insert({ id: job.deckId, user_id: userId, course_id: doc.course_id, name: job.courseName, created_at: now, updated_at: now });
      if (!error) return job.deckId;
    }
  }
  const { data: existing } = await admin
    .from('decks')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', doc.course_id)
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  const now = nowIso();
  const { error } = await admin
    .from('decks')
    .insert({ id, user_id: userId, course_id: doc.course_id, name: job.courseName, created_at: now, updated_at: now });
  if (error) throw new Error(`deck insert failed: ${error.message}`);
  return id;
}

/** Writes the generated rows. Source pages are shifted back to the original PDF's numbering. */
async function writeContent(job: Job, result: ProcessResult) {
  const { admin, userId, doc } = job;
  const now = nowIso();
  const offset = Math.max(0, doc.page_from - 1);
  const shift = (page: number | null) => (page == null ? null : page + offset);

  // Leftovers of an attempt that failed half-way may already have synced to a device, so they
  // are soft-deleted (deleted_at) rather than removed: the next pull hides them everywhere.
  const gone = { deleted_at: now, updated_at: now };
  const { data: oldQuizzes } = await admin
    .from('quizzes')
    .select('id')
    .eq('document_id', doc.id)
    .is('deleted_at', null);
  const oldQuizIds = (oldQuizzes ?? []).map((q: { id: string }) => q.id);
  if (oldQuizIds.length > 0) {
    await admin.from('questions').update(gone).in('quiz_id', oldQuizIds).is('deleted_at', null);
  }
  await admin.from('quizzes').update(gone).eq('document_id', doc.id).is('deleted_at', null);
  await admin.from('summaries').update(gone).eq('document_id', doc.id).is('deleted_at', null);
  await admin.from('cards').update(gone).eq('document_id', doc.id).is('deleted_at', null);

  const sections = result.summary.sections.map((s) => ({ ...s, pages: s.pages.map((p) => p + offset) }));
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const { error } = await admin.from(table).insert(rows);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  };

  await insert('summaries', [
    { id: crypto.randomUUID(), user_id: userId, document_id: doc.id, content: { sections }, created_at: now, updated_at: now },
  ]);

  const quizId = crypto.randomUUID();
  await insert('quizzes', [
    { id: quizId, user_id: userId, document_id: doc.id, course_id: doc.course_id, title: doc.title, created_at: now, updated_at: now },
  ]);
  await insert(
    'questions',
    result.quiz.questions.map((q, index) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      quiz_id: quizId,
      stem: q.stem,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      source_page: shift(q.source_page),
      topic: q.topic || null,
      sort: index,
      created_at: now,
      updated_at: now,
    })),
  );

  const deckId = await findOrCreateDeck(job);
  await insert(
    'cards',
    result.cards.cards.map((c) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      deck_id: deckId,
      document_id: doc.id,
      front: c.front,
      back: c.back,
      source_page: shift(c.source_page),
      ai_generated: 1,
      due: now,
      state: 0,
      created_at: now,
      updated_at: now,
    })),
  );
}

async function downloadPdf(job: Job): Promise<string> {
  const { data, error } = await job.admin.storage.from('documents').download(`${job.userId}/${job.doc.id}.pdf`);
  if (error || !data) throw new AiError('bad_request', 'PDF not found in storage.', false);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new AiError('bad_request', 'PDF is larger than 25 MB.', false);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function runJob(job: Job) {
  const started = Date.now();
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let attempts = job.attempts;

  try {
    const pdf = await downloadPdf(job);
    const input: ProcessInput = { ...job.input, pdf };

    for (;;) {
      try {
        const result = await processDocument(anthropic, input, { model: AI_MODEL });
        await logUsage(job, result.usage);
        if (result.flagged) {
          // SP-02: nothing is stored; the app shows a neutral message.
          await finish(job, { status: 'error', code: 'inappropriate' });
        } else {
          await writeContent(job, result);
          await finish(job, { status: 'ready' });
        }
        return;
      } catch (error) {
        if (!(error instanceof AiError)) throw error;
        await logUsage(job, error.usage);
        console.warn(`[process-document] attempt ${attempts} failed: ${error.code}`);

        if (!error.retryable || attempts >= MAX_ATTEMPTS) {
          await finish(job, { status: 'error', code: error.code });
          return;
        }
        const wait = BACKOFF_MS[attempts - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        if (Date.now() - started + wait > TIME_BUDGET_MS) {
          await updateDocument(job.admin, job.doc.id, {
            status: 'queued',
            error_code: error.code,
            next_attempt_at: new Date(Date.now() + wait).toISOString(),
          });
          return;
        }
        await sleep(wait);
        attempts += 1;
        await updateDocument(job.admin, job.doc.id, { attempts });
      }
    }
  } catch (error) {
    const code = error instanceof AiError ? error.code : 'server';
    console.error('[process-document] job failed', job.doc.id, error instanceof Error ? error.message : 'unknown');
    await finish(job, { status: 'error', code });
  } finally {
    await checkBudget(job.admin);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json(401, { error: 'unauthorized' });

  let body: { documentId?: unknown; deckId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_json' });
  }
  const documentId = typeof body.documentId === 'string' && UUID.test(body.documentId) ? body.documentId : null;
  const deckId = typeof body.deckId === 'string' && UUID.test(body.deckId) ? body.deckId : null;
  if (!documentId) return json(400, { error: 'document_id_required' });

  // Read through RLS: a student can only start their own documents.
  const { data: doc } = await userClient
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle<DocumentRow>();
  if (!doc) return json(404, { error: 'not_found' });

  if (doc.status === 'ready') return json(200, { status: 'ready' });
  if (doc.status === 'error') return json(409, { status: 'error' });
  if (doc.status === 'processing' && Date.now() - Date.parse(doc.updated_at) < STALE_MS) {
    return json(202, { status: 'processing' });
  }
  if (doc.next_attempt_at && Date.parse(doc.next_attempt_at) > Date.now()) {
    return json(202, { status: 'queued', next_attempt_at: doc.next_attempt_at });
  }

  const admin = adminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('grade, segment, birth_year, consent_status, plan, notif_ai')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();
  // BR-03 / BR-16: no AI without the parent's consent. The job stays queued.
  if (!profile || !profile.grade || !profile.segment || !canUseAi(profile)) return json(403, { error: 'consent' });
  if (!(await aiPurposeGranted(admin, user.id, profile))) return json(403, { error: 'consent' });

  const pageCount = doc.page_to - doc.page_from + 1;
  const job: Job = {
    admin,
    userId: user.id,
    doc,
    deckId,
    courseName: '',
    input: {
      grade: profile.grade,
      segment: profile.segment,
      courseName: '',
      optionCount: OPTION_COUNT[profile.segment],
      quizCount: QUIZ_COUNT,
      cardCount: CARD_COUNT,
      pageCount,
    },
    attempts: (doc.attempts ?? 0) + 1,
    age: profile.birth_year ? new Date().getFullYear() - profile.birth_year : null,
    notify: profile.notif_ai !== 0,
  };

  // BR-14, checked before any tokens are spent. The count includes this document (counted = 1).
  const { data: quota } = await admin
    .rpc('document_quota', { p_user: user.id, p_month: doc.quota_month })
    .maybeSingle<{ used: number; monthly_limit: number; page_limit: number }>();
  if (doc.counted !== 1 || (quota && quota.used > quota.monthly_limit)) {
    await finish(job, { status: 'error', code: 'quota_exceeded' });
    return json(403, { error: 'quota_exceeded' });
  }
  const pageLimit = quota?.page_limit ?? (profile.plan === 'pro' ? 100 : 20);
  if (pageCount < 1 || pageCount > pageLimit) {
    await finish(job, { status: 'error', code: 'too_many_pages' });
    return json(422, { error: 'too_many_pages' });
  }

  if (!ANTHROPIC_API_KEY) return json(503, { error: 'server_config' });

  const { data: course } = await admin
    .from('courses')
    .select('name')
    .eq('id', doc.course_id)
    .eq('user_id', user.id)
    .maybeSingle<{ name: string }>();
  job.courseName = course?.name ?? '';
  job.input.courseName = job.courseName;

  // Claim the job. The updated_at check stops two invocations from running it twice.
  const { data: claimed } = await admin
    .from('documents')
    .update({ status: 'processing', attempts: job.attempts, error_code: null, next_attempt_at: null, updated_at: nowIso() })
    .eq('id', doc.id)
    .eq('updated_at', doc.updated_at)
    .select('id');
  if (!claimed || claimed.length === 0) return json(202, { status: 'processing' });

  EdgeRuntime.waitUntil(runJob(job));
  return json(202, { status: 'processing' });
});
