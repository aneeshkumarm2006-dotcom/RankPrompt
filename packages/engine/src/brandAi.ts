import {
  countryName,
  languageName,
  type CountryCode,
  type LanguageCode,
  type Scope,
} from '@pv/shared';
import type OpenAI from 'openai';
import { textOf } from './adapters/chatgpt';
import { costMicros } from './cost';
import { ProviderError } from './errors';
import { withTimeout } from './http';
import { buildMatcher } from './match';
import { mapOpenAIError, openAIUsage } from './openai';
import type { Usage } from './types';

/**
 * Brand analysis (F-07, F-08) and prompt generation (F-09): one structured-output call each, on
 * the utility model. The analysis reads the site through OpenAI `web_search`, so our server never
 * fetches a user-supplied URL (D-013).
 */

export const MAX_ANALYSIS_CATEGORIES = 10;
const UTILITY_TIMEOUT_MS = 90_000;

export interface BrandAnalysisInput {
  name: string;
  websiteUrl: string;
  /** Registrable domain, already validated by the caller. */
  domain: string;
}

export interface BrandAnalysis {
  summary: string;
  categories: { name: string; description: string }[];
  /** Name variants the brand is known by (the name itself excluded). */
  aliases: string[];
  model: string;
  costMicros: number;
}

export interface PromptDraftInput {
  brand: { name: string; domain: string; summary: string; aliases: readonly string[] };
  categories: readonly { name: string; description?: string }[];
  count: number;
  scope: Scope;
  country: CountryCode;
  city: string | null;
  language: LanguageCode;
}

export interface PromptDraft {
  text: string;
  category: string;
}

export interface PromptDrafts {
  drafts: PromptDraft[];
  model: string;
  costMicros: number;
}

export interface BrandAI {
  analyze(input: BrandAnalysisInput, signal: AbortSignal): Promise<BrandAnalysis>;
  generatePrompts(input: PromptDraftInput, signal: AbortSignal): Promise<PromptDrafts>;
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string' }, description: { type: 'string' } },
        required: ['name', 'description'],
      },
    },
    aliases: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'categories', 'aliases'],
} as const;

const DRAFTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { text: { type: 'string' }, category: { type: 'string' } },
        required: ['text', 'category'],
      },
    },
  },
  required: ['prompts'],
} as const;

export function analysisInstructions(input: BrandAnalysisInput): string {
  return [
    `Research the company "${input.name}" using its website ${input.websiteUrl} (domain ${input.domain}). Search the web to read the site.`,
    '',
    'Return:',
    '- summary: 2-4 plain sentences on what the company offers, to whom, and where it operates. Facts from the site only, no marketing language.',
    `- categories: exactly ${MAX_ANALYSIS_CATEGORIES} distinct product or service categories a buyer would search in when looking for what this company sells (for example "Immigration Consulting", "Study Permit Services"). Each has a short description. Use professional English; never include the company name.`,
    '- aliases: other names the company is commonly known by (short names, former names, the name without its legal suffix). Do not repeat the exact name. Return an empty list if there are none.',
  ].join('\n');
}

/** Where the generated prompts should be set, from the run's scope (fixes the v1 city bug). */
export function locationPhrase(input: Pick<PromptDraftInput, 'scope' | 'country' | 'city'>) {
  const country = countryName(input.country);
  return input.scope === 'local' && input.city ? `${input.city}, ${country}` : country;
}

export function promptInstructions(input: PromptDraftInput): string {
  const categories = input.categories
    .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
    .join('\n');
  const where = locationPhrase(input);
  return [
    `Write ${input.count} different questions that a potential customer in ${where} would ask an AI assistant (ChatGPT, Perplexity, Gemini, Google) when looking for the products or services below.`,
    '',
    `Categories (use exactly these names in "category", and spread the questions evenly across them):`,
    categories,
    '',
    'Rules:',
    `- Never mention "${input.brand.name}", its domain or any other company or brand name. The questions must be unbranded so they test which companies the AI recommends.`,
    '- Natural and conversational, 5-20 words each, the way a real buyer types.',
    '- Mix intents: best/top recommendations, comparisons, specific needs, costs, how to choose, problems to solve.',
    input.scope === 'local'
      ? `- Most questions should be set in ${where} (name the city or say "near me").`
      : `- Where a location helps the question, use ${where}.`,
    `- Write every question in ${languageName(input.language)}.`,
    '- No numbering, no quotes, no duplicates.',
    '',
    `Context about the business (do not name it): ${input.brand.summary || 'n/a'}`,
  ].join('\n');
}

const fold = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Keeps the drafts usable: trimmed, deduped, in a requested category, unbranded, at most `count`.
 * A draft naming the brand (or its domain) is dropped instead of saved.
 */
export function cleanDrafts(raw: readonly PromptDraft[], input: PromptDraftInput): PromptDraft[] {
  const brand = buildMatcher({
    name: input.brand.name,
    domain: input.brand.domain,
    aliases: [...input.brand.aliases, input.brand.domain],
  });
  const categoryByKey = new Map(input.categories.map((c) => [fold(c.name), c.name]));
  const fallback = input.categories[0]?.name ?? 'General';
  const seen = new Set<string>();
  const out: PromptDraft[] = [];
  for (const d of raw) {
    const text = d.text
      .trim()
      .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')
      .replace(/^["“]|["”]$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 3 || text.length > 500) continue;
    const key = fold(text);
    if (seen.has(key) || brand.test(text)) continue;
    seen.add(key);
    out.push({ text, category: categoryByKey.get(fold(d.category)) ?? fallback });
    if (out.length >= input.count) break;
  }
  return out;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError('openai', 'transient', 'the model returned invalid JSON');
  }
}

/** `{ summary, categories ≤10, aliases }` with empty and duplicate entries removed. */
export function cleanAnalysis(
  raw: { summary: string; categories: { name: string; description: string }[]; aliases: string[] },
  name: string,
): Pick<BrandAnalysis, 'summary' | 'categories' | 'aliases'> {
  const seenCategories = new Set<string>();
  const categories: BrandAnalysis['categories'] = [];
  for (const c of raw.categories) {
    const cname = c.name.trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!cname || seenCategories.has(fold(cname))) continue;
    seenCategories.add(fold(cname));
    categories.push({ name: cname, description: c.description.trim().slice(0, 500) });
    if (categories.length === MAX_ANALYSIS_CATEGORIES) break;
  }
  const seenAliases = new Set([fold(name)]);
  const aliases: string[] = [];
  for (const a of raw.aliases) {
    const alias = a.trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!alias || seenAliases.has(fold(alias))) continue;
    seenAliases.add(fold(alias));
    aliases.push(alias);
  }
  return { summary: raw.summary.trim().slice(0, 4000), categories, aliases: aliases.slice(0, 10) };
}

export function createOpenAIBrandAI(opts: { client: OpenAI; model: string }): BrandAI {
  const call = async (
    request: OpenAI.Responses.ResponseCreateParamsNonStreaming,
    signal: AbortSignal,
  ) => {
    const res = await opts.client.responses
      .create(request, { signal: withTimeout(signal, UTILITY_TIMEOUT_MS) })
      .catch((e: unknown) => {
        throw mapOpenAIError(e);
      });
    const usage: Usage = {
      ...openAIUsage(res.usage),
      webSearches: res.output.filter((o) => o.type === 'web_search_call').length,
    };
    return { res, cost: costMicros('openai', res.model, usage) };
  };

  return {
    async analyze(input, signal) {
      const { res, cost } = await call(
        {
          model: opts.model,
          tools: [{ type: 'web_search' }],
          input: analysisInstructions(input),
          text: {
            format: {
              type: 'json_schema',
              name: 'brand_analysis',
              strict: true,
              schema: { ...ANALYSIS_SCHEMA },
            },
          },
        },
        signal,
      );
      const parsed = parseJson<Parameters<typeof cleanAnalysis>[0]>(textOf(res));
      return { ...cleanAnalysis(parsed, input.name), model: res.model, costMicros: cost };
    },

    async generatePrompts(input, signal) {
      const { res, cost } = await call(
        {
          model: opts.model,
          input: promptInstructions(input),
          text: {
            format: {
              type: 'json_schema',
              name: 'prompt_drafts',
              strict: true,
              schema: { ...DRAFTS_SCHEMA },
            },
          },
        },
        signal,
      );
      const parsed = parseJson<{ prompts: PromptDraft[] }>(textOf(res));
      return { drafts: cleanDrafts(parsed.prompts, input), model: res.model, costMicros: cost };
    },
  };
}

/** FAKE_PROVIDERS=true: deterministic, offline, free. */
export function createFakeBrandAI(): BrandAI {
  return {
    analyze(input) {
      const base = input.name.replace(/\b(inc|llc|ltd|corp)\.?$/i, '').trim();
      return Promise.resolve({
        summary: `${input.name} (${input.domain}) is a company used for fake-provider testing.`,
        categories: [
          'Consulting Services',
          'Software Platforms',
          'Professional Advice',
          'Online Services',
        ].map((name) => ({ name, description: `Fake category: ${name.toLowerCase()}.` })),
        aliases: base && base !== input.name ? [base] : [],
        model: 'fake-utility',
        costMicros: 0,
      });
    },
    generatePrompts(input) {
      const where = locationPhrase(input);
      const raw = Array.from({ length: input.count }, (_, i) => {
        const category = input.categories[i % input.categories.length]?.name ?? 'General';
        return {
          text: `What are the best ${category.toLowerCase()} in ${where}? (${i + 1})`,
          category,
        };
      });
      return Promise.resolve({
        drafts: cleanDrafts(raw, input),
        model: 'fake-utility',
        costMicros: 0,
      });
    },
  };
}
