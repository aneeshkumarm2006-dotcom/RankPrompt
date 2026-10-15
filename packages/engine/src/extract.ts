import { createHash } from 'node:crypto';
import type OpenAI from 'openai';
import { costMicros } from './cost';
import { ExtractError, ProviderError } from './errors';
import { ASK_TIMEOUT_MS, withTimeout } from './http';
import { mapOpenAIError, openAIUsage } from './openai';
import type { Usage } from './types';

/** One extraction prompt for every platform, so results stay comparable (D-010). */
export const EXTRACT_INSTRUCTIONS =
  "List every distinct company, product or service provider that the answer below recommends or names as an option for the user, in the order they are first presented (first = top recommendation). Use the company's common name. Exclude: generic descriptions, government bodies, regulators, laws/programs, courts, media outlets, universities, and sources that are only cited. Answer:\n\n";

export const VENDORS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { vendors: { type: 'array', items: { type: 'string' } } },
  required: ['vendors'],
} as const;

/** Short hash of the prompt + schema; part of `engineVersion`. */
export const EXTRACT_PROMPT_HASH = createHash('sha256')
  .update(EXTRACT_INSTRUCTIONS + JSON.stringify(VENDORS_SCHEMA))
  .digest('hex')
  .slice(0, 8);

export interface Extraction {
  vendors: string[];
  model: string;
  usage: Usage;
  costMicros: number;
  raw: unknown;
}

export interface Extractor {
  model: string;
  promptHash: string;
  extract(prose: string, signal: AbortSignal): Promise<Extraction>;
}

/** Trim, drop empties and dedupe case-insensitively, keeping first-seen order. */
export function dedupeVendors(vendors: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vendors) {
    if (typeof v !== 'string') continue;
    const t = v.trim().replace(/\s+/g, ' ');
    const k = t.normalize('NFKC').toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function parseVendors(text: string): string[] {
  const parsed = JSON.parse(text) as { vendors?: unknown };
  if (!Array.isArray(parsed.vendors)) throw new Error('vendors is not an array');
  return dedupeVendors(parsed.vendors);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface OpenAIExtractorOptions {
  client: OpenAI;
  model: string;
  /** Extra attempts after the first (03: 2). */
  retries?: number;
  backoffMs?: (attempt: number, retryAfterMs?: number) => number;
}

/**
 * `gpt-5.4-mini` with a strict json_schema. Retries twice, then throws `ExtractError`
 * (terminal, the check is refunded; the raw answer is still kept).
 */
export function createOpenAIExtractor(opts: OpenAIExtractorOptions): Extractor {
  const retries = opts.retries ?? 2;
  const backoff =
    opts.backoffMs ??
    ((attempt, after) => Math.min(30_000, Math.max(after ?? 0, 1_000 * 3 ** (attempt - 1))));
  return {
    model: opts.model,
    promptHash: EXTRACT_PROMPT_HASH,
    async extract(prose, signal) {
      if (!prose.trim())
        return { vendors: [], model: opts.model, usage: {}, costMicros: 0, raw: null };
      let usage: Usage = {};
      let spent = 0;
      let lastError: unknown;
      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
          const res = await opts.client.responses
            .create(
              {
                model: opts.model,
                input: EXTRACT_INSTRUCTIONS + prose,
                text: {
                  format: {
                    type: 'json_schema',
                    name: 'vendors',
                    strict: true,
                    schema: { ...VENDORS_SCHEMA },
                  },
                },
              },
              { signal: withTimeout(signal, ASK_TIMEOUT_MS) },
            )
            .catch((e: unknown) => {
              throw mapOpenAIError(e);
            });
          usage = openAIUsage(res.usage);
          spent += costMicros('openai', res.model, usage);
          return {
            vendors: parseVendors(res.output_text),
            model: res.model,
            usage,
            costMicros: spent,
            raw: res,
          };
        } catch (e) {
          lastError = e;
          if (signal.aborted) break;
          if (e instanceof ProviderError && (e.kind === 'bad_request' || e.kind === 'refused'))
            break;
          if (attempt <= retries) {
            await sleep(backoff(attempt, e instanceof ProviderError ? e.retryAfterMs : undefined));
          }
        }
      }
      const reason = lastError instanceof Error ? lastError.message : String(lastError);
      throw new ExtractError(`vendor extraction failed: ${reason}`, { cause: lastError });
    },
  };
}
