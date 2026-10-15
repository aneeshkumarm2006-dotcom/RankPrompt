import type OpenAI from 'openai';
import { costMicros } from '../cost';
import { finalizeCitations } from '../domain';
import { ProviderError } from '../errors';
import { ASK_TIMEOUT_MS, withTimeout } from '../http';
import { mapOpenAIError, openAIUsage } from '../openai';
import type { AnswerRaw, AskInput, PlatformAdapter } from '../types';

type Response = OpenAI.Responses.Response;

/** `output_text`, or failing that the joined `output_text` parts of `message` items. */
export function textOf(res: Response): string {
  if (res.output_text) return res.output_text;
  return res.output
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content)
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('\n');
}

export function citationsOf(res: Response): { url: string; title: string }[] {
  return res.output
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content)
    .flatMap((c) => (c.type === 'output_text' ? c.annotations : []))
    .filter((a) => a.type === 'url_citation')
    .map((a) => ({ url: a.url, title: a.title }));
}

/** Parses a Responses API body into an AnswerRaw (minus timing). Exported for fixtures. */
export function parseChatGPT(res: Response, request: unknown, latencyMs: number): AnswerRaw {
  const answer = textOf(res).trim();
  if (!answer) {
    throw new ProviderError(
      'openai',
      'transient',
      `empty answer (status ${res.status ?? 'unknown'})`,
    );
  }
  const usage = {
    ...openAIUsage(res.usage),
    webSearches: res.output.filter((o) => o.type === 'web_search_call').length,
  };
  return {
    answer,
    citations: finalizeCitations(citationsOf(res)),
    model: res.model,
    usage,
    costMicros: costMicros('openai', res.model, usage),
    latencyMs,
    raw: { request, response: res },
  };
}

/** ChatGPT: OpenAI Responses API + `web_search` with approximate user location (03). */
export function createChatGPTAdapter(opts: { client: OpenAI; model: string }): PlatformAdapter {
  return {
    platform: 'chatgpt',
    providerKey: 'openai',
    async ask(input: AskInput, signal: AbortSignal) {
      // Prompts are generated in the run's language already, so nothing is prepended (03).
      const request = {
        model: opts.model,
        tools: [
          {
            type: 'web_search' as const,
            user_location: {
              type: 'approximate' as const,
              country: input.country,
              ...(input.city ? { city: input.city } : {}),
            },
          },
        ],
        input: input.prompt,
      };
      const started = Date.now();
      const res = await opts.client.responses
        .create(request, { signal: withTimeout(signal, ASK_TIMEOUT_MS) })
        .catch((e: unknown) => {
          throw mapOpenAIError(e);
        });
      return parseChatGPT(res, request, Date.now() - started);
    },
  };
}
