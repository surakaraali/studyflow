import type Anthropic from '@anthropic-ai/sdk';

import { processDocument } from '../../supabase/functions/_shared/ai/process.ts';
import { AiError } from '../../supabase/functions/_shared/ai/types.ts';
import { buildMockResult } from '../mock.ts';

const input = {
  pdf: 'JVBERi0xLjQK',
  grade: 8,
  segment: 'ortaokul' as const,
  courseName: 'Fen Bilimleri',
  optionCount: 4,
  quizCount: 10,
  cardCount: 15,
  pageCount: 6,
};

type Params = {
  system: { text: string }[];
  messages: { content: { type: string; text?: string }[] }[];
  output_config: unknown;
  max_tokens: number;
};

function taskOf(params: Params): 'summary' | 'quiz' | 'cards' {
  const text = params.messages[0].content.find((b) => b.type === 'text')?.text ?? '';
  if (text.startsWith('Görev: ÖZET')) return 'summary';
  if (text.startsWith('Görev: QUIZ')) return 'quiz';
  return 'cards';
}

/** A stand-in for client.beta.messages.stream that answers from the mock generator. */
function fakeClient(answer: (task: string) => object, calls: Params[] = []) {
  const sample = buildMockResult(input);
  const stream = (params: Params, options: { signal?: AbortSignal }) => {
    calls.push(params);
    const listeners: (() => void)[] = [];
    const task = taskOf(params);
    const body = {
      flagged: false,
      flag_reason: '',
      sections: task === 'summary' ? sample.summary.sections : [],
      questions: task === 'quiz' ? sample.quiz.questions : [],
      cards: task === 'cards' ? sample.cards.cards : [],
      ...answer(task),
    };
    return {
      on: (_event: string, cb: () => void) => listeners.push(cb),
      finalMessage: async () => {
        await Promise.resolve();
        listeners.forEach((cb) => cb());
        await new Promise((r) => setTimeout(r, 5));
        if (options.signal?.aborted) throw new Error('aborted');
        return {
          model: 'claude-opus-5-5',
          stop_reason: 'end_turn',
          stop_details: null,
          content: [{ type: 'text', text: JSON.stringify(body) }],
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            cache_read_input_tokens: task === 'summary' ? 0 : 5000,
            cache_creation_input_tokens: task === 'summary' ? 5000 : 0,
            iterations: null,
          },
        };
      },
    };
  };
  return { beta: { messages: { stream } } } as unknown as Anthropic;
}

describe('processDocument', () => {
  it('runs three requests that share the cached prefix', async () => {
    const calls: Params[] = [];
    const result = await processDocument(fakeClient(() => ({}), calls), input);

    expect(result.flagged).toBeNull();
    expect(result.quiz.questions).toHaveLength(10);
    expect(result.cards.cards).toHaveLength(15);
    expect(result.usage.map((u) => u.task).sort()).toEqual(['cards', 'quiz', 'summary']);

    expect(calls).toHaveLength(3);
    const prefix = (p: Params) =>
      JSON.stringify({ system: p.system, document: p.messages[0].content[0], format: p.output_config, max: p.max_tokens });
    expect(new Set(calls.map(prefix)).size).toBe(1);
    expect(calls[0].messages[0].content[0]).toMatchObject({ type: 'document', cache_control: { type: 'ephemeral' } });
  });

  it('keeps personal data out of the prompt', async () => {
    const calls: Params[] = [];
    await processDocument(fakeClient(() => ({}), calls), input);
    const sent = JSON.stringify(calls);
    expect(sent).not.toMatch(/@|nickname|birth|e-?posta adresi/i);
  });

  it('stops with a flag when the document is not suitable for minors', async () => {
    const result = await processDocument(
      fakeClient((task) => (task === 'summary' ? { flagged: true, flag_reason: 'Uygunsuz', sections: [] } : {})),
      input,
    );
    expect(result.flagged).toEqual({ reason: 'Uygunsuz' });
    expect(result.quiz.questions).toEqual([]);
  });

  it('asks for a retry when too few questions survive validation', async () => {
    const promise = processDocument(
      fakeClient((task) => (task === 'quiz' ? { questions: [{ stem: 'x', options: ['a'], correct_index: 0 }] } : {})),
      input,
    );
    await expect(promise).rejects.toMatchObject({ code: 'invalid_output', retryable: true });
    await promise.catch((error: AiError) => expect(error.usage).toHaveLength(3));
  });
});
