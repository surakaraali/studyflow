/**
 * Development AI server for local mode (no Supabase): the app sends a PDF here, this server
 * calls the AI provider and returns the summary, quiz and cards. The API key stays on this
 * machine (PLAN §3 rule 1).
 *
 *   npm run ai:dev    real model, needs ANTHROPIC_API_KEY (env or .env.local)
 *   npm run ai:mock   sample content, no key needed
 *
 * Request bodies are never logged (PRIV-02). See server/README.md.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { processDocument } from '../supabase/functions/_shared/ai/process.ts';
import { DEFAULT_MODEL } from '../supabase/functions/_shared/ai/pricing.ts';
import { AiError, type ProcessResult } from '../supabase/functions/_shared/ai/types.ts';
import { loadEnvFile } from './env.ts';
import { buildMockResult } from './mock.ts';
import { MAX_PDF_BASE64_CHARS, parseProcessRequest } from './request.ts';

loadEnvFile('.env.local');

const MOCK = process.argv.includes('--mock');
const PORT = Number(process.env.AI_DEV_PORT) || 8787;
/** 127.0.0.1 by default; set AI_DEV_HOST=0.0.0.0 to reach it from a phone on the same Wi-Fi. */
const HOST = process.env.AI_DEV_HOST || '127.0.0.1';
const MODEL = process.env.AI_MODEL || DEFAULT_MODEL;
const API_KEY = process.env.ANTHROPIC_API_KEY?.trim() || '';
const MAX_BODY_BYTES = MAX_PDF_BASE64_CHARS + 64 * 1024;

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

type ErrorBody = { error: { code: string; message: string; retryable: boolean } };

function send(res: ServerResponse, status: number, body: ProcessResult | ErrorBody | Record<string, unknown>) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, code: string, message: string, retryable = false) {
  send(res, status, { error: { code, message, retryable } });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function handleProcess(req: IncomingMessage, res: ServerResponse) {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    fail(res, 413, 'too_large', 'PDF 25 MB sınırını aşıyor.');
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    fail(res, 400, 'bad_json', 'Body is not valid JSON.');
    return;
  }

  const parsed = parseProcessRequest(json);
  if ('error' in parsed) {
    fail(res, 400, 'bad_request', parsed.error);
    return;
  }
  const { input } = parsed;
  const started = Date.now();

  // Stop paying for the job when the app goes away.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });

  try {
    let result: ProcessResult;
    if (MOCK) {
      await delay(1500);
      result = buildMockResult(input);
    } else if (!client) {
      fail(
        res,
        503,
        'no_key',
        'ANTHROPIC_API_KEY bulunamadı. Anahtarı .env.local dosyasına ekle ya da npm run ai:mock ile örnek içerikle başlat.',
        true,
      );
      return;
    } else {
      result = await processDocument(client, input, { model: MODEL, signal: abort.signal });
    }

    const cost = result.usage.reduce((sum, u) => sum + u.cost_usd, 0);
    const outcome = result.flagged ? 'flagged' : 'ok';
    console.log(`[ai] ${outcome} · ${input.pageCount} sayfa · ${Date.now() - started} ms · $${cost.toFixed(4)}`);
    send(res, 200, result);
  } catch (error) {
    const aiError =
      error instanceof AiError ? error : new AiError('provider_unavailable', error instanceof Error ? error.message : 'Unknown error');
    console.warn(`[ai] error ${aiError.code} (${aiError.retryable ? 'retry' : 'final'}) · ${aiError.message}`);
    fail(res, aiError.retryable ? 503 : 422, aiError.code, aiError.message, aiError.retryable);
  }
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];

  if (req.method === 'GET' && path === '/health') {
    send(res, 200, { ok: true, mode: MOCK ? 'mock' : client ? 'live' : 'no_key', model: MOCK ? 'mock' : MODEL });
    return;
  }
  if (req.method === 'POST' && path === '/v1/process') {
    handleProcess(req, res).catch(() => fail(res, 500, 'server_error', 'Unexpected server error.', true));
    return;
  }
  fail(res, 404, 'not_found', 'Use POST /v1/process or GET /health.');
});

// Uploading a 25 MB PDF on a slow Wi-Fi can take a while; the answer itself may take minutes.
server.requestTimeout = 120_000;

server.listen(PORT, HOST, () => {
  const mode = MOCK ? 'örnek içerik (--mock)' : client ? `canlı · ${MODEL}` : 'anahtar yok (istekler 503 döner)';
  console.log(`StudyMark AI geliştirme sunucusu: http://${HOST}:${PORT} · ${mode}`);
});
