import { PLATFORMS, type Platform } from '@pv/shared';
import { createChatGPTAdapter } from './adapters/chatgpt';
import { type ClaudeEffort, createAnthropicClient, createClaudeAdapter } from './adapters/claude';
import { createFakeAdapter, createFakeExtractor } from './adapters/fake';
import { createGeminiAdapter } from './adapters/gemini';
import { createGoogleAioAdapter } from './adapters/googleAio';
import { createPerplexityAdapter } from './adapters/perplexity';
import { type BrandAI, createFakeBrandAI, createOpenAIBrandAI } from './brandAi';
import { createOpenAIExtractor, type Extractor } from './extract';
import type { FetchLike } from './http';
import { createOpenAIClient } from './openai';
import type { PlatformAdapter } from './types';

/** Everything the engine needs. The server builds it from its validated env; the CLI from .env. */
export interface EngineConfig {
  openaiApiKey?: string | undefined;
  openaiAnswerModel: string;
  openaiExtractModel: string;
  /** Brand analysis and prompt generation. */
  openaiUtilityModel?: string;
  perplexityApiKey?: string | undefined;
  perplexityPreset: string;
  geminiApiKey?: string | undefined;
  geminiModel: string;
  anthropicApiKey?: string | undefined;
  claudeModel: string;
  claudeEffort: ClaudeEffort;
  claudeWebSearchMaxUses: number;
  claudeRefusalFallback: boolean;
  dataforseoLogin?: string | undefined;
  dataforseoPassword?: string | undefined;
  dataforseoLoadAsyncAio: boolean;
  fakeProviders: boolean;
  fetch?: FetchLike;
}

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

/** Same names and defaults as ops/env-vars.md. Empty values count as unset. */
export function engineConfigFromEnv(env: Record<string, string | undefined>): EngineConfig {
  const get = (k: string) => (env[k]?.trim() ? env[k].trim() : undefined);
  const bool = (k: string, fallback: boolean) => {
    const v = get(k);
    return v === undefined ? fallback : v === 'true' || v === '1';
  };
  const effort = get('CLAUDE_EFFORT') ?? 'low';
  if (!(EFFORTS as readonly string[]).includes(effort))
    throw new Error(`CLAUDE_EFFORT must be one of ${EFFORTS.join(', ')}`);
  return {
    openaiApiKey: get('OPENAI_API_KEY'),
    openaiAnswerModel: get('OPENAI_ANSWER_MODEL') ?? 'gpt-5.6-luna',
    openaiExtractModel: get('OPENAI_EXTRACT_MODEL') ?? 'gpt-5.4-mini',
    openaiUtilityModel: get('OPENAI_UTILITY_MODEL') ?? 'gpt-5.4-mini',
    perplexityApiKey: get('PERPLEXITY_API_KEY'),
    perplexityPreset: get('PERPLEXITY_PRESET') ?? 'fast',
    geminiApiKey: get('GEMINI_API_KEY'),
    geminiModel: get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
    anthropicApiKey: get('ANTHROPIC_API_KEY'),
    claudeModel: get('CLAUDE_MODEL') ?? 'claude-opus-5-5',
    claudeEffort: effort as ClaudeEffort,
    claudeWebSearchMaxUses: Number(get('CLAUDE_WEB_SEARCH_MAX_USES') ?? 2),
    claudeRefusalFallback: bool('CLAUDE_REFUSAL_FALLBACK', true),
    dataforseoLogin: get('DATAFORSEO_LOGIN'),
    dataforseoPassword: get('DATAFORSEO_PASSWORD'),
    dataforseoLoadAsyncAio: bool('DATAFORSEO_LOAD_ASYNC_AIO', false),
    fakeProviders: bool('FAKE_PROVIDERS', false),
  };
}

export interface Engine {
  adapters: Partial<Record<Platform, PlatformAdapter>>;
  extractor: Extractor | undefined;
  /** Brand analysis and prompt generation (server only). */
  brandAI: BrandAI | undefined;
  /** Why a platform has no adapter (missing keys). */
  missing: Partial<Record<Platform | 'extractor' | 'brandAI', string>>;
}

export function createEngine(cfg: EngineConfig): Engine {
  if (cfg.fakeProviders) {
    return {
      adapters: Object.fromEntries(PLATFORMS.map((p) => [p, createFakeAdapter(p)])),
      extractor: createFakeExtractor(),
      brandAI: createFakeBrandAI(),
      missing: {},
    };
  }
  const adapters: Engine['adapters'] = {};
  const missing: Engine['missing'] = {};
  const openai = cfg.openaiApiKey ? createOpenAIClient(cfg.openaiApiKey, cfg.fetch) : undefined;
  const fetchOpt = cfg.fetch ? { fetch: cfg.fetch } : {};

  if (openai)
    adapters.chatgpt = createChatGPTAdapter({ client: openai, model: cfg.openaiAnswerModel });
  else missing.chatgpt = 'OPENAI_API_KEY is not set';

  if (cfg.perplexityApiKey) {
    adapters.perplexity = createPerplexityAdapter({
      apiKey: cfg.perplexityApiKey,
      preset: cfg.perplexityPreset,
      ...fetchOpt,
    });
  } else missing.perplexity = 'PERPLEXITY_API_KEY is not set';

  if (cfg.geminiApiKey)
    adapters.gemini = createGeminiAdapter({
      apiKey: cfg.geminiApiKey,
      model: cfg.geminiModel,
      ...fetchOpt,
    });
  else missing.gemini = 'GEMINI_API_KEY is not set';

  if (cfg.anthropicApiKey) {
    adapters.claude = createClaudeAdapter({
      client: createAnthropicClient(cfg.anthropicApiKey, cfg.fetch),
      model: cfg.claudeModel,
      effort: cfg.claudeEffort,
      maxUses: cfg.claudeWebSearchMaxUses,
      refusalFallback: cfg.claudeRefusalFallback,
    });
  } else missing.claude = 'ANTHROPIC_API_KEY is not set';

  if (cfg.dataforseoLogin && cfg.dataforseoPassword) {
    adapters.google_aio = createGoogleAioAdapter({
      login: cfg.dataforseoLogin,
      password: cfg.dataforseoPassword,
      loadAsyncAio: cfg.dataforseoLoadAsyncAio,
      ...fetchOpt,
    });
  } else missing.google_aio = 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set';

  let extractor: Extractor | undefined;
  let brandAI: BrandAI | undefined;
  if (openai) {
    extractor = createOpenAIExtractor({ client: openai, model: cfg.openaiExtractModel });
    brandAI = createOpenAIBrandAI({
      client: openai,
      model: cfg.openaiUtilityModel ?? 'gpt-5.4-mini',
    });
  } else {
    missing.extractor = 'OPENAI_API_KEY is not set (the vendor extractor uses OpenAI)';
    missing.brandAI = 'OPENAI_API_KEY is not set (brand analysis uses OpenAI)';
  }

  return { adapters, extractor, brandAI, missing };
}
