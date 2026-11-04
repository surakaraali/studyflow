import { getDb } from '@/db/client';

/** Fewer answers than this say little about a course or topic. */
const MIN_ANSWERS = 3;
/** Only recent quizzes count (BR-11 "son doğru oranı"). */
const WINDOW_DAYS = 60;

type AttemptRow = { course_id: string; question_ids: string; answers: string };
type QuestionRow = { id: string; correct_index: number; topic: string | null };
type TopicRow = { id: string; course_id: string; name: string };

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalize(name: string) {
  return name.trim().toLocaleLowerCase('tr-TR');
}

/**
 * Recent correct-answer rate per course and per topic (0…1), from finished quiz attempts.
 * Questions carry a topic name; it is matched to the course's topic list by name.
 */
export async function loadAccuracy(
  now: Date,
): Promise<{ course: Record<string, number>; topic: Record<string, number> }> {
  const db = getDb();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();

  const attempts = await db.getAllAsync<AttemptRow>(
    `SELECT q.course_id, a.question_ids, a.answers
     FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.deleted_at IS NULL AND q.deleted_at IS NULL
       AND a.status = 'done' AND a.finished_at >= ?
     ORDER BY a.finished_at DESC LIMIT 200`,
    since,
  );
  if (attempts.length === 0) return { course: {}, topic: {} };

  const questions = await db.getAllAsync<QuestionRow>(
    `SELECT id, correct_index, topic FROM questions WHERE quiz_id IN (
       SELECT a.quiz_id FROM quiz_attempts a
       WHERE a.deleted_at IS NULL AND a.status = 'done' AND a.finished_at >= ?
     )`,
    since,
  );
  const topics = await db.getAllAsync<TopicRow>(
    'SELECT id, course_id, name FROM topics WHERE deleted_at IS NULL',
  );

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const topicByName = new Map(topics.map((t) => [`${t.course_id}|${normalize(t.name)}`, t.id]));
  const courseTally = new Map<string, { correct: number; total: number }>();
  const topicTally = new Map<string, { correct: number; total: number }>();
  const add = (map: Map<string, { correct: number; total: number }>, key: string, ok: boolean) => {
    const tally = map.get(key) ?? { correct: 0, total: 0 };
    tally.total += 1;
    if (ok) tally.correct += 1;
    map.set(key, tally);
  };

  for (const attempt of attempts) {
    const ids = parseJson<string[]>(attempt.question_ids, []);
    const answers = parseJson<Record<string, number | null>>(attempt.answers, {});
    for (const id of ids) {
      const question = questionById.get(id);
      if (!question) continue;
      const ok = answers[id] === question.correct_index;
      add(courseTally, attempt.course_id, ok);
      const topicId = question.topic
        ? topicByName.get(`${attempt.course_id}|${normalize(question.topic)}`)
        : undefined;
      if (topicId) add(topicTally, topicId, ok);
    }
  }

  const toRates = (map: Map<string, { correct: number; total: number }>) => {
    const out: Record<string, number> = {};
    map.forEach((tally, key) => {
      if (tally.total >= MIN_ANSWERS) out[key] = tally.correct / tally.total;
    });
    return out;
  };
  return { course: toRates(courseTally), topic: toRates(topicTally) };
}
