/**
 * Turns one PDF into a summary, a quiz and flashcards (US-32 – US-35).
 *
 * Runtime-agnostic: the caller passes in an Anthropic client (Node dev server or Deno Edge
 * Function). The package is resolved from node_modules in Node and from the function's
 * deno.json import map in Deno.
 *
 * Prompt caching (PLAN §3 rule 4): the three requests share the same system prompt, PDF block
 * (with the cache breakpoint), output schema, effort and max_tokens, so requests 2 and 3 read
 * the PDF from cache. A cache entry becomes readable once the first response starts streaming,
 * so the quiz and card requests start right after the summary request's first event.
 */

import Anthropic from '@anthropic-ai/sdk';

import { costUsd, DEFAULT_MODEL, type TokenUsage } from './pricing.ts';
import { systemPrompt, taskPrompt } from './prompts.ts';
import { STUDY_OUTPUT_SCHEMA, type StudyOutput } from './schemas.ts';
import { AiError, type AiTask, type ProcessInput, type ProcessResult, type UsageEntry } from './types.ts';
import { cleanText, minimumUsable, validateCards, validateQuestions, validateSummary } from './validate.ts';

export type ProcessOptions = {
  /** Defaults to claude-opus-5-5 (env AI_MODEL in the callers). */
  model?: string;
  signal?: AbortSignal;
};

/** Thinking counts toward max_tokens; streaming keeps a large limit safe from HTTP timeouts. */
const MAX_TOKENS = 64_000;

/** Thinking is always on for the current models; effort is the only depth control. */
const EFFORT = 'medium' as const;

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Haiku has no server-side fallback; the others retry a policy decline on another model. */
function usesServerFallback(model: string): boolean {
  return !model.startsWith('claude-haiku');
}

type TaskRun = { output: StudyOutput; usage: UsageEntry };

type Shared = {
  client: Anthropic;
  model: string;
  system: string;
  pdf: string;
  input: ProcessInput;
  signal?: AbortSignal;
};

function usageOf(task: AiTask, model: string, message: Anthropic.Beta.BetaMessage, durationMs: number): UsageEntry {
  const u = message.usage;
  const tokens: TokenUsage = {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  };

  // With a server-side fallback, part of the work may have run on another model.
  const iterations = (u.iterations ?? []).filter(
    (it): it is Anthropic.Beta.BetaMessageIterationUsage | Anthropic.Beta.BetaFallbackMessageIterationUsage =>
      it.type === 'message' || it.type === 'fallback_message',
  );
  const cost =
    iterations.length > 0
      ? iterations.reduce(
          (sum, it) =>
            sum +
            costUsd(it.model ?? model, {
              input_tokens: it.input_tokens,
              output_tokens: it.output_tokens,
              cache_read_tokens: it.cache_read_input_tokens,
              cache_write_tokens: it.cache_creation_input_tokens,
            }),
          0,
        )
      : costUsd(message.model, tokens);

  return {
    task,
    model: message.model,
    ...tokens,
    duration_ms: Math.round(durationMs),
    cost_usd: Math.round(cost * 1e6) / 1e6,
  };
}

function parseOutput(message: Anthropic.Beta.BetaMessage): StudyOutput {
  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  try {
    return JSON.parse(text) as StudyOutput;
  } catch {
    throw new AiError('invalid_output', 'The model answer was not valid JSON.');
  }
}

/** Maps SDK errors to our codes: retry on rate limits, overload, 5xx and connection problems. */
function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new AiError('provider_unavailable', 'Request aborted.');
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('server_config', 'The AI provider rejected the API key.');
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AiError('server_config', 'The configured model is not available.', false);
  }
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
    return new AiError('provider_unavailable', `AI provider busy (${error.status}).`);
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) {
    return new AiError('bad_request', 'The AI provider could not read this document.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError('provider_unavailable', 'Could not reach the AI provider.');
  }
  if (error instanceof Anthropic.APIError) {
    const retry = error.status === undefined || error.status === 413 ? false : error.status >= 500;
    return new AiError(retry ? 'provider_unavailable' : 'bad_request', `AI provider error (${error.status}).`, retry);
  }
  return new AiError('provider_unavailable', error instanceof Error ? error.message : 'Unknown AI error.');
}

function runTask(shared: Shared, task: AiTask, onStarted?: () => void): Promise<TaskRun> {
  const { client, model, system, pdf, input, signal } = shared;
  const started = Date.now();

  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system }],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdf },
              // Cache breakpoint: everything up to and including the PDF is shared by the 3 tasks.
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: taskPrompt(task, input) },
          ],
        },
      ],
      output_config: {
        effort: EFFORT,
        format: { type: 'json_schema', schema: STUDY_OUTPUT_SCHEMA },
      },
      ...(usesServerFallback(model) ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    },
    { signal },
  );

  if (onStarted) {
    let fired = false;
    stream.on('streamEvent', () => {
      if (fired) return;
      fired = true;
      onStarted();
    });
  }

  return stream.finalMessage().then(
    (message) => {
      const usage = usageOf(task, model, message, Date.now() - started);
      const fail = (error: AiError) => {
        error.usage = [usage];
        throw error;
      };
      if (message.stop_reason === 'refusal') {
        fail(new AiError('refused', `Declined (${message.stop_details?.category ?? 'unknown'}).`));
      }
      if (message.stop_reason === 'max_tokens') {
        fail(new AiError('truncated', 'The answer hit max_tokens.'));
      }
      try {
        return { output: parseOutput(message), usage };
      } catch (error) {
        return fail(toAiError(error));
      }
    },
    (error: unknown) => {
      throw toAiError(error);
    },
  );
}

/**
 * Runs the three tasks and validates the output. Throws `AiError` (with the usage collected so
 * far) when the job should be retried or has failed for good.
 */
export async function processDocument(
  client: Anthropic,
  input: ProcessInput,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const shared: Shared = {
    client,
    model: options.model || DEFAULT_MODEL,
    system: systemPrompt(input),
    pdf: input.pdf,
    input,
    signal: options.signal,
  };

  // The quiz and card requests get their own abort switch: they stop early when the summary
  // flags the document, so an inappropriate PDF costs one request instead of three.
  const others = new AbortController();
  options.signal?.addEventListener('abort', () => others.abort());
  const othersShared: Shared = { ...shared, signal: others.signal };

  let markStarted: (started: boolean) => void = () => {};
  const gate = new Promise<boolean>((resolve) => {
    markStarted = resolve;
  });

  const summary = runTask(shared, 'summary', () => markStarted(true));
  summary.then(
    (run) => {
      markStarted(true);
      if (run.output.flagged) others.abort();
    },
    // The summary failed before streaming: the others would fail the same way, skip them.
    () => markStarted(false),
  );
  const quiz = gate.then((started) => (started ? runTask(othersShared, 'quiz') : null));
  const cards = gate.then((started) => (started ? runTask(othersShared, 'cards') : null));

  const settled = await Promise.allSettled([summary, quiz, cards]);
  const usage: UsageEntry[] = [];
  let firstError: AiError | null = null;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      if (result.value) usage.push(result.value.usage);
    } else {
      const error = toAiError(result.reason);
      usage.push(...error.usage);
      // A non-retryable failure wins over a retryable one.
      if (!firstError || (firstError.retryable && !error.retryable)) firstError = error;
    }
  }

  // Moderation (SP-02): any task that flags the document stops the whole job.
  const runs = settled.map((r) => (r.status === 'fulfilled' ? r.value : null));
  const flaggedRun = runs.find((run) => run?.output.flagged === true);
  if (flaggedRun) {
    return {
      summary: { sections: [] },
      quiz: { questions: [] },
      cards: { cards: [] },
      usage,
      flagged: { reason: cleanText(flaggedRun.output.flag_reason) || 'Uygun olmayan içerik' },
    };
  }

  const [summaryRun, quizRun, cardsRun] = runs;
  if (firstError || !summaryRun || !quizRun || !cardsRun) {
    const error = firstError ?? new AiError('provider_unavailable', 'A request did not finish.');
    error.usage = usage;
    throw error;
  }

  const [s, q, c] = [summaryRun.output, quizRun.output, cardsRun.output];
  const { sections } = validateSummary(s.sections, { pageCount: input.pageCount });
  const { questions } = validateQuestions(q.questions, {
    optionCount: input.optionCount,
    max: input.quizCount,
    pageCount: input.pageCount,
  });
  const { cards: cardList } = validateCards(c.cards, { max: input.cardCount, pageCount: input.pageCount });

  const fail = (error: AiError): never => {
    error.usage = usage;
    throw error;
  };

  if (sections.length === 0 && questions.length === 0 && cardList.length === 0) {
    fail(new AiError('empty', 'No readable study content in the document.'));
  }
  if (sections.length === 0) fail(new AiError('invalid_output', 'Summary had no usable sections.'));
  if (questions.length < minimumUsable(input.quizCount)) {
    fail(new AiError('invalid_output', `Only ${questions.length} usable questions.`));
  }
  if (cardList.length < minimumUsable(input.cardCount)) {
    fail(new AiError('invalid_output', `Only ${cardList.length} usable cards.`));
  }

  return {
    summary: { sections },
    quiz: { questions },
    cards: { cards: cardList },
    usage,
    flagged: null,
  };
}
