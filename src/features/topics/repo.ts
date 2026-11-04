/**
 * Topics of a course, entered by hand (supports US-26 and BR-11; the grade template is R1.1).
 * Difficulty: 1 easy, 2 medium, 3 hard.
 */

import { getDb } from '@/db/client';
import { newId } from '@/db/ids';
import type { Topic } from '@/db/types';
import { patch, softDelete, upsert } from '@/db/write';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';

export type TopicDifficulty = 1 | 2 | 3;
export const TOPIC_NAME_MAX = 60;

/** A course's topics in the student's order. */
export async function listTopics(courseId: string): Promise<Topic[]> {
  return getDb().getAllAsync<Topic>(
    'SELECT * FROM topics WHERE course_id = ? AND deleted_at IS NULL ORDER BY sort, created_at',
    courseId,
  );
}

export async function addTopic(
  courseId: string,
  name: string,
  difficulty: TopicDifficulty = 2,
): Promise<string> {
  const last = await getDb().getFirstAsync<{ sort: number | null }>(
    'SELECT MAX(sort) AS sort FROM topics WHERE course_id = ? AND deleted_at IS NULL',
    courseId,
  );
  const id = newId();
  await upsert('topics', {
    id,
    course_id: courseId,
    name: name.trim(),
    difficulty,
    sort: (last?.sort ?? -1) + 1,
  });
  schedulePlanRegeneration('topics');
  return id;
}

export async function updateTopic(
  id: string,
  changes: { name?: string; difficulty?: TopicDifficulty },
) {
  const values: Record<string, unknown> = {};
  if (changes.name != null) values.name = changes.name.trim();
  if (changes.difficulty != null) values.difficulty = changes.difficulty;
  await patch('topics', id, values);
  schedulePlanRegeneration('topics');
}

/** Removes the topic and takes it out of the exams that listed it. */
export async function deleteTopic(id: string) {
  const exams = await getDb().getAllAsync<{ id: string; topic_ids: string }>(
    `SELECT id, topic_ids FROM exams WHERE deleted_at IS NULL AND topic_ids LIKE ?`,
    `%${id}%`,
  );
  for (const exam of exams) {
    const ids = parseIds(exam.topic_ids).filter((t) => t !== id);
    await patch('exams', exam.id, { topic_ids: JSON.stringify(ids) });
  }
  await softDelete('topics', id);
  schedulePlanRegeneration('topics');
}

/** Moves a topic one place up (-1) or down (+1) and renumbers the list. */
export async function moveTopic(courseId: string, id: string, direction: -1 | 1) {
  const topics = await listTopics(courseId);
  const from = topics.findIndex((t) => t.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= topics.length) return;
  const order = [...topics];
  [order[from], order[to]] = [order[to], order[from]];
  for (const [index, topic] of order.entries()) {
    if (topic.sort !== index) await patch('topics', topic.id, { sort: index });
  }
  schedulePlanRegeneration('topics');
}

function parseIds(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
