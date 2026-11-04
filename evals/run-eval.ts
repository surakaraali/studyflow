/**
 * Evaluation harness for the document pipeline (SP-01; AIQ-01, 02, 03, 05, 07).
 *
 * Runs the real pipeline (processDocument: same prompts, schema and validation as production)
 * on every evaluation document for every model, records time, cost and automatic checks, and
 * writes a blind scoring sheet for the education advisor. `--score` reads the filled sheet back
 * and checks the thresholds per model.
 *
 *   npx tsx evals/run-eval.ts --dry-run                 check manifest + PDFs, estimate cost, no API calls
 *   npx tsx evals/run-eval.ts                           full run (needs ANTHROPIC_API_KEY)
 *   npx tsx evals/run-eval.ts --score <run>/scoring-sheet.csv[,second-scorer.csv]
 *
 * Run from the repository root. See evals/README.md and evals/rubric.md.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { EncryptedPDFError, PDFDocument } from 'pdf-lib';

import { loadEnvFile } from '../server/env.ts';
import { MODEL_PRICES, priceFor } from '../supabase/functions/_shared/ai/pricing.ts';
import { processDocument } from '../supabase/functions/_shared/ai/process.ts';
import {
  AiError,
  type ProcessInput,
  type ProcessResult,
  type QuizQuestion,
  type Segment,
  type UsageEntry,
} from '../supabase/functions/_shared/ai/types.ts';

const DEFAULT_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
/** Same counts as production (process-document/index.ts, src/services/ai/types.ts). */
const QUIZ_COUNT = 10;
const CARD_COUNT = 15;
const MAX_BYTES = 25 * 1024 * 1024; // BR-15
const MAX_PAGES = 100; // BR-14, Pro plan
const THRESHOLDS = { accuracy: 0.95, ageViolations: 0, outOfDoc: 0.02, costPer20Pages: 0.05 };
/** BR-05: the only fields that may reach the AI provider. */
const ALLOWED_INPUT_KEYS = 'cardCount,courseName,grade,optionCount,pageCount,pdf,quizCount,segment';
const SUBJECTS = ['turkce', 'matematik', 'fen', 'sosyal', 'ingilizce'] as const;
/** A change in any of these needs a new eval run before release (AIQ-05). */
const PIPELINE_FILES = ['process', 'prompts', 'schemas', 'validate'].map((f) => `supabase/functions/_shared/ai/${f}.ts`);
/** Rough token guesses for --dry-run only; real runs record the API's own usage. Output includes thinking. */
const ESTIMATE = { tokensPerPage: 3000, systemPrompt: 2000, taskPrompt: 300, output: 3000 + 6000 + 4000 };
/** Error codes that say something about the model (the rest are infrastructure or harness problems). */
const MODEL_ERRORS = ['invalid_output', 'truncated', 'refused', 'empty', 'bad_request'];
const LETTERS = 'ABCDE';

type Subject = (typeof SUBJECTS)[number];
type Kind = 'soru' | 'kart' | 'ozet';
type ManifestDoc = {
  id: string; file: string; segment: Segment; grade: number; course: string; subject: Subject;
  source: string; licence: string; pages?: [number, number]; expect_flagged?: boolean; reference_notes?: string[];
};
type EvalDoc = ManifestDoc & { pdf: string; pageCount: number };
type Checks = {
  questions: number; cards: number; sections: number;
  countsOk: boolean; optionsOk: boolean; explanationsOk: boolean; sourcePagesOk: boolean; missingPages: number;
  nearDuplicates: number; answerSpreadOk: boolean; turkishShare: number; turkishOk: boolean | null;
};
type RunRecord = {
  docId: string; model: string; rep: number; pageCount: number; inputPiiOk: boolean;
  ok: boolean; errorCode: string | null; errorMessage: string | null; flagged: string | null; expectFlagged: boolean;
  durationMs: number; costUsd: number; costPer20Pages: number; servedModels: string[]; cacheReadShare: number;
  usage: UsageEntry[]; checks: Checks | null; result: Omit<ProcessResult, 'usage' | 'flagged'> | null;
};
type KeyEntry = { model: string; docId: string; kind: Kind; index: number };

const USAGE = `Kullanım: npx tsx evals/run-eval.ts [seçenekler]
  --dry-run              Manifest ve PDF'leri denetle, maliyeti tahmin et (API çağrısı yok)
  --models a,b,c         Modeller (varsayılan: ${DEFAULT_MODELS.join(',')})
  --docs <klasör>        PDF klasörü (varsayılan: evals/documents)
  --manifest <dosya>     Manifest (varsayılan: evals/manifest.json)
  --out <klasör>         Çıktı klasörü (varsayılan: evals/results/<zaman>)
  --limit N              Yalnızca ilk N belge
  --reps N               Belge × model başına tekrar (varsayılan: 1)
  --concurrency N        Aynı anda çalışan iş (varsayılan: 2)
  --timeout SN           İş başına süre sınırı, saniye (varsayılan: 300)
  --budget USD           Harcama sınırı, dolar (varsayılan: 25)
  --score a.csv[,b.csv]  Doldurulmuş puanlama sayfasını oku, eşikleri denetle`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const round = (n: number, digits = 6) => Math.round(n * 10 ** digits) / 10 ** digits;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const p95 = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[Math.ceil(0.95 * v.length) - 1] : 0);
const share = (part: number, whole: number) => (whole ? part / whole : 0);
const tr = (n: number, digits = 2) => n.toFixed(digits).replace('.', ',');
const pct = (n: number) => `%${tr(n * 100, 1)}`;
const usd = (n: number) => `$${tr(n, 4)}`;
const mark = (pass: boolean | null) => (pass == null ? '—' : pass ? '✓' : '✗');
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;

// Copies of src/domain/rules.ts (segmentForGrade, BR-12 quizOptionCount); evals cannot import app code.
const segmentForGrade = (grade: number): Segment => (grade <= 4 ? 'ilkokul' : grade <= 8 ? 'ortaokul' : 'lise');
const OPTION_COUNT: Record<Segment, number> = { ilkokul: 3, ortaokul: 4, lise: 5 };

// ---------------------------------------------------------------- manifest and PDFs

function checkEntry(raw: unknown, seen: Set<string>): { id: string; doc?: ManifestDoc; errors: string[] } {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : '');
  const errors: string[] = [];
  const id = str('id');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) errors.push('id yalnızca küçük harf, rakam, - ve _ içermeli');
  else if (seen.has(id)) errors.push('id tekrar ediyor');
  seen.add(id);
  if (!str('file').toLowerCase().endsWith('.pdf')) errors.push('file bir .pdf olmalı');
  const grade = d.grade;
  if (typeof grade !== 'number' || !Number.isInteger(grade) || grade < 1 || grade > 12) errors.push('grade 1–12 olmalı');
  else if (d.segment !== segmentForGrade(grade)) errors.push(`segment "${segmentForGrade(grade)}" olmalı (BR-01)`);
  if (!SUBJECTS.includes(d.subject as Subject)) errors.push(`subject şunlardan biri olmalı: ${SUBJECTS.join(', ')}`);
  for (const k of ['course', 'source', 'licence']) if (!str(k)) errors.push(`${k} boş`);
  const p = d.pages;
  if (p !== undefined && !(Array.isArray(p) && p.length === 2 && p.every(Number.isInteger) && p[0] >= 1 && p[0] <= p[1])) {
    errors.push('pages [ilk, son] biçiminde olmalı');
  }
  const notes = d.reference_notes;
  if (notes !== undefined && !(Array.isArray(notes) && notes.every((n) => typeof n === 'string'))) {
    errors.push('reference_notes metin listesi olmalı');
  }
  return errors.length ? { id, errors } : { id, doc: { ...(d as ManifestDoc), id, course: str('course') }, errors };
}

type LoadedPdf = { pdf?: string; pageCount?: number; errors: string[]; warnings: string[] };

/** Mirrors the app (src/features/documents/files.ts): size and encryption checks, page range cut with pdf-lib. */
async function loadPdf(doc: ManifestDoc, docsDir: string): Promise<LoadedPdf> {
  const path = join(docsDir, doc.file);
  if (!existsSync(path)) return { errors: [`dosya yok: ${path}`], warnings: [] };
  const bytes = readFileSync(path);
  if (bytes.byteLength > MAX_BYTES) return { errors: ['25 MB sınırını aşıyor (BR-15)'], warnings: [] };
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    return { errors: [error instanceof EncryptedPDFError ? 'PDF şifreli' : 'PDF okunamadı'], warnings: [] };
  }
  const total = source.getPageCount();
  const [from, to] = doc.pages ?? [1, total];
  if (total < 1 || to > total) return { errors: [`sayfa aralığı ${from}–${to}, belge ${total} sayfa`], warnings: [] };
  const pageCount = to - from + 1;
  if (pageCount > MAX_PAGES) return { errors: [`${pageCount} sayfa; en çok ${MAX_PAGES} (BR-14)`], warnings: [] };

  const warnings = pageCount > 20 ? [`${pageCount} sayfa; ücretsiz plan sınırı 20 (BR-14)`] : [];
  let out: Uint8Array = bytes;
  if (pageCount !== total) {
    const part = await PDFDocument.create();
    const copied = await part.copyPages(source, Array.from({ length: pageCount }, (_, i) => from - 1 + i));
    copied.forEach((page) => part.addPage(page));
    out = await part.save();
  } else if (source.getAuthor()) {
    warnings.push('PDF üst verisinde yazar adı var ve sağlayıcıya gider; kaldır (BR-05)');
  }
  return { pdf: Buffer.from(out).toString('base64'), pageCount, errors: [], warnings };
}

/** Documents per segment × main subject (SP-01 matrix). Moderation test documents are not counted. */
function coverageTable(docs: ManifestDoc[]): string {
  const lines = [row(['Segment', ...SUBJECTS, 'Toplam']), `|---|${SUBJECTS.map(() => '---:').join('|')}|---:|`];
  for (const seg of ['ortaokul', 'lise'] as const) {
    const counts = SUBJECTS.map((s) => docs.filter((d) => d.segment === seg && d.subject === s && !d.expect_flagged).length);
    lines.push(row([seg, ...counts, counts.reduce((a, b) => a + b, 0)]));
  }
  return lines.join('\n');
}

/** Cost guess for one document: request 1 writes the cached prefix (system + PDF), requests 2 and 3 read it. */
function estimateCost(model: string, pageCount: number): number {
  const p = priceFor(model);
  const prefix = pageCount * ESTIMATE.tokensPerPage + ESTIMATE.systemPrompt;
  const tokens = prefix * p.cacheWrite + 2 * prefix * p.cacheRead + 3 * ESTIMATE.taskPrompt * p.input + ESTIMATE.output * p.output;
  return tokens / 1e6;
}

// ---------------------------------------------------------------- one run

/** Same fields as the app's buildAiRequest (src/services/ai/request.ts); manifest notes never get in. */
function buildInput(doc: EvalDoc): ProcessInput {
  return {
    pdf: doc.pdf,
    grade: doc.grade,
    segment: doc.segment,
    courseName: doc.course.trim().slice(0, 80),
    optionCount: OPTION_COUNT[doc.segment],
    quizCount: QUIZ_COUNT,
    cardCount: CARD_COUNT,
    pageCount: doc.pageCount,
  };
}

/** BR-05 guard on the request itself: only the allowed fields, no e-mail or long numbers in the course name. */
function piiProblems(input: ProcessInput): string[] {
  const problems: string[] = [];
  const keys = Object.keys(input).sort().join(',');
  if (keys !== ALLOWED_INPUT_KEYS) problems.push(`izin verilmeyen alanlar: ${keys}`);
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(input.courseName)) problems.push('ders adında e-posta');
  if (/\d{7,}/.test(input.courseName.replace(/[\s-]/g, ''))) problems.push('ders adında numara');
  return problems;
}

const TR_WORDS = new Set(
  've bir bu ile için da de ne hangi hangisi olan gibi en daha çok olarak ama veya ki her göre nedir nasıl neden kadar sonra önce arasında'.split(' '),
);
const EN_WORDS = new Set('the and of is are which what to in for with that this from by'.split(' '));

/** Heuristic: Turkish stop words and letters outnumber English stop words. */
function looksTurkish(text: string): boolean {
  const words = text.toLocaleLowerCase('tr-TR').match(/\p{L}+/gu) ?? [];
  const trHits = words.filter((w) => TR_WORDS.has(w)).length + (/[çğıöşüÇĞİÖŞÜ]/.test(text) ? 1 : 0);
  return trHits > words.filter((w) => EN_WORDS.has(w)).length;
}

/** Pairs whose word sets overlap by 80% or more (the pipeline only removes exact repeats). */
function nearDuplicates(texts: string[]): number {
  const sets = texts.map((t) => new Set(t.toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]+/gu) ?? []));
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const common = [...sets[i]].filter((w) => sets[j].has(w)).length;
      if (share(common, sets[i].size + sets[j].size - common) >= 0.8) pairs++;
    }
  }
  return pairs;
}

/** The quiz prompt forbids "Hepsi" / "Hiçbiri" options. */
const isBannedOption = (o: string) => /^(yukarıdakilerin )?(hepsi|hiçbiri)/u.test(o.toLocaleLowerCase('tr-TR'));

function autoChecks(r: ProcessResult, input: ProcessInput, subject: Subject): Checks {
  const { questions: qs } = r.quiz;
  const { cards } = r.cards;
  const { sections } = r.summary;
  const inRange = (p: number | null) => p != null && p >= 1 && p <= input.pageCount;
  const missingPages =
    qs.filter((q) => !inRange(q.source_page)).length +
    cards.filter((c) => !inRange(c.source_page)).length +
    sections.filter((s) => s.pages.length === 0).length;
  const positions = qs.map((q) => q.correct_index);
  const topPosition = Math.max(0, ...positions.map((p) => positions.filter((x) => x === p).length));
  const texts = [
    ...qs.map((q) => `${q.stem} ${q.explanation}`),
    ...cards.map((c) => `${c.front} ${c.back}`),
    ...sections.map((s) => `${s.heading} ${s.paragraphs.join(' ')}`),
  ];
  const turkishShare = share(texts.filter(looksTurkish).length, texts.length);
  const validOptions = (q: QuizQuestion) =>
    q.options.length === input.optionCount && q.correct_index >= 0 && q.correct_index < q.options.length && !q.options.some(isBannedOption);
  return {
    questions: qs.length, cards: cards.length, sections: sections.length,
    // The prompt asks for exactly quizCount / cardCount items and 3–8 summary sections.
    countsOk: qs.length === input.quizCount && cards.length === input.cardCount && sections.length >= 3 && sections.length <= 8,
    optionsOk: qs.every(validOptions),
    explanationsOk: qs.every((q) => q.explanation.length > 0),
    sourcePagesOk: missingPages === 0,
    missingPages,
    nearDuplicates: nearDuplicates(qs.map((q) => q.stem)) + nearDuplicates(cards.map((c) => c.front)),
    // The prompt asks to vary the position of the right answer.
    answerSpreadOk: qs.length < 4 || topPosition / qs.length <= 0.5,
    turkishShare: round(turkishShare, 3),
    // İngilizce documents legitimately produce English text, so they are not judged.
    turkishOk: subject === 'ingilizce' ? null : turkishShare >= 0.95,
  };
}

async function runOne(client: Anthropic, doc: EvalDoc, model: string, rep: number, timeoutMs: number, stop: AbortSignal): Promise<RunRecord> {
  const input = buildInput(doc);
  const pii = piiProblems(input);
  const timeout = AbortSignal.timeout(timeoutMs);
  const started = performance.now();
  let result: ProcessResult | null = null;
  let usage: UsageEntry[] = [];
  let errorCode: string | null = pii.length ? 'pii_blocked' : null;
  let errorMessage: string | null = pii.length ? pii.join('; ') : null;

  if (!pii.length) {
    try {
      result = await processDocument(client, input, { model, signal: AbortSignal.any([timeout, stop]) });
      usage = result.usage;
    } catch (error) {
      usage = error instanceof AiError ? error.usage : []; // failed jobs still cost money
      errorCode = timeout.aborted ? 'timeout' : stop.aborted ? 'interrupted' : error instanceof AiError ? error.code : 'harness_error';
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const costUsd = round(usage.reduce((sum, u) => sum + u.cost_usd, 0));
  const promptTokens = usage.reduce((sum, u) => sum + u.input_tokens + u.cache_read_tokens + u.cache_write_tokens, 0);
  const content = result && !result.flagged ? result : null;
  return {
    docId: doc.id, model, rep, pageCount: doc.pageCount, inputPiiOk: pii.length === 0,
    ok: result !== null, errorCode, errorMessage,
    flagged: result?.flagged?.reason ?? null, expectFlagged: doc.expect_flagged === true,
    durationMs: Math.round(performance.now() - started),
    costUsd, costPer20Pages: round((costUsd / doc.pageCount) * 20),
    // With a server-side fallback part of the answer may come from another model.
    servedModels: [...new Set(usage.map((u) => u.model))],
    cacheReadShare: round(share(usage.reduce((sum, u) => sum + u.cache_read_tokens, 0), promptTokens), 3),
    usage,
    checks: content ? autoChecks(content, input, doc.subject) : null,
    result: content ? { summary: content.summary, quiz: content.quiz, cards: content.cards } : null,
  };
}

/**
 * AIQ-07: cost of a 20-page document. A straight line through (pages, cost) keeps the fixed
 * per-document cost (prompts, output) from being scaled up for short documents.
 * Falls back to the per-page average when every document has the same page count.
 */
function costAt20Pages(rs: RunRecord[]): number {
  const xs = rs.map((r) => r.pageCount);
  const ys = rs.map((r) => r.costUsd);
  const mx = mean(xs);
  const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  if (sxx === 0) return mean(rs.map((r) => r.costPer20Pages));
  const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - mean(ys)), 0) / sxx;
  return mean(ys) + slope * (20 - mx);
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>, stopped: () => boolean): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !stopped()) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: size }, worker));
}

// ---------------------------------------------------------------- outputs

const RUBRIC_COLUMNS = ['dogruluk', 'tek_dogru', 'celdirici', 'belge_disi', 'kaynak_sayfa', 'yas_ihlali', 'ihlal_turu', 'dil_duzeyi', 'dilbilgisi_hatasi', 'kapsam', 'puanlayici', 'not'];
const NOT_APPLICABLE: Record<Kind, string[]> = { soru: ['kapsam'], kart: ['tek_dogru', 'celdirici', 'kapsam'], ozet: ['tek_dogru', 'celdirici'] };
const SHEET_HEADER = ['item_id', 'cift_puan', 'belge', 'sinif', 'segment', 'ders', 'belge_sayfalari', 'tur', 'sira', 'kaynak_sayfa_beyan', 'metin', 'secenekler', 'dogru_cevap', 'aciklama', 'belge_notu', ...RUBRIC_COLUMNS];
const KIND_ORDER: Kind[] = ['ozet', 'soru', 'kart'];

function csvCell(value: string): string {
  const safe = /^[=+\-@]./s.test(value) ? `'${value}` : value; // keeps spreadsheets from reading text as a formula
  return /[";,\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * One row per summary, question and card of the first repetition. Rows are grouped by document
 * (the scorer reads each PDF once) and shuffled by a hash inside it, so the model is not visible.
 */
function scoringSheet(runs: RunRecord[], docs: EvalDoc[]): { csv: string; key: Record<string, KeyEntry> } {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const rows: { order: string; cells: string[] }[] = [];
  const key: Record<string, KeyEntry> = {};
  for (const run of runs) {
    const doc = byId.get(run.docId);
    if (!run.result || !doc || run.rep !== 0) continue;
    // Output pages count from 1 in the PDF that was sent; show the original page too.
    const page = (p: number | null) => (p == null ? 'yok' : doc.pages ? `${p} (asıl s. ${doc.pages[0] + p - 1})` : String(p));
    const add = (kind: Kind, index: number, pages: string, text: string, options = '', answer = '', explanation = '') => {
      const hash = createHash('sha256').update(`${run.model}|${run.docId}|${kind}|${index}`).digest('hex');
      const id = `${kind[0]}${hash.slice(0, 9)}`; // starts with a letter so spreadsheets keep it as text
      key[id] = { model: run.model, docId: run.docId, kind, index };
      const double = parseInt(hash.slice(9, 13), 16) % 5 === 0 ? 'E' : ''; // ≈ 20% double-scored
      const range = doc.pages ? `${doc.pages[0]}–${doc.pages[1]}` : 'tümü';
      const rubric = RUBRIC_COLUMNS.map((c) => (NOT_APPLICABLE[kind].includes(c) ? '-' : ''));
      const notes = (doc.reference_notes ?? []).join(' | ');
      const cells = [id, double, doc.id, String(doc.grade), doc.segment, doc.course, range, kind, String(index + 1), pages, text, options, answer, explanation, notes, ...rubric];
      rows.push({ order: `${doc.id}|${KIND_ORDER.indexOf(kind)}|${hash}`, cells });
    };
    const { sections } = run.result.summary;
    const summary = sections.map((s) => `## ${s.heading} (s. ${s.pages.join(', ')})\n${s.paragraphs.join('\n')}\nAnahtar kavramlar: ${s.key_terms.join(', ')}`);
    add('ozet', 0, [...new Set(sections.flatMap((s) => s.pages))].map(page).join(', '), summary.join('\n\n'));
    run.result.quiz.questions.forEach((q, i) => {
      const options = q.options.map((o, j) => `${LETTERS[j]}) ${o}`).join('\n');
      add('soru', i, page(q.source_page), q.stem, options, `${LETTERS[q.correct_index]}) ${q.options[q.correct_index]}`, q.explanation);
    });
    run.result.cards.cards.forEach((c, i) => add('kart', i, page(c.source_page), c.front, '', c.back));
  }
  rows.sort((a, b) => a.order.localeCompare(b.order));
  const lines = [SHEET_HEADER, ...rows.map((r) => r.cells)].map((cells) => cells.map(csvCell).join(';'));
  return { csv: '﻿' + lines.join('\r\n') + '\r\n', key }; // BOM + ";" so Excel (tr-TR) opens it directly
}

function summaryMarkdown(meta: { startedAt: string; reps: number; pipelineHash: string; totalCostUsd: number; stoppedEarly: string | null }, runs: RunRecord[], docs: EvalDoc[], models: string[]): string {
  const out = [`# Değerlendirme özeti · ${meta.startedAt.slice(0, 16).replace('T', ' ')}`, ''];
  out.push(`Belge: ${docs.length} · Model: ${models.join(', ')} · Tekrar: ${meta.reps} · Hat sürümü: \`${meta.pipelineHash}\` · Toplam harcama: ${usd(meta.totalCostUsd)}`);
  if (meta.stoppedEarly) out.push('', `> Çalıştırma erken durdu (${meta.stoppedEarly}); tablolar yalnızca biten işleri içerir.`);

  out.push('', '## Süre, maliyet ve hatalar', '');
  out.push(row(['Model', 'İş', 'Başarılı', 'Model hatası', 'Altyapı hatası', 'Yanlış / kaçan işaret', 'Yedek model', 'Süre ort. / p95 (sn)', 'Maliyet / belge', 'Maliyet / 20 sayfa', 'AIQ-07 (≤ $0,05)', 'Önbellek okuma']));
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:-:|---:|');
  for (const model of models) {
    const rs = runs.filter((r) => r.model === model);
    const done = rs.filter((r) => r.result); // succeeded and not flagged
    const seconds = rs.filter((r) => r.ok).map((r) => r.durationMs / 1000);
    const per20 = costAt20Pages(done);
    const count = (test: (r: RunRecord) => boolean) => rs.filter(test).length;
    out.push(row([
      model,
      rs.length,
      pct(share(count((r) => r.ok), rs.length)),
      count((r) => MODEL_ERRORS.includes(r.errorCode ?? '')),
      count((r) => r.errorCode != null && !MODEL_ERRORS.includes(r.errorCode)),
      `${count((r) => r.flagged != null && !r.expectFlagged)} / ${count((r) => r.result != null && r.expectFlagged)}`,
      count((r) => r.servedModels.some((m) => m !== model)),
      `${tr(mean(seconds), 1)} / ${tr(p95(seconds), 1)}`,
      usd(mean(done.map((r) => r.costUsd))),
      usd(per20),
      mark(done.length ? per20 <= THRESHOLDS.costPer20Pages : null),
      pct(mean(done.map((r) => r.cacheReadShare))),
    ]));
  }

  out.push('', '## Otomatik kontroller (başarılı işlerde geçme oranı)', '');
  out.push(row(['Model', 'Sayılar (AIQ-02)', 'Şıklar (BR-12)', 'Açıklama', 'Kaynak sayfa (AIQ-03)', 'Yakın tekrar (çift)', 'Doğru şık dağılımı', 'Türkçe (BR-21)']));
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const model of models) {
    const cs = runs.filter((r) => r.model === model && r.checks).map((r) => r.checks!);
    const rate = (pick: (c: Checks) => boolean | null) => {
      const judged = cs.map(pick).filter((v): v is boolean => v != null);
      return judged.length ? pct(share(judged.filter(Boolean).length, judged.length)) : '—';
    };
    const duplicates = cs.reduce((sum, c) => sum + c.nearDuplicates, 0);
    out.push(row([model, rate((c) => c.countsOk), rate((c) => c.optionsOk), rate((c) => c.explanationsOk), rate((c) => c.sourcePagesOk), duplicates, rate((c) => c.answerSpreadOk), rate((c) => c.turkishOk)]));
  }

  const failed = runs.filter((r) => r.errorCode);
  if (failed.length) out.push('', '## Hatalar', '', ...failed.map((r) => `- ${r.model} · ${r.docId} · \`${r.errorCode}\` · ${r.errorMessage ?? ''}`));
  out.push('', '## Belge kapsamı (SP-01: her hücrede en az 3 belge, toplam en az 30)', '', coverageTable(docs));
  out.push(
    '', '## Sonraki adım: insan puanlaması', '',
    'Doğruluk ve yaşa uygunluk (AIQ-01) ile belge dışı bilgi oranı (AIQ-03) bu tablolarda **yok**; bunları yalnızca eğitim danışmanının puanlaması verir.',
    '`scoring-sheet.csv`, `evals/rubric.md` ölçütlerine göre doldurulup bu klasöre konduktan sonra eşikler şöyle denetlenir:',
    '', '```bash', `npx tsx evals/run-eval.ts --score <bu-klasör>/scoring-sheet.csv`, '```', '',
    'ADR-002 kararı insan puanları ve bu tablolar birlikte okunmadan verilmez.',
  );
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------- --score

function parseCsv(text: string): Record<string, string>[] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0];
  const delimiter = [';', ',', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best));
  const rows: string[][] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      rows.push([...cells, field]);
      cells = [];
      field = '';
    } else field += ch;
  }
  if (field || cells.length) rows.push([...cells, field]);
  const [header = [], ...data] = rows.filter((r) => r.some((c) => c.trim()));
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** Only the first letter counts: "doğru" → D, "evet" → E, "2" → 2. */
const code = (value: string | undefined) => (value ?? '').trim().toLocaleUpperCase('tr-TR').charAt(0);

/** Lower end of the 95% Wilson interval: how high the accuracy is at least, given the sample size. */
function wilsonLow(k: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = k / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}

function scoreMode(files: string[]): void {
  const sheets = files.map((f) => (existsSync(f) ? parseCsv(readFileSync(f, 'utf8')) : fail(`Dosya yok: ${f}`)));
  const runDir = dirname(resolve(files[0]));
  const keyFile = join(runDir, 'scoring-key.json');
  if (!existsSync(keyFile)) fail(`Anahtar yok: ${keyFile}. Doldurulmuş CSV'yi çalıştırmanın klasörüne koy.`);
  const key = JSON.parse(readFileSync(keyFile, 'utf8')) as Record<string, KeyEntry>;
  const resultsFile = join(runDir, 'results.json');
  const runs = existsSync(resultsFile) ? (JSON.parse(readFileSync(resultsFile, 'utf8')) as { runs: RunRecord[] }).runs : [];
  const primary = sheets[0].filter((r) => key[r.item_id]);
  const models = [...new Set(Object.values(key).map((k) => k.model))];

  const lines = ['# Puanlama sonucu', '', `Sayfa: ${files[0]} · ${primary.length} öğe`, ''];
  lines.push(row(['Model', 'Puanlanan soru', 'Doğruluk (%95 alt sınır)', 'Yaş ihlali', 'Belge dışı', 'Kaynak sayfa doğru', 'Maliyet / 20 sayfa', 'Puansız soru / diğer', 'Sonuç']));
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|:-:|');
  const details = ['', row(['Model', 'Belirsiz soru', 'Çeldirici ort. (1–3)', 'Dil düzeyi ort. (1–3)', 'Dil bilgisi hatası', 'Özet kapsamı ort. (1–3)']), '|---|---:|---:|---:|---:|---:|'];

  for (const model of models) {
    const rows = primary.filter((r) => key[r.item_id].model === model);
    if (!rows.length) continue; // the coordinator may drop a model's rows before scoring
    const isQuestion = (r: Record<string, string>) => key[r.item_id].kind === 'soru';
    const questions = rows.filter((r) => isQuestion(r) && ['D', 'Y', 'B'].includes(code(r.dogruluk)));
    // A question is correct when the marked answer is right and it is the only right option.
    const correct = questions.filter((r) => code(r.dogruluk) === 'D' && code(r.tek_dogru) !== 'H').length;
    const judged = (col: string) => rows.filter((r) => ['E', 'H'].includes(code(r[col])));
    const yes = (col: string) => judged(col).filter((r) => code(r[col]) === 'E').length;
    const rateOf = (col: string) => share(yes(col), judged(col).length);
    const avg = (col: string) => tr(mean(rows.map((r) => Number(code(r[col]))).filter((n) => n >= 1 && n <= 3)));
    // Every question must be scored (AIQ-01); cards and summaries may be a sample.
    const unscored = rows.filter((r) => isQuestion(r) && !['D', 'Y', 'B'].includes(code(r.dogruluk))).length;
    const unscoredOther = rows.filter((r) => !isQuestion(r) && !['E', 'H'].includes(code(r.belge_disi))).length;
    const done = runs.filter((r) => r.model === model && r.result);
    const per20 = done.length ? costAt20Pages(done) : null;

    const accuracy = share(correct, questions.length);
    const passes = [
      questions.length > 0 && accuracy >= THRESHOLDS.accuracy,
      judged('yas_ihlali').length > 0 && yes('yas_ihlali') <= THRESHOLDS.ageViolations,
      judged('belge_disi').length > 0 && rateOf('belge_disi') <= THRESHOLDS.outOfDoc,
      per20 != null && per20 <= THRESHOLDS.costPer20Pages,
    ];
    const verdict = unscored > 0 || per20 == null ? 'EKSİK' : passes.every(Boolean) ? 'GEÇTİ' : 'KALDI';
    lines.push(row([
      model,
      `${questions.length}${questions.length < 100 ? ' (az)' : ''}`,
      `${pct(accuracy)} (${pct(wilsonLow(correct, questions.length))}) ${mark(passes[0])}`,
      `${yes('yas_ihlali')} ${mark(passes[1])}`,
      `${pct(rateOf('belge_disi'))} ${mark(passes[2])}`,
      judged('kaynak_sayfa').length ? pct(rateOf('kaynak_sayfa')) : '—',
      per20 == null ? '— (results.json yok)' : `${usd(per20)} ${mark(passes[3])}`,
      `${unscored} / ${unscoredOther}`,
      verdict,
    ]));
    const unclear = questions.filter((r) => code(r.dogruluk) === 'B').length;
    details.push(row([model, unclear, avg('celdirici'), avg('dil_duzeyi'), pct(rateOf('dilbilgisi_hatasi')), avg('kapsam')]));
  }
  lines.push(...details, '');
  lines.push(`Eşikler: doğruluk ≥ %95 ve yaş ihlali = 0 (AIQ-01), belge dışı ≤ %2 (AIQ-03), maliyet ≤ $0,05 / 20 sayfa (AIQ-07). "(az)": 100'den az soru; sonuç güvenilir değil.`);

  // Inter-rater agreement: each further sheet is compared with the first one on the items both scored.
  const first = new Map(primary.map((r) => [r.item_id, r]));
  for (const [i, other] of sheets.slice(1).entries()) {
    lines.push('', `## Puanlayıcı uyumu: ${files[i + 1]}`, '');
    for (const col of ['dogruluk', 'belge_disi', 'yas_ihlali']) {
      const pairs = other.filter((r) => first.has(r.item_id) && code(r[col]) && code(first.get(r.item_id)![col]));
      const differ = pairs.filter((r) => code(r[col]) !== code(first.get(r.item_id)![col])).map((r) => r.item_id);
      const agreement = pairs.length ? pct(1 - differ.length / pairs.length) : '—';
      lines.push(`- ${col}: ${pairs.length} ortak öğe, uyum ${agreement}${differ.length ? ` · uzlaşılacak: ${differ.join(', ')}` : ''}`);
    }
  }
  const report = lines.join('\n') + '\n';
  console.log(report);
  writeFileSync(join(runDir, 'scores.md'), report);
}

// ---------------------------------------------------------------- main

function parseCli() {
  try {
    return parseArgs({
      options: {
        models: { type: 'string', default: DEFAULT_MODELS.join(',') },
        docs: { type: 'string', default: 'evals/documents' },
        manifest: { type: 'string', default: 'evals/manifest.json' },
        out: { type: 'string' },
        limit: { type: 'string' },
        reps: { type: 'string', default: '1' },
        concurrency: { type: 'string', default: '2' },
        timeout: { type: 'string', default: '300' },
        budget: { type: 'string', default: '25' },
        'dry-run': { type: 'boolean', default: false },
        score: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }).values;
  } catch (error) {
    return fail(`${(error as Error).message}\n\n${USAGE}`);
  }
}

function number(name: string, value: string | undefined, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fail(`--${name} ${min} ile ${max} arasında olmalı.`);
}

async function loadDocs(manifestPath: string, docsDir: string): Promise<{ docs: EvalDoc[]; problems: number }> {
  if (!existsSync(manifestPath)) fail(`Manifest yok: ${manifestPath}\nÖrnekten başla: cp evals/manifest.example.json evals/manifest.json`);
  let entries: unknown;
  try {
    entries = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { documents?: unknown }).documents;
  } catch (error) {
    fail(`Manifest geçerli JSON değil: ${(error as Error).message}`);
  }
  if (!Array.isArray(entries)) fail('Manifestte "documents" listesi yok.');

  console.log(`Manifest: ${manifestPath} · PDF klasörü: ${docsDir}\n`);
  const seen = new Set<string>();
  const docs: EvalDoc[] = [];
  let problems = 0;
  for (const [i, raw] of entries.entries()) {
    const { id, doc, errors } = checkEntry(raw, seen);
    const loaded: LoadedPdf = doc ? await loadPdf(doc, docsDir) : { errors: [], warnings: [] };
    if (!doc || !loaded.pdf || !loaded.pageCount) {
      problems++;
      console.log(`✗ ${id || `#${i + 1}`}: ${[...errors, ...loaded.errors].join('; ')}`);
      continue;
    }
    console.log(`✓ ${doc.id}: ${loaded.pageCount} sayfa${loaded.warnings.map((w) => `\n  ! ${w}`).join('')}`);
    docs.push({ ...doc, pdf: loaded.pdf, pageCount: loaded.pageCount });
  }
  return { docs, problems };
}

async function main(): Promise<void> {
  const values = parseCli();
  if (values.help) return console.log(USAGE);
  if (values.score) return scoreMode(values.score.split(',').map((f) => f.trim()));

  const reps = Math.round(number('reps', values.reps, 1, 10));
  const concurrency = Math.round(number('concurrency', values.concurrency, 1, 8));
  const timeoutSec = number('timeout', values.timeout, 30, 1800);
  const budget = number('budget', values.budget, 0.01, 1000);
  const limit = values.limit === undefined ? Infinity : Math.round(number('limit', values.limit, 1, 10_000));
  const dryRun = values['dry-run'];
  const models = values.models.split(',').map((m) => m.trim()).filter(Boolean);
  const unknown = models.filter((m) => !MODEL_PRICES[m]);
  if (!models.length || unknown.length) fail(`Bilinmeyen model: ${unknown.join(', ') || '(boş)'}. Fiyatı pricing.ts içinde olmalı.`);

  loadEnvFile('.env.local'); // same convenience as the dev server
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  if (!dryRun && !apiKey) fail('ANTHROPIC_API_KEY bulunamadı. Ortama ya da .env.local dosyasına ekle; önce --dry-run ile dene.');

  const { docs, problems } = await loadDocs(values.manifest, values.docs);
  const selected = docs.slice(0, limit);
  console.log(`\nBelge kapsamı (SP-01: her hücrede en az 3):\n${coverageTable(docs)}\n`);
  console.log(`Tahmini maliyet (kaba; ${selected.length} belge × ${reps} tekrar):`);
  let estimate = 0;
  for (const model of models) {
    const cost = selected.reduce((sum, d) => sum + estimateCost(model, d.pageCount), 0) * reps;
    estimate += cost;
    console.log(`  ${model.padEnd(20)} ${usd(cost)}  (20 sayfalık belge ≈ ${usd(estimateCost(model, 20))})`);
  }
  console.log(`  ${'toplam'.padEnd(20)} ${usd(estimate)}  · bütçe ${usd(budget)}\n`);

  if (dryRun) {
    console.log(`Kuru çalıştırma bitti${problems ? `: ${problems} belgede sorun var` : ''}. API çağrısı yapılmadı.`);
    process.exitCode = problems || !selected.length ? 1 : 0;
    return;
  }
  if (problems) fail(`${problems} belgede sorun var; düzelt ya da manifestten çıkar.`);
  if (!selected.length) fail('Çalıştırılacak belge yok.');
  if (estimate > budget) fail('Tahmini maliyet bütçeyi aşıyor. --budget ile bilerek yükselt ya da --limit / --models ile daralt.');

  const outDir = resolve(values.out ?? join('evals', 'results', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)));
  mkdirSync(outDir, { recursive: true });
  // The SDK retries 429/5xx with backoff; failed jobs are not repeated (first-attempt quality is measured).
  const client = new Anthropic({ apiKey, maxRetries: 4 });
  // Models alternate per document so an outage or rate limit does not hit one model only.
  const jobs = selected.flatMap((doc) => Array.from({ length: reps }, (_, rep) => models.map((model) => ({ doc, model, rep }))).flat());
  const stop = new AbortController();
  process.on('SIGINT', () => {
    if (stop.signal.aborted) process.exit(130);
    console.log('\nDurduruluyor; biten işler kaydedilecek. Hemen çıkmak için tekrar Ctrl+C.');
    stop.abort();
  });

  const startedAt = new Date().toISOString();
  const runs: RunRecord[] = [];
  let spent = 0;
  const work = async ({ doc, model, rep }: (typeof jobs)[number]) => {
    const run = await runOne(client, doc, model, rep, timeoutSec * 1000, stop.signal);
    runs.push(run);
    spent += run.costUsd;
    const outcome = run.flagged ? 'işaretlendi' : (run.errorCode ?? 'tamam');
    console.log(`[${runs.length}/${jobs.length}] ${model} · ${doc.id} · ${outcome} · ${tr(run.durationMs / 1000, 1)} sn · ${usd(run.costUsd)}`);
  };
  // The budget is checked before each job starts, so jobs already running can go slightly over it.
  await pool(jobs, concurrency, work, () => stop.signal.aborted || spent >= budget);

  const hash = createHash('sha256');
  for (const f of PIPELINE_FILES) hash.update(existsSync(f) ? readFileSync(f) : f);
  const meta = {
    startedAt,
    finishedAt: new Date().toISOString(),
    stoppedEarly: stop.signal.aborted ? 'kullanıcı durdurdu' : runs.length < jobs.length ? 'bütçe doldu' : null,
    models, reps, concurrency, timeoutSec, budgetUsd: budget, quizCount: QUIZ_COUNT, cardCount: CARD_COUNT,
    manifest: values.manifest,
    documents: selected.map((d) => ({ id: d.id, segment: d.segment, grade: d.grade, subject: d.subject, pageCount: d.pageCount })),
    totalCostUsd: round(spent),
    pipelineHash: hash.digest('hex').slice(0, 12),
    pipelineFiles: PIPELINE_FILES,
  };
  const { csv, key } = scoringSheet(runs, selected);
  writeFileSync(join(outDir, 'results.json'), JSON.stringify({ meta, runs }, null, 2));
  writeFileSync(join(outDir, 'scoring-sheet.csv'), csv);
  writeFileSync(join(outDir, 'scoring-key.json'), JSON.stringify(key, null, 2));
  writeFileSync(join(outDir, 'summary.md'), summaryMarkdown(meta, runs, selected, models));
  console.log(`\nToplam harcama ${usd(spent)} · Sonuçlar: ${outDir}`);
}

main().catch((error: unknown) => fail(`Beklenmeyen hata: ${error instanceof Error ? error.stack : String(error)}`));
