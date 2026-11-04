/**
 * Small HTTP helpers shared by the Edge Functions: JSON responses, typed errors and body parsing.
 * Error bodies carry a stable `error` code the app and the consent page map to Turkish copy.
 */

import { corsHeaders } from './cors.ts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.code }, error.status);
  }
  // Never echo internal details to the caller, and mask addresses in the log (PRIV-08):
  // database errors can quote the row that failed.
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  console.error('Unhandled error', maskEmails(message));
  return json({ error: 'internal' }, 500);
}

/** Reads a JSON object body; rejects bodies over `maxBytes` (default 16 KB). */
export async function readJson<T extends Record<string, unknown>>(req: Request, maxBytes = 16_384): Promise<Partial<T>> {
  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > maxBytes) throw new HttpError(413, 'too_large');
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new HttpError(400, 'invalid_body');
  }
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  if (!text.trim()) return {};
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value as Partial<T>;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function requireMethod(req: Request, ...methods: string[]) {
  if (!methods.includes(req.method)) throw new HttpError(405, 'method_not_allowed');
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same rule as isValidEmail in src/domain/rules.ts. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** "a***@example.com" for logs (PRIV-08). */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain ?? ''}`;
}

export function maskEmails(text: string): string {
  return text.replace(/[^\s@"'(),]+@[^\s@"'(),]+\.[A-Za-z]{2,}/g, (match) => maskEmail(match));
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * The caller's address, stored with consent records as evidence (BRD §10.1). Prefers the headers
 * set by the platform's proxy; X-Forwarded-For can be extended by the client, so it is the last
 * resort. Never used for access decisions.
 */
export function clientIp(req: Request): string | null {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    // Only plain IPv4/IPv6 literals go into the inet column.
    if (value && /^[0-9a-fA-F:.]{3,45}$/.test(value)) return value;
  }
  return null;
}
