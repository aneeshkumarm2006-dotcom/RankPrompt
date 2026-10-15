import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { costMicros } from '../cost';
import { finalizeCitations } from '../domain';
import { ProviderError, kindForStatus, networkError, parseRetryAfter } from '../errors';
import type { FetchLike } from '../http';
import type { AnswerRaw, AskInput, PlatformAdapter, Usage } from '../types';

/** `pause_turn` continuations are capped (03), and the whole loop gets one 180 s budget. */
export const MAX_CONTINUATIONS = 5;
export const CLAUDE_BUDGET_MS = 180_000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function mapAnthropicError(e: unknown): ProviderError {
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') {
    const message = e.message;
    const type = (e.error as { error?: { type?: string } } | undefined)?.error?.type ?? '';
    // 529 overloaded is transient; billing_error / "credit balance is too low" is quota.
    const kind =
      type === 'billing_error'
        ? 'quota'
        : e.status === 529
          ? 'transient'
          : kindForStatus(e.status, message);
    return new ProviderError('anthropic', kind, message, {
      status: e.status,
      retryAfterMs: parseRetryAfter((e.headers as Headers | undefined)?.get('retry-after')),
      cause: e,
    });
  }
  return networkError('anthropic', e);
}

/** Text of every `text` block, in order (web search splits the answer into cited segments). */
const textOfBlocks = (blocks: readonly BetaContentBlock[]): string =>
  blocks.map((b) => (b.type === 'text' ? b.text : '')).join('');

/**
 * Cited sources first (`web_search_result_location` citations on text blocks), then every other
 * search result. A search error comes back as a result whose `content` is an object, not a list.
 */
export function citationsAndErrors(blocks: readonly BetaContentBlock[]): {
  items: { url: string; title?: string }[];
  searchErrors: string[];
} {
  const cited: { url: string; title?: string }[] = [];
  const rest: { url: string; title?: string }[] = [];
  const searchErrors: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      for (const c of b.citations ?? []) {
        if (c.type === 'web_search_result_location')
          cited.push({ url: c.url, ...(c.title ? { title: c.title } : {}) });
      }
    } else if (b.type === 'web_search_tool_result') {
      if (Array.isArray(b.content)) {
        for (const r of b.content)
          rest.push({ url: r.url, ...(r.title ? { title: r.title } : {}) });
      } else {
        searchErrors.push(b.content.error_code);
      }
    }
  }
  return { items: [...cited, ...rest], searchErrors };
}

const addUsage = (total: Usage, m: BetaMessage): void => {
  const u = m.usage;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const add = (k: string, v: number) => (total[k] = (total[k] ?? 0) + v);
  // Anthropic reports cache reads/writes separately from input_tokens.
  add('inputTokens', u.input_tokens + cacheRead);
  add('cachedInputTokens', cacheRead);
  add('cacheWriteTokens', u.cache_creation_input_tokens ?? 0);
  add('outputTokens', u.output_tokens);
  add('webSearches', u.server_tool_use?.web_search_requests ?? 0);
};

/**
 * Turns the final message of a (possibly continued) turn into an AnswerRaw. `blocks` holds the
 * content of every response in the loop, so citations from earlier continuations are kept.
 */
export function parseClaude(
  final: BetaMessage,
  blocks: readonly BetaContentBlock[],
  usage: Usage,
  raw: unknown,
  latencyMs: number,
): AnswerRaw {
  if (final.stop_reason === 'refusal') {
    const category = final.stop_details?.category ?? 'unspecified';
    throw new ProviderError('anthropic', 'refused', `model declined (category: ${category})`);
  }
  const answer = textOfBlocks(blocks).trim();
  const { items, searchErrors } = citationsAndErrors(blocks);
  if (!answer) {
    const why = searchErrors.length
      ? `web search error: ${searchErrors.join(', ')}`
      : `empty answer (${final.stop_reason})`;
    throw new ProviderError('anthropic', 'transient', why);
  }
  if (final.stop_reason === 'pause_turn') usage.truncated = 1;
  if (final.stop_reason === 'max_tokens') usage.truncated = 1;
  if (searchErrors.length) usage.searchErrors = searchErrors.length;
  return {
    answer,
    citations: finalizeCitations(items),
    model: final.model,
    usage,
    costMicros: costMicros('anthropic', final.model, usage),
    latencyMs,
    raw,
  };
}

export interface ClaudeAdapterOptions {
  client: Anthropic;
  model: string;
  effort: ClaudeEffort;
  maxUses: number;
  /** Server-side refusal fallback (`fallbacks: "default"`). The answering model is recorded. */
  refusalFallback: boolean;
}

/** Claude: Messages API + `web_search_20260209` server tool, with the `pause_turn` loop (03). */
export function createClaudeAdapter(opts: ClaudeAdapterOptions): PlatformAdapter {
  return {
    platform: 'claude',
    providerKey: 'anthropic',
    async ask(input: AskInput, signal: AbortSignal) {
      const base = {
        model: opts.model,
        max_tokens: 16_000,
        // Thinking can't be disabled on Opus 5.5: effort is the cost control (default would be medium).
        output_config: { effort: opts.effort },
        tools: [
          {
            type: 'web_search_20260209' as const,
            name: 'web_search' as const,
            max_uses: opts.maxUses,
            user_location: {
              type: 'approximate' as const,
              country: input.country,
              ...(input.city ? { city: input.city } : {}),
            },
          },
        ],
        ...(opts.refusalFallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
      };
      const messages: BetaMessageParam[] = [{ role: 'user', content: input.prompt }];
      const budget = AbortSignal.any([signal, AbortSignal.timeout(CLAUDE_BUDGET_MS)]);
      const started = Date.now();
      const usage: Usage = {};
      const blocks: BetaContentBlock[] = [];
      const responses: BetaMessage[] = [];
      let final: BetaMessage | undefined;
      for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
        const params: MessageCreateParamsNonStreaming = { ...base, messages: [...messages] };
        final = await opts.client.beta.messages
          .create(params, { signal: budget })
          .catch((e: unknown) => {
            throw mapAnthropicError(e);
          });
        responses.push(final);
        addUsage(usage, final);
        blocks.push(...final.content);
        if (final.stop_reason !== 'pause_turn') break;
        // Resend the paused assistant turn unchanged; the server resumes (no "continue" message).
        messages.splice(1, messages.length - 1, { role: 'assistant', content: blocks.slice() });
        usage.continuations = (usage.continuations ?? 0) + 1;
      }
      const raw = {
        request: { ...base, messages: [{ role: 'user', content: input.prompt }] },
        responses,
      };
      return parseClaude(final as BetaMessage, blocks, usage, raw, Date.now() - started);
    },
  };
}

/** SDK retries are off; the queue owns retries (04). */
export const createAnthropicClient = (apiKey: string, fetchImpl?: FetchLike): Anthropic =>
  new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: CLAUDE_BUDGET_MS,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
