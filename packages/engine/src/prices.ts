/**
 * List prices in USD, standard tier (03 § Cost tracking). Versioned: bump PRICES_VERSION when a
 * number changes, so stored `costMicros` can be explained later. Sources were checked on the
 * version date: OpenAI, Perplexity, Google AI and Anthropic pricing pages, dataforseo.com/pricing.
 * When a provider reports its own charge (Perplexity `usage.cost`, DataForSEO `cost`), that wins.
 */
export const PRICES_VERSION = '2026-10-14';

export interface ModelPrice {
  inputPerM: number;
  /** Cache-hit input. Defaults to `inputPerM`. */
  cachedInputPerM?: number;
  /** Anthropic cache writes (5-minute TTL). Defaults to `inputPerM`. */
  cacheWritePerM?: number;
  /** Includes reasoning/thinking tokens. */
  outputPerM: number;
}

/** Keyed by model id; snapshots and `openai/`-style prefixes resolve to the longest matching key. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // OpenAI (≤272K input tier; our prompts never come close)
  'gpt-5.6-luna': { inputPerM: 0.2, cachedInputPerM: 0.02, outputPerM: 1.2 },
  'gpt-5.6-terra': { inputPerM: 2, cachedInputPerM: 0.2, outputPerM: 12 },
  'gpt-5.6-sol': { inputPerM: 4, cachedInputPerM: 0.4, outputPerM: 20 },
  'gpt-5.4-mini': { inputPerM: 0.75, cachedInputPerM: 0.075, outputPerM: 4.5 },
  // Perplexity legacy Sonar (Chat Completions ended 2026-09-27; kept for old raw responses)
  'sonar-pro': { inputPerM: 3, outputPerM: 15 },
  // Google
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  // Anthropic
  'claude-opus-5-5': { inputPerM: 4, cachedInputPerM: 0.2, cacheWritePerM: 5, outputPerM: 20 },
  'claude-sonnet-5-5': { inputPerM: 2, cachedInputPerM: 0.2, cacheWritePerM: 2.5, outputPerM: 10 },
  'claude-opus-5': { inputPerM: 5, cachedInputPerM: 0.5, cacheWritePerM: 6.25, outputPerM: 25 },
};

/** Per-call fees in USD. */
export const CALL_PRICES = {
  /** OpenAI Responses `web_search` tool call; search content tokens are billed as input. */
  openaiWebSearch: 10 / 1000,
  /** Anthropic web search; results are billed as input tokens. */
  anthropicWebSearch: 10 / 1000,
  /** Gemini grounded prompt (2.5 models). The 1,500/day free allowance is ignored per check. */
  geminiGroundedPrompt: 35 / 1000,
  /** Perplexity Agent API `web_search` call (fallback when the response carries no cost). */
  perplexityAgentSearch: 2.5 / 1000,
  /** Legacy sonar-pro request fee, low search context (the default). */
  perplexitySonarProRequest: 6 / 1000,
  /** DataForSEO Google Organic live/advanced, one SERP page of 10. */
  dataforseoSerp: 0.002,
  /** `load_async_ai_overview: true` adds one base price. */
  dataforseoAsyncAio: 0.002,
} as const;
