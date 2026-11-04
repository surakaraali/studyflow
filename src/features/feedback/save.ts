import { newId } from '@/db/ids';
import { upsert } from '@/db/write';
import { deviceInfo } from '@/features/support/device-info';

import { susScore } from './sus';

export const FEEDBACK_TEXT_MIN = 5;
export const FEEDBACK_TEXT_MAX = 2000;

/** Free-text beta feedback (US-70), stored as a `feedback` row that syncs to the team. */
export async function saveFeedbackText(text: string): Promise<void> {
  const payload = { text: text.trim().slice(0, FEEDBACK_TEXT_MAX), ...deviceInfo() };
  await upsert('feedback', { id: newId(), kind: 'feedback', payload: JSON.stringify(payload) });
}

/** SUS answers and score. Throws when the questionnaire is not complete. */
export async function saveSus(answers: number[]): Promise<number> {
  const score = susScore(answers);
  if (score == null) throw new Error('SUS needs ten answers between 1 and 5');
  const payload = { answers, score, ...deviceInfo() };
  await upsert('feedback', { id: newId(), kind: 'sus', payload: JSON.stringify(payload) });
  return score;
}
