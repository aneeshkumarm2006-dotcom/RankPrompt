import type { Platform } from '@pv/shared';

/** Who bills a check. The worker's limiters and spend caps are keyed by this (04). */
export const PROVIDER_KEYS = ['openai', 'perplexity', 'gemini', 'anthropic', 'dataforseo'] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export const PROVIDER_OF: Record<Platform, ProviderKey> = {
  chatgpt: 'openai',
  perplexity: 'perplexity',
  gemini: 'gemini',
  claude: 'anthropic',
  google_aio: 'dataforseo',
};

export interface AskInput {
  prompt: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  city?: string;
  /** ISO 639-1. */
  language: string;
}

export interface Citation {
  url: string;
  /** Hostname without `www.`, or '' when it can't be known (an unresolved redirect). */
  domain: string;
  title?: string;
  /** 1-based, in first-seen order after cleaning and dedupe. */
  position: number;
}

/**
 * Provider counters for cost.ts. Keys are normalised across adapters:
 * inputTokens, cachedInputTokens, outputTokens, reasoningTokens (informational, already inside
 * outputTokens), webSearches, groundedPrompts, serpRequests, asyncAio, requests,
 * providerCostMicros (when the provider reports its own charge), truncated, continuations.
 */
export type Usage = Record<string, number>;

export interface AnswerRaw {
  /** Markdown/plain text as returned. '' when `noAnswer`. */
  answer: string;
  citations: Citation[];
  /** The model that actually answered (fallbacks and dated snapshots differ from the request). */
  model: string;
  usage: Usage;
  costMicros: number;
  latencyMs: number;
  /** Provider request + response(s), kept 30 days (02 `run_result_raw`). */
  raw: unknown;
  /** The platform showed nothing to evaluate, e.g. no AI Overview. Not a failure (05). */
  noAnswer?: boolean;
}

export interface PlatformAdapter {
  platform: Platform;
  providerKey: ProviderKey;
  ask(input: AskInput, signal: AbortSignal): Promise<AnswerRaw>;
}

/** A brand or a tracked competitor, as the matcher sees it. */
export interface EntityInput {
  id?: string;
  name: string;
  /** Bare domain or URL; matched on its registrable domain. */
  domain?: string | null;
  aliases?: readonly string[];
}

export interface EntityMatch {
  mentioned: boolean;
  /** 1-based position in the vendor list, or null when absent. */
  rank: number | null;
  cited: boolean;
  citedUrl: string | null;
  snippet: string | null;
}

export interface CompetitorMatch extends EntityMatch {
  id?: string;
  name: string;
}

export interface MatchResult {
  brand: EntityMatch;
  competitors: CompetitorMatch[];
  /** Vendors that match neither the brand nor any tracked competitor, in answer order. */
  suggested: string[];
}
