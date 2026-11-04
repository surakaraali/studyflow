import { validateCards, validateQuestions, validateSummary } from '../../supabase/functions/_shared/ai/validate.ts';
import { AiError } from '../../supabase/functions/_shared/ai/types.ts';
import { buildMockResult, MOCK_HEADING, MOCK_MARKERS } from '../mock.ts';
import { parseProcessRequest } from '../request.ts';

const input = {
  grade: 8,
  segment: 'ortaokul' as const,
  courseName: 'Fen Bilimleri',
  optionCount: 4,
  quizCount: 10,
  cardCount: 15,
  pageCount: 6,
};

describe('mock generator', () => {
  it('returns the requested counts in a shape that passes validation', () => {
    const result = buildMockResult(input);
    expect(result.flagged).toBeNull();
    expect(result.summary.sections[0].heading).toBe(MOCK_HEADING);

    expect(validateSummary(result.summary.sections, { pageCount: 6 }).sections).toHaveLength(result.summary.sections.length);
    expect(validateQuestions(result.quiz.questions, { optionCount: 4, max: 10, pageCount: 6 }).questions).toHaveLength(10);
    expect(validateCards(result.cards.cards, { max: 15, pageCount: 6 }).cards).toHaveLength(15);
    expect(result.usage.map((u) => u.task)).toEqual(['summary', 'quiz', 'cards']);
  });

  it('follows the segment option count', () => {
    const result = buildMockResult({ ...input, grade: 11, segment: 'lise', optionCount: 5 });
    expect(result.quiz.questions.every((q) => q.options.length === 5)).toBe(true);
  });

  it('is deterministic', () => {
    expect(buildMockResult(input)).toEqual(buildMockResult(input));
  });

  it('can simulate a flagged document and a provider outage', () => {
    const flagged = buildMockResult({ ...input, courseName: `Test ${MOCK_MARKERS.flagged}` });
    expect(flagged.flagged).not.toBeNull();
    expect(flagged.quiz.questions).toEqual([]);

    expect(() => buildMockResult({ ...input, courseName: `Test ${MOCK_MARKERS.retryableError}` })).toThrow(AiError);
  });
});

describe('parseProcessRequest', () => {
  const body = { pdf: 'JVBERi0=', ...input };

  it('accepts a valid body and drops unknown fields', () => {
    const parsed = parseProcessRequest({ ...body, email: 'x@y.z' });
    expect('input' in parsed && Object.keys(parsed.input).sort()).toEqual(
      ['cardCount', 'courseName', 'grade', 'optionCount', 'pageCount', 'pdf', 'quizCount', 'segment'],
    );
  });

  it.each([
    [{ ...body, pdf: '' }],
    [{ ...body, grade: 13 }],
    [{ ...body, segment: 'universite' }],
    [{ ...body, optionCount: 6 }],
    [null],
  ])('rejects %p', (bad) => {
    expect('error' in parseProcessRequest(bad)).toBe(true);
  });
});
