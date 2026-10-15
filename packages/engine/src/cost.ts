import { CALL_PRICES, MODEL_PRICES, type ModelPrice } from './prices';
import type { ProviderKey, Usage } from './types';

export const toMicros = (usd: number): number => Math.round(usd * 1_000_000);

/** Exact id, else the longest price key the id starts with (`gpt-5.6-luna-2026-09-01`). */
export function priceFor(model: string): ModelPrice | undefined {
  const id = model.replace(/^[a-z]+\//, '');
  if (MODEL_PRICES[id]) return MODEL_PRICES[id];
  const key = Object.keys(MODEL_PRICES)
    .filter((k) => id.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key === undefined ? undefined : MODEL_PRICES[key];
}

const n = (usage: Usage, key: string): number => usage[key] ?? 0;

/** Token cost in USD. Unknown models cost 0 (the caller flags them as unpriced). */
export function tokenCostUsd(model: string, usage: Usage): number {
  const p = priceFor(model);
  if (!p) return 0;
  const cached = n(usage, 'cachedInputTokens');
  return (
    ((n(usage, 'inputTokens') - cached) * p.inputPerM +
      cached * (p.cachedInputPerM ?? p.inputPerM) +
      n(usage, 'cacheWriteTokens') * (p.cacheWritePerM ?? p.inputPerM) +
      n(usage, 'outputTokens') * p.outputPerM) /
    1_000_000
  );
}

/** Per-call fees in USD, by provider. */
export function callCostUsd(provider: ProviderKey, model: string, usage: Usage): number {
  switch (provider) {
    case 'openai':
      return n(usage, 'webSearches') * CALL_PRICES.openaiWebSearch;
    case 'anthropic':
      return n(usage, 'webSearches') * CALL_PRICES.anthropicWebSearch;
    case 'gemini':
      return n(usage, 'groundedPrompts') * CALL_PRICES.geminiGroundedPrompt;
    case 'perplexity':
      return model.replace(/^[a-z]+\//, '').startsWith('sonar')
        ? n(usage, 'requests') * CALL_PRICES.perplexitySonarProRequest
        : n(usage, 'webSearches') * CALL_PRICES.perplexityAgentSearch;
    case 'dataforseo':
      return (
        n(usage, 'serpRequests') * CALL_PRICES.dataforseoSerp +
        n(usage, 'asyncAio') * CALL_PRICES.dataforseoAsyncAio
      );
  }
}

/**
 * `costMicros` for one provider call. The provider's own reported charge wins over the table;
 * otherwise tokens plus per-call fees.
 */
export function costMicros(provider: ProviderKey, model: string, usage: Usage): number {
  if (usage.providerCostMicros !== undefined) return usage.providerCostMicros;
  return toMicros(tokenCostUsd(model, usage) + callCostUsd(provider, model, usage));
}

/** True when the cost of this call came from the price table and the model wasn't in it. */
export const isUnpriced = (provider: ProviderKey, model: string, usage: Usage): boolean =>
  usage.providerCostMicros === undefined && provider !== 'dataforseo' && !priceFor(model);
