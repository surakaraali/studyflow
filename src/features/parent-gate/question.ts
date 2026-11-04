/**
 * Parent gate question (US-19, BR-19): a multiplication written in Turkish words,
 * e.g. "On iki çarpı yedi kaç eder?". Pure functions so they can be unit tested.
 */

import { PARENT_GATE_ATTEMPTS, PARENT_GATE_LOCK_MS } from '@/domain/rules';

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

/** 0–999 as words. "bir yüz" is just "yüz" in Turkish. */
function belowThousand(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  if (hundreds > 0) {
    if (hundreds > 1) words.push(ONES[hundreds]);
    words.push('yüz');
  }
  if (tens > 0) words.push(TENS[tens]);
  if (ones > 0) words.push(ONES[ones]);
  return words;
}

/** Whole numbers from 0 to 999 999 999 in Turkish words: 1984 → "bin dokuz yüz seksen dört". */
export function numberToTurkishWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 1_000_000_000) {
    throw new RangeError(`Unsupported number: ${value}`);
  }
  if (value === 0) return 'sıfır';

  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const rest = value % 1000;
  const words: string[] = [];

  if (millions > 0) words.push(...belowThousand(millions), 'milyon');
  if (thousands > 0) {
    // "bin", not "bir bin"
    if (thousands > 1) words.push(...belowThousand(thousands));
    words.push('bin');
  }
  words.push(...belowThousand(rest));
  return words.join(' ');
}

/** Capitalizes the first letter with Turkish rules (i → İ). */
export function capitalizeTr(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

export type GateQuestion = { a: number; b: number; answer: number };

function randomInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * A two-digit number (11–29, never a round ten) times a one-digit number (3–9).
 * Hard enough to need an adult's attention, easy enough to do in your head.
 */
export function makeGateQuestion(random: () => number = Math.random): GateQuestion {
  let a = randomInt(random, 11, 29);
  if (a % 10 === 0) a += 1;
  const b = randomInt(random, 3, 9);
  return { a, b, answer: a * b };
}

/** Parses what was typed on the keypad. Empty or non-numeric input is never correct. */
export function isCorrectAnswer(question: GateQuestion, typed: string): boolean {
  if (!/^\d{1,4}$/.test(typed)) return false;
  return Number(typed) === question.answer;
}

export type GateLock = { wrong: number; lockedUntil: number | null };

export const initialGateLock: GateLock = { wrong: 0, lockedUntil: null };

/** Records a wrong answer; the third one locks the gate for a minute. */
export function registerWrongAnswer(state: GateLock, now: number): GateLock {
  const wrong = state.wrong + 1;
  if (wrong >= PARENT_GATE_ATTEMPTS) return { wrong: 0, lockedUntil: now + PARENT_GATE_LOCK_MS };
  return { wrong, lockedUntil: null };
}

export function lockRemainingMs(state: GateLock, now: number): number {
  if (state.lockedUntil == null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

export function attemptsLeft(state: GateLock): number {
  return PARENT_GATE_ATTEMPTS - state.wrong;
}
