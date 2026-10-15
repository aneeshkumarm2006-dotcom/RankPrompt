import { usedMarkers } from '../clean';
import { costMicros, toMicros } from '../cost';
import { finalizeCitations } from '../domain';
import { ProviderError } from '../errors';
import { ASK_TIMEOUT_MS, type FetchLike, postJson, withTimeout } from '../http';
import type { AnswerRaw, AskInput, PlatformAdapter, Usage } from '../types';

/**
 * Perplexity. Sonar Chat Completions ended on 2026-09-27 (D-020); the adapter calls the Agent
 * API (`POST /v1/agent`, a Responses-style body) with the `fast` preset, Perplexity's mapping for
 * Sonar Pro. `parsePerplexity` still reads the legacy Sonar shape, so stored v1/luna answers and
 * the fixtures made from them keep working.
 */
export const PERPLEXITY_AGENT_URL = 'https://api.perplexity.ai/v1/agent';

interface SearchResult {
  id?: number;
  url: string;
  title?: string | null;
}

interface AgentResponse {
  model?: string;
  status?: string;
  error?: { message?: string } | null;
  output?: (
    | { type: 'search_results'; results?: SearchResult[]; queries?: string[] }
    | { type: 'message'; content?: { type: string; text?: string }[] }
    | { type: string }
  )[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; cache_read_input_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
    cost?: { total_cost?: number };
    tool_calls_details?: Record<string, { invocation?: number } | undefined>;
  };
}

interface SonarResponse {
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  search_results?: SearchResult[];
  citations?: string[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: { total_cost?: number } };
}

/**
 * Keep only the sources whose marker appears in the answer; if there are no markers, keep all
 * (03). Agent markers are `[web:<id>]` (the result's `id`); Sonar markers are 1-based positions.
 */
export function usedSources(answer: string, results: readonly SearchResult[]): SearchResult[] {
  const used = usedMarkers(answer);
  if (!used.length) return [...results];
  const byId = results.some((r) => r.id !== undefined);
  return used
    .map((k) => (byId ? results.find((r) => r.id === k) : results[k - 1]))
    .filter((r): r is SearchResult => r !== undefined);
}

const providerCost = (usd: number | undefined): Usage =>
  usd === undefined ? {} : { providerCostMicros: toMicros(usd) };

export function parsePerplexity(body: unknown, request: unknown, latencyMs: number): AnswerRaw {
  const b = body as AgentResponse & SonarResponse;
  let answer: string;
  let results: SearchResult[];
  let usage: Usage;
  let model: string;
  if (Array.isArray(b.choices)) {
    // Legacy Sonar Chat Completions.
    answer = b.choices[0]?.message?.content?.trim() ?? '';
    results = b.search_results?.length
      ? b.search_results
      : (b.citations ?? []).map((url) => ({ url, title: null }));
    usage = {
      inputTokens: b.usage?.prompt_tokens ?? 0,
      outputTokens: b.usage?.completion_tokens ?? 0,
      requests: 1,
      ...providerCost(b.usage?.cost?.total_cost),
    };
    model = b.model ?? 'sonar-pro';
  } else {
    if (b.status === 'failed' || b.error) {
      throw new ProviderError(
        'perplexity',
        'transient',
        b.error?.message ?? 'agent response failed',
      );
    }
    const output = b.output ?? [];
    answer = output
      .flatMap((o) => (o.type === 'message' && 'content' in o ? (o.content ?? []) : []))
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    results = output.flatMap((o) =>
      o.type === 'search_results' && 'results' in o ? (o.results ?? []) : [],
    );
    const u = b.usage ?? {};
    const searches = Object.entries(u.tool_calls_details ?? {})
      .filter(([k]) => /search/i.test(k))
      .reduce((sum, [, v]) => sum + (v?.invocation ?? 0), 0);
    usage = {
      inputTokens: u.input_tokens ?? 0,
      cachedInputTokens:
        u.input_tokens_details?.cached_tokens ??
        u.input_tokens_details?.cache_read_input_tokens ??
        0,
      outputTokens: u.output_tokens ?? 0,
      reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
      webSearches: searches || output.filter((o) => o.type === 'search_results').length,
      ...providerCost(u.cost?.total_cost),
    };
    model = b.model ?? 'perplexity-agent';
  }
  if (!answer) throw new ProviderError('perplexity', 'transient', 'empty answer');
  return {
    answer,
    citations: finalizeCitations(usedSources(answer, results)),
    model,
    usage,
    costMicros: costMicros('perplexity', model, usage),
    latencyMs,
    raw: { request, response: body },
  };
}

export function createPerplexityAdapter(opts: {
  apiKey: string;
  preset: string;
  fetch?: FetchLike;
}): PlatformAdapter {
  return {
    platform: 'perplexity',
    providerKey: 'perplexity',
    async ask(input: AskInput, signal: AbortSignal) {
      const request = {
        preset: opts.preset,
        input: input.prompt,
        tools: [
          {
            type: 'web_search',
            user_location: {
              type: 'approximate',
              country: input.country,
              ...(input.city ? { city: input.city } : {}),
            },
          },
        ],
      };
      const started = Date.now();
      const body = await postJson<unknown>('perplexity', PERPLEXITY_AGENT_URL, request, {
        fetch: opts.fetch,
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        signal: withTimeout(signal, ASK_TIMEOUT_MS),
      });
      return parsePerplexity(body, request, Date.now() - started);
    },
  };
}
