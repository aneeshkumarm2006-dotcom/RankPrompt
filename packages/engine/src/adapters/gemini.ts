import { countryName, type CountryCode } from '@pv/shared';
import { costMicros } from '../cost';
import { finalizeCitations, hostOf, isDomainLike } from '../domain';
import { ProviderError } from '../errors';
import { ASK_TIMEOUT_MS, type FetchLike, postJson, withTimeout } from '../http';
import type { AnswerRaw, AskInput, PlatformAdapter } from '../types';

/** Gemini API + Google Search grounding (03). The API has no location parameter. */
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

interface GeminiResponse {
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: { web?: { uri?: string; title?: string; domain?: string } }[];
    };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    toolUsePromptTokenCount?: number;
  };
}

const REFUSAL_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);
const GOOGLE_REDIRECT = /^https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//;

export const systemInstructionFor = (input: AskInput): string =>
  `The user is located in ${countryName(input.country as CountryCode)}${input.city ? `, ${input.city}` : ''}.`;

/** Resolves a grounding redirect to its target URL with a HEAD request (never follows it). */
export type RedirectResolver = (url: string, signal: AbortSignal) => Promise<string | null>;

export function createRedirectResolver(fetchImpl: FetchLike = fetch): RedirectResolver {
  const cache = new Map<string, string | null>();
  return async (url, signal) => {
    if (cache.has(url)) return cache.get(url) ?? null;
    let target: string | null = null;
    try {
      const res = await fetchImpl(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      });
      target = res.headers.get('location');
    } catch {
      target = null;
    }
    if (cache.size > 5_000) cache.clear();
    cache.set(url, target);
    return target;
  };
}

/**
 * Parses a generateContent body. Each chunk's `uri` is a Google redirect and its `title` is
 * the source domain, so the domain comes from the title when it parses as one (03).
 */
export async function parseGemini(
  body: GeminiResponse,
  request: unknown,
  latencyMs: number,
  model: string,
  resolve?: RedirectResolver,
  signal: AbortSignal = new AbortController().signal,
): Promise<AnswerRaw> {
  if (body.promptFeedback?.blockReason) {
    throw new ProviderError(
      'gemini',
      'refused',
      `prompt blocked: ${body.promptFeedback.blockReason}`,
    );
  }
  const cand = body.candidates?.[0];
  if (!cand) throw new ProviderError('gemini', 'transient', 'no candidates');
  if (cand.finishReason && REFUSAL_FINISH.has(cand.finishReason)) {
    throw new ProviderError('gemini', 'refused', `finish reason ${cand.finishReason}`);
  }
  const answer = (cand.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!answer)
    throw new ProviderError(
      'gemini',
      'transient',
      `empty answer (${cand.finishReason ?? 'no finish reason'})`,
    );

  const chunks = (cand.groundingMetadata?.groundingChunks ?? []).flatMap((g) =>
    g.web?.uri ? [g.web] : [],
  );
  const items = await Promise.all(
    chunks.map(async (w) => {
      const uri = w.uri as string;
      const title = w.title ?? undefined;
      if (w.domain) return { url: uri, title, domain: hostOf(w.domain) };
      if (title && isDomainLike(title)) return { url: uri, title, domain: hostOf(title) };
      if (!GOOGLE_REDIRECT.test(uri)) return { url: uri, title };
      const target = resolve ? await resolve(uri, signal) : null;
      return target ? { url: target, title } : { url: uri, title, domain: '' };
    }),
  );

  const u = body.usageMetadata ?? {};
  const queries = cand.groundingMetadata?.webSearchQueries?.length ?? 0;
  const usage = {
    inputTokens: (u.promptTokenCount ?? 0) + (u.toolUsePromptTokenCount ?? 0),
    cachedInputTokens: u.cachedContentTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    reasoningTokens: u.thoughtsTokenCount ?? 0,
    groundedPrompts: queries > 0 || chunks.length > 0 ? 1 : 0,
    webSearches: queries,
  };
  const answeredBy = body.modelVersion ?? model;
  return {
    answer,
    citations: finalizeCitations(items),
    model: answeredBy,
    usage,
    costMicros: costMicros('gemini', answeredBy, usage),
    latencyMs,
    raw: { request, response: body },
  };
}

export function createGeminiAdapter(opts: {
  apiKey: string;
  model: string;
  fetch?: FetchLike;
  /** Resolve redirects whose title isn't a domain. Default: a cached HEAD resolver. */
  resolveRedirect?: RedirectResolver | null;
}): PlatformAdapter {
  const resolve =
    opts.resolveRedirect === null
      ? undefined
      : (opts.resolveRedirect ?? createRedirectResolver(opts.fetch));
  return {
    platform: 'gemini',
    providerKey: 'gemini',
    async ask(input: AskInput, signal: AbortSignal) {
      const request = {
        systemInstruction: { parts: [{ text: systemInstructionFor(input) }] },
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        tools: [{ google_search: {} }],
      };
      const started = Date.now();
      const timed = withTimeout(signal, ASK_TIMEOUT_MS);
      const body = await postJson<GeminiResponse>('gemini', ENDPOINT(opts.model), request, {
        fetch: opts.fetch,
        headers: { 'x-goog-api-key': opts.apiKey },
        signal: timed,
      });
      return parseGemini(body, request, Date.now() - started, opts.model, resolve, timed);
    },
  };
}
