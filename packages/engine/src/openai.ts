import OpenAI from 'openai';
import { ProviderError, kindForStatus, networkError, parseRetryAfter } from './errors';
import type { FetchLike } from './http';
import type { Usage } from './types';

/** SDK retries are off: the queue (or the CLI runner) owns retries, by error kind (04). */
export const createOpenAIClient = (apiKey: string, fetchImpl?: FetchLike): OpenAI =>
  new OpenAI({ apiKey, maxRetries: 0, ...(fetchImpl ? { fetch: fetchImpl } : {}) });

export function mapOpenAIError(e: unknown): ProviderError {
  if (e instanceof OpenAI.APIError && typeof e.status === 'number') {
    const status: number = e.status;
    const headers = e.headers as Headers | undefined;
    const message = e.message;
    const code = typeof e.code === 'string' ? e.code : '';
    return new ProviderError(
      'openai',
      code === 'insufficient_quota' ? 'quota' : kindForStatus(status, message),
      message,
      { status, retryAfterMs: parseRetryAfter(headers?.get('retry-after')), cause: e },
    );
  }
  return networkError('openai', e);
}

/** Normalised usage from a Responses API `usage` object. */
export function openAIUsage(usage: OpenAI.Responses.ResponseUsage | null | undefined): Usage {
  if (!usage) return {};
  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  };
}
