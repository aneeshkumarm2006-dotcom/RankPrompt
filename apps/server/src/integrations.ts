import {
  createEngine,
  engineConfigFromEnv,
  ProviderError,
  type BrandAI,
  type Engine,
} from '@pv/engine';
import { PLATFORMS, type Platform } from '@pv/shared';
import type { Env } from './config/env';
import type { Logger } from './config/logger';
import { createMailer, type Mailer } from './emails/mailer';
import { AppError } from './http/errors';
import type { CheckEngine } from './jobs/handlers/check';
import { createGoogleVerifier, type GoogleVerifier } from './modules/auth/google';
import { createStripeGateway, type BillingGateway } from './modules/billing/gateway';

/** External services the API talks to. Tests swap them for fakes. */
export interface Integrations {
  /** Null when `GOOGLE_CLIENT_ID` is unset (development and test only, D-019). */
  google: GoogleVerifier | null;
  /** Null when no OpenAI key is set and FAKE_PROVIDERS is off. */
  brandAI: BrandAI | null;
  /** The email driver the `send_email` job sends through (log, or Resend with a key). */
  mailer: Mailer;
  /** Platform adapters and the vendor extractor for check jobs. */
  checks: CheckEngine;
  /** Stripe. Null when `STRIPE_SECRET_KEY` is unset (development and test only). */
  billing: BillingGateway | null;
}

/** Platforms a run can use on this server: an adapter for it, plus the shared extractor. */
export const availablePlatforms = (checks: CheckEngine): Platform[] =>
  checks.extractor ? PLATFORMS.filter((p) => checks.adapters[p] !== undefined) : [];

/** The engine config, from the validated env (same names as ops/env-vars.md). */
export function engineFromEnv(env: Env): Engine {
  return createEngine(
    engineConfigFromEnv({
      OPENAI_API_KEY: env.OPENAI_API_KEY,
      OPENAI_ANSWER_MODEL: env.OPENAI_ANSWER_MODEL,
      OPENAI_EXTRACT_MODEL: env.OPENAI_EXTRACT_MODEL,
      OPENAI_UTILITY_MODEL: env.OPENAI_UTILITY_MODEL,
      PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY,
      PERPLEXITY_PRESET: env.PERPLEXITY_PRESET,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      CLAUDE_MODEL: env.CLAUDE_MODEL,
      CLAUDE_EFFORT: env.CLAUDE_EFFORT,
      CLAUDE_WEB_SEARCH_MAX_USES: String(env.CLAUDE_WEB_SEARCH_MAX_USES),
      CLAUDE_REFUSAL_FALLBACK: String(env.CLAUDE_REFUSAL_FALLBACK),
      DATAFORSEO_LOGIN: env.DATAFORSEO_LOGIN,
      DATAFORSEO_PASSWORD: env.DATAFORSEO_PASSWORD,
      DATAFORSEO_LOAD_ASYNC_AIO: String(env.DATAFORSEO_LOAD_ASYNC_AIO),
      FAKE_PROVIDERS: String(env.FAKE_PROVIDERS),
    }),
  );
}

export function buildIntegrations(env: Env, logger: Logger): Integrations {
  const engine = engineFromEnv(env);
  for (const [what, why] of Object.entries(engine.missing)) {
    logger.warn({ what, why }, 'engine feature unavailable');
  }
  return {
    google: env.GOOGLE_CLIENT_ID ? createGoogleVerifier(env.GOOGLE_CLIENT_ID) : null,
    brandAI: engine.brandAI ?? null,
    mailer: createMailer(env, logger, { production: env.NODE_ENV === 'production' }),
    checks: { adapters: engine.adapters, extractor: engine.extractor },
    billing: env.STRIPE_SECRET_KEY
      ? createStripeGateway(env.STRIPE_SECRET_KEY, {
          portalConfigurationId: env.STRIPE_PORTAL_CONFIGURATION_ID,
        })
      : null,
  };
}

const UTILITY_TIMEOUT_MS = 90_000;

/**
 * Runs a brand-analysis / prompt-generation call and maps provider failures to a retryable 503
 * `UPSTREAM_UNAVAILABLE`. The provider's own message is logged, never sent to the client.
 */
export async function callBrandAI<T>(
  brandAI: BrandAI | null,
  logger: Logger,
  fn: (ai: BrandAI, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!brandAI) {
    throw new AppError('UPSTREAM_UNAVAILABLE', 'AI features are not configured on this server');
  }
  try {
    return await fn(brandAI, AbortSignal.timeout(UTILITY_TIMEOUT_MS));
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn(
      { err, kind: err instanceof ProviderError ? err.kind : undefined },
      'brand AI call failed',
    );
    throw new AppError('UPSTREAM_UNAVAILABLE', 'The AI service is unavailable. Please try again.');
  }
}
