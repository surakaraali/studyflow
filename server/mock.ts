/**
 * Deterministic sample content for `npm run ai:mock`, so every flow (summary, quiz, cards,
 * flagged documents, retries) can be tried without an API key. Everything is clearly marked as
 * development sample content.
 */

import { AiError, type ProcessInput, type ProcessResult } from '../supabase/functions/_shared/ai/types.ts';

export const MOCK_HEADING = 'Örnek içerik (geliştirme modu)';
export const MOCK_MODEL = 'mock';

/** Put one of these in a course name to try the other outcomes. */
export const MOCK_MARKERS = {
  flagged: '#uygunsuz',
  retryableError: '#hata',
} as const;

type MockInput = Omit<ProcessInput, 'pdf'>;

function page(i: number, pageCount: number): number {
  return (i % Math.max(1, pageCount)) + 1;
}

export function buildMockResult(input: MockInput): ProcessResult {
  const course = input.courseName.trim() || 'Ders';

  if (course.includes(MOCK_MARKERS.retryableError)) {
    throw new AiError('provider_unavailable', 'Mock: simulated provider outage.');
  }

  const usage = (['summary', 'quiz', 'cards'] as const).map((task) => ({
    task,
    model: MOCK_MODEL,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    duration_ms: 0,
    cost_usd: 0,
  }));

  if (course.includes(MOCK_MARKERS.flagged)) {
    return {
      summary: { sections: [] },
      quiz: { questions: [] },
      cards: { cards: [] },
      usage,
      flagged: { reason: 'Örnek: bu belge geliştirme modunda uygunsuz olarak işaretlendi.' },
    };
  }

  const sections = [
    {
      heading: MOCK_HEADING,
      paragraphs: [
        `Bu metin gerçek bir özet değil. ${course} dersi için ${input.grade}. sınıf düzeyinde örnek içerik gösteriliyor.`,
        'Gerçek özet için geliştirme sunucusunu API anahtarıyla başlat: npm run ai:dev.',
      ],
      key_terms: ['örnek içerik', 'geliştirme modu'],
      pages: [1],
    },
    {
      heading: 'Anahtar kavramlar nasıl görünür',
      paragraphs: [
        `Özette anahtar kavram fosforlu kalemle işaretlenir. ${course} notlarındaki önemli terimler burada görünür.`,
      ],
      key_terms: ['anahtar kavram', 'fosforlu kalem'],
      pages: [page(1, input.pageCount)],
    },
  ];

  const questions = Array.from({ length: input.quizCount }, (_, i) => {
    const correct = i % input.optionCount;
    return {
      stem: `Örnek soru ${i + 1}: ${course} için geliştirme modunda hangi şık doğrudur?`,
      options: Array.from({ length: input.optionCount }, (_, j) =>
        j === correct ? `Doğru şık (örnek ${i + 1})` : `Yanlış şık ${j + 1} (örnek ${i + 1})`,
      ),
      correct_index: correct,
      explanation: 'Bu bir örnek sorudur; doğru şık her soruda farklı sıradadır.',
      source_page: page(i, input.pageCount),
      topic: 'Örnek konu',
    };
  });

  const cards = Array.from({ length: input.cardCount }, (_, i) => ({
    front: `Örnek kart ${i + 1}: ${course} kavramı`,
    back: `Örnek cevap ${i + 1} (geliştirme modu)`,
    source_page: page(i, input.pageCount),
  }));

  return {
    summary: { sections },
    quiz: { questions },
    cards: { cards },
    usage,
    flagged: null,
  };
}
