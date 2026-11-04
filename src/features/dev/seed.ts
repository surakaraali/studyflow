/**
 * Demo data for local mode: a signed-in 11th grader with courses, a school timetable,
 * exams, homework, one processed document (summary, quiz, cards) and two weeks of history.
 *
 * Used to check screens in the simulator and as the App Review demo account (US-69).
 * Never runs outside local development mode.
 */

import { getDb } from '@/db/client';
import { notifyAll } from '@/db/events';
import { newId, nowIso } from '@/db/ids';
import { patch, upsert } from '@/db/write';
import { quotaMonth } from '@/domain/rules';
import { addCatalogCourses, listCourses } from '@/features/courses/repo';
import { saveExam } from '@/features/exams/repo';
import { syncOfficialExams } from '@/features/exams/official';
import { saveHomework } from '@/features/homework/repo';
import { schedulePlanRegeneration } from '@/features/plan/regenerate';
import { saveTimetable } from '@/features/timetable/repo';
import { addTopic } from '@/features/topics/repo';
import { addDays, todayString } from '@/lib/dates';
import { auth, markEmailVerifiedLocally } from '@/services/auth';
import { isLocalMode } from '@/services/config';
import { startSession, useSession } from '@/stores/session';

export type SeedMode = 'full' | 'limited' | 'locked' | 'fresh';

const DEMO_PASSWORD = 'studyflow-demo';

export function seedAvailable(): boolean {
  return __DEV__ && isLocalMode;
}

async function signInDemo(mode: SeedMode) {
  const email = `demo-${mode}@studyflow.local`;
  const signUp = await auth.signUp(email, DEMO_PASSWORD);
  if (!signUp.ok && signUp.error !== 'email_exists') throw new Error(signUp.error);
  await markEmailVerifiedLocally(email);
  const result = await auth.signIn(email, DEMO_PASSWORD);
  if (!result.ok) throw new Error(result.error);
  await startSession(result.user);
  return result.user;
}

/** Returns true when the account already has data, so seeding twice does nothing. */
async function alreadySeeded(): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM courses WHERE deleted_at IS NULL',
  );
  return (row?.n ?? 0) > 0;
}

async function seedProfile(userId: string, mode: SeedMode) {
  const now = nowIso();
  const base = {
    nickname: 'Deniz',
    daily_goal_min: 120,
    block_min: 40,
    break_min: 10,
    bedtime: '23:30',
    wake_time: '07:00',
    notif_permission_asked: 1,
    ai_notice_accepted_at: now,
  };

  if (mode === 'locked') {
    await patch('profile', userId, {
      ...base,
      grade: 6,
      segment: 'ortaokul',
      birth_year: new Date().getFullYear() - 11,
      block_min: 25,
      break_min: 5,
      daily_goal_min: 60,
      bedtime: '22:00',
      consent_status: 'pending',
      parent_email: 'veli@ornek.com',
      onboarding_done: 1,
    });
    return;
  }

  await patch('profile', userId, {
    ...base,
    grade: 11,
    segment: 'lise',
    track: 'sayisal',
    target_exam: 'YKS',
    birth_year: new Date().getFullYear() - 16,
    consent_status: mode === 'limited' ? 'pending' : 'granted',
    parent_email: 'veli@ornek.com',
    onboarding_done: 1,
  });

  if (mode !== 'limited') {
    await upsert('consent_records', {
      id: newId(),
      parent_email: 'veli@ornek.com',
      action: 'granted',
      purposes: JSON.stringify(['ai', 'notifications']),
      text_version: '1.0',
    });
  }
}

type SampleQuestion = {
  stem: string;
  options: string[];
  correct: number;
  explanation: string;
  page: number;
  topic: string;
};

const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    stem: 'Mitoz bölünmenin sonunda bir hücreden kaç yeni hücre oluşur?',
    options: ['1', '2', '3', '4', '8'],
    correct: 1,
    explanation: 'Mitozda bir hücre bölünür ve kalıtsal olarak birbirinin aynısı iki hücre oluşur.',
    page: 2,
    topic: 'Mitoz',
  },
  {
    stem: 'Kromozomların hücrenin ortasında (ekvator düzleminde) dizildiği evre hangisidir?',
    options: ['Profaz', 'Metafaz', 'Anafaz', 'Telofaz', 'İnterfaz'],
    correct: 1,
    explanation: 'Metafazda kromozomlar en kısa ve kalın hâlindedir, ekvator düzleminde dizilir.',
    page: 3,
    topic: 'Mitoz',
  },
  {
    stem: 'DNA eşlenmesi hücre döngüsünün hangi aşamasında gerçekleşir?',
    options: ['G1 evresi', 'S evresi', 'G2 evresi', 'Metafaz', 'Sitokinez'],
    correct: 1,
    explanation: 'S (sentez) evresinde DNA kendini eşler; böylece her kromozom iki kromatitli olur.',
    page: 1,
    topic: 'Hücre döngüsü',
  },
  {
    stem: 'Mayoz bölünmenin sonunda oluşan hücrelerle ilgili hangisi doğrudur?',
    options: [
      'Ana hücreyle aynı kromozom sayısına sahiptir',
      'Ana hücrenin yarısı kadar kromozom taşır',
      'İki hücre oluşur',
      'Hepsi birbirinin aynısıdır',
      'Yalnızca vücut hücrelerinde görülür',
    ],
    correct: 1,
    explanation: 'Mayozda kromozom sayısı yarıya iner; dört hücre oluşur ve bunlar genetik olarak farklıdır.',
    page: 4,
    topic: 'Mayoz',
  },
  {
    stem: 'Krossing over (parça değişimi) hangi evrede görülür?',
    options: ['Mitoz profaz', 'Mayoz I profaz', 'Mayoz II metafaz', 'İnterfaz', 'Mitoz anafaz'],
    correct: 1,
    explanation: 'Homolog kromozomlar Mayoz I profazında yan yana gelir ve parça değişimi yapar.',
    page: 4,
    topic: 'Mayoz',
  },
  {
    stem: 'Bitki hücrelerinde sitoplazma bölünmesi nasıl gerçekleşir?',
    options: [
      'Boğumlanarak',
      'Ara lamel (hücre plağı) oluşarak',
      'Sentrozom ile',
      'Tomurcuklanarak',
      'Çekirdek zarı ile',
    ],
    correct: 1,
    explanation: 'Bitki hücrelerinde hücre duvarı olduğu için sitoplazma ortada oluşan ara lamelle bölünür.',
    page: 3,
    topic: 'Mitoz',
  },
  {
    stem: 'Kardeş kromatitlerin zıt kutuplara çekildiği evre hangisidir?',
    options: ['Profaz', 'Metafaz', 'Anafaz', 'Telofaz', 'G1'],
    correct: 2,
    explanation: 'Anafazda iğ iplikleri kısalır ve kardeş kromatitler zıt kutuplara çekilir.',
    page: 3,
    topic: 'Mitoz',
  },
  {
    stem: 'Hangisi mitozun canlı için sağladıklarından biri değildir?',
    options: ['Büyüme', 'Yara onarımı', 'Eşeysiz üreme', 'Genetik çeşitlilik', 'Doku yenilenmesi'],
    correct: 3,
    explanation: 'Mitozla oluşan hücreler birbirinin aynısıdır; genetik çeşitlilik mayoz ve döllenmeyle sağlanır.',
    page: 2,
    topic: 'Mitoz',
  },
  {
    stem: 'İnsanda mayozla oluşan bir yumurta hücresinde kaç kromozom bulunur?',
    options: ['23', '46', '92', '22', '44'],
    correct: 0,
    explanation: 'İnsan vücut hücrelerinde 46 kromozom vardır; üreme hücreleri bunun yarısını, 23 kromozom taşır.',
    page: 5,
    topic: 'Mayoz',
  },
  {
    stem: 'Hücre döngüsünde en uzun süren aşama genellikle hangisidir?',
    options: ['Profaz', 'Metafaz', 'İnterfaz', 'Anafaz', 'Telofaz'],
    correct: 2,
    explanation: 'Hücre ömrünün büyük kısmını interfazda geçirir; büyüme ve DNA eşlenmesi bu aşamadadır.',
    page: 1,
    topic: 'Hücre döngüsü',
  },
];

const SAMPLE_CARDS: [string, string, number][] = [
  ['İnterfaz', 'Bölünmeye hazırlık aşaması: hücre büyür, DNA eşlenir (G1, S, G2).', 1],
  ['S evresi', 'DNA eşlenmesinin olduğu interfaz evresi.', 1],
  ['Metafaz', 'Kromozomların ekvator düzleminde dizildiği evre.', 3],
  ['Anafaz', 'Kardeş kromatitlerin zıt kutuplara çekildiği evre.', 3],
  ['Sitokinez', 'Sitoplazmanın bölünmesi; hayvanda boğumlanma, bitkide ara lamel.', 3],
  ['Mayozun sonucu', 'Kromozom sayısı yarıya inmiş, genetik olarak farklı 4 hücre.', 4],
  ['Krossing over', 'Mayoz I profazında homolog kromozomlar arasında parça değişimi.', 4],
  ['Homolog kromozom', 'Biri anneden biri babadan gelen, aynı genleri taşıyan kromozom çifti.', 4],
];

async function seedDocument(courseId: string, topicId: string | null) {
  const now = nowIso();
  const docId = newId();
  await upsert('documents', {
    id: docId,
    course_id: courseId,
    topic_id: topicId,
    title: 'Örnek belge: Hücre bölünmesi',
    file_uri: null,
    storage_path: null,
    size_bytes: 1_250_000,
    page_count: 5,
    page_from: 1,
    page_to: 5,
    status: 'ready',
    error_code: null,
    attempts: 1,
    next_attempt_at: null,
    quota_month: quotaMonth(),
    counted: 1,
    under_review: 0,
  });

  await upsert('summaries', {
    id: newId(),
    document_id: docId,
    content: JSON.stringify({
      sections: [
        {
          heading: 'Hücre döngüsü',
          paragraphs: [
            'Hücreler büyür, kalıtsal bilgisini eşler ve bölünür. Bu sürece hücre döngüsü denir.',
            'Döngünün en uzun kısmı interfazdır. G1 evresinde hücre büyür, S evresinde DNA eşlenir, G2 evresinde bölünmeye hazırlanır.',
          ],
          key_terms: ['interfaz', 'S evresi', 'DNA eşlenmesi'],
          pages: [1],
        },
        {
          heading: 'Mitoz',
          paragraphs: [
            'Mitozda bir hücreden kalıtsal olarak aynı iki hücre oluşur. Büyüme, yara onarımı ve eşeysiz üremeyi sağlar.',
            'Evreler sırasıyla profaz, metafaz, anafaz ve telofazdır. Ardından sitoplazma bölünür (sitokinez).',
          ],
          key_terms: ['mitoz', 'metafaz', 'anafaz', 'sitokinez'],
          pages: [2, 3],
        },
        {
          heading: 'Mayoz',
          paragraphs: [
            'Mayoz üreme hücrelerini oluşturur. Kromozom sayısı yarıya iner ve dört farklı hücre oluşur.',
            'Mayoz I profazında homolog kromozomlar arasında parça değişimi (krossing over) olur; bu çeşitliliği artırır.',
          ],
          key_terms: ['mayoz', 'homolog kromozom', 'krossing over'],
          pages: [4, 5],
        },
      ],
    }),
  });

  const quizId = newId();
  await upsert('quizzes', { id: quizId, document_id: docId, course_id: courseId, title: 'Hücre bölünmesi' });
  const questionIds: string[] = [];
  for (const [index, q] of SAMPLE_QUESTIONS.entries()) {
    const id = newId();
    questionIds.push(id);
    await upsert('questions', {
      id,
      quiz_id: quizId,
      stem: q.stem,
      options: JSON.stringify(q.options),
      correct_index: q.correct,
      explanation: q.explanation,
      source_page: q.page,
      topic: q.topic,
      sort: index,
      edited: 0,
      hidden: 0,
    });
  }

  // One finished attempt three days ago: 7 correct, 2 wrong, 1 blank.
  const answers: Record<string, number | null> = {};
  questionIds.forEach((id, index) => {
    const q = SAMPLE_QUESTIONS[index];
    answers[id] = index < 7 ? q.correct : index < 9 ? (q.correct + 1) % q.options.length : null;
  });
  const started = new Date(Date.now() - 3 * 86_400_000);
  await upsert('quiz_attempts', {
    id: newId(),
    quiz_id: quizId,
    question_ids: JSON.stringify(questionIds),
    answers: JSON.stringify(answers),
    current_index: questionIds.length,
    status: 'done',
    correct: 7,
    wrong: 2,
    blank: 1,
    duration_sec: 540,
    retry_of: null,
    started_at: started.toISOString(),
    finished_at: new Date(started.getTime() + 540_000).toISOString(),
  });

  const deckId = newId();
  await upsert('decks', { id: deckId, course_id: courseId, name: 'Biyoloji' });
  for (const [front, back, page] of SAMPLE_CARDS) {
    await upsert('cards', {
      id: newId(),
      deck_id: deckId,
      document_id: docId,
      front,
      back,
      source_page: page,
      ai_generated: 1,
      edited: 0,
      hidden: 0,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: null,
    });
  }
}

/** Two weeks of past study: sessions and finished blocks, so Progress and the streak have data. */
async function seedHistory(courseIds: string[]) {
  const today = todayString();
  const pattern = [0, 40, 80, 40, 0, 120, 80, 40, 80, 40, 120, 40, 80];
  for (let i = 1; i <= pattern.length; i++) {
    const minutes = pattern[pattern.length - i];
    if (!minutes) continue;
    const date = addDays(today, -i);
    const blocks = minutes / 40;
    for (let b = 0; b < blocks; b++) {
      const courseId = courseIds[(i + b) % courseIds.length];
      const start = `${String(17 + b).padStart(2, '0')}:00`;
      const end = `${String(17 + b).padStart(2, '0')}:40`;
      const planItemId = newId();
      await upsert('plan_items', {
        id: planItemId,
        date,
        start_time: start,
        end_time: end,
        minutes: 40,
        break_min: 10,
        kind: 'study',
        course_id: courseId,
        topic_id: null,
        exam_id: null,
        homework_id: null,
        status: 'done',
        source: 'auto',
        carried_from: null,
      });
      await upsert('study_sessions', {
        id: newId(),
        course_id: courseId,
        topic_id: null,
        plan_item_id: planItemId,
        date,
        minutes: 40,
        source: 'timer',
        started_at: `${date}T${start}:00`,
        ended_at: `${date}T${end}:00`,
      });
    }
  }
}

/** Creates (or reuses) the demo account for `mode` and fills it with sample data. */
export async function runSeed(mode: SeedMode): Promise<void> {
  if (!seedAvailable()) throw new Error('Demo data is only available in local development mode');

  const user = await signInDemo(mode);
  if (mode === 'fresh') return;
  if (await alreadySeeded()) return;

  await seedProfile(user.id, mode);
  if (mode === 'locked') {
    notifyAll();
    return;
  }

  await addCatalogCourses(['matematik', 'fizik', 'kimya', 'biyoloji', 'edebiyat', 'ingilizce']);
  const courses = await listCourses();
  const byKey = new Map(courses.map((c) => [c.catalog_key, c.id]));
  const math = byKey.get('matematik')!;
  const physics = byKey.get('fizik')!;
  const chemistry = byKey.get('kimya')!;
  const biology = byKey.get('biyoloji')!;

  const topics = {
    physics: await addTopic(physics, 'Kuvvet ve hareket', 3),
    physics2: await addTopic(physics, 'İş, güç ve enerji', 2),
    math: await addTopic(math, 'Trigonometri', 3),
    math2: await addTopic(math, 'Fonksiyonlar', 2),
    chemistry: await addTopic(chemistry, 'Kimyasal tepkimeler', 2),
    biology: await addTopic(biology, 'Hücre bölünmesi', 2),
  };

  // School: Monday–Friday 08:30–15:10 (US-23 scenario).
  const school = Object.fromEntries(
    [1, 2, 3, 4, 5].map((day) => [
      day,
      [{ key: `school-${day}`, course_id: null, start: '08:30', end: '15:10' }],
    ]),
  );
  await saveTimetable(school);

  const today = todayString();
  await saveExam({
    courseId: physics,
    kind: 'yazili',
    title: 'Fizik yazılısı',
    date: addDays(today, 4),
    time: '10:00',
    topicIds: [topics.physics, topics.physics2],
  });
  await saveExam({
    courseId: chemistry,
    kind: 'yazili',
    title: 'Kimya yazılısı',
    date: addDays(today, 20),
    time: null,
    topicIds: [topics.chemistry],
  });
  await saveExam({
    courseId: math,
    kind: 'quiz',
    title: 'Matematik kısa sınav',
    date: addDays(today, 9),
    time: null,
    topicIds: [topics.math],
  });
  await syncOfficialExams('YKS', 'sayisal');

  await saveHomework({ courseId: math, description: 'Trigonometri test 3, 20 soru', dueDate: addDays(today, 1) });
  await saveHomework({ courseId: biology, description: 'Hücre bölünmesi kavram haritası', dueDate: addDays(today, 3) });

  await seedDocument(biology, topics.biology);
  await seedHistory([math, physics, chemistry, biology]);

  schedulePlanRegeneration('seed');
  notifyAll();
}

/** Who is signed in right now (for the seed screen). */
export function currentEmail(): string | null {
  return useSession.getState().user?.email ?? null;
}
