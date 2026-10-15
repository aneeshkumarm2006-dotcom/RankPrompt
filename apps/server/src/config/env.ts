import os from 'node:os';
import { z } from 'zod';

/**
 * Server configuration, parsed once at boot (ops/env-vars.md). The process refuses to start when a
 * variable is missing or malformed. In production every integration secret is required; in
 * development and test they may be absent until the feature that uses them is exercised
 * (providers are covered by FAKE_PROVIDERS), so `pnpm dev` works with no `.env` at all (D-019).
 */

const DEV_APP_URL = 'http://localhost:5173';
const PROVIDERS = ['openai', 'perplexity', 'gemini', 'anthropic', 'dataforseo'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1');

const posInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const secret = z.string().min(1).optional();

const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((raw, ctx): unknown => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(schema);

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: posInt(4000),
  APP_URL: z.url({ protocol: /^https?$/ }).optional(),
  RUN_HTTP: bool(true),
  RUN_WORKER: bool(true),
  INSTANCE_ID: z.string().min(1).default(os.hostname()),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, 'must look like 15m, 1h, …')
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: posInt(30),
  GOOGLE_CLIENT_ID: secret,

  OPENAI_API_KEY: secret,
  OPENAI_ANSWER_MODEL: z.string().default('gpt-5.6-luna'),
  OPENAI_EXTRACT_MODEL: z.string().default('gpt-5.4-mini'),
  OPENAI_UTILITY_MODEL: z.string().default('gpt-5.4-mini'),
  PERPLEXITY_API_KEY: secret,
  // Agent API preset (D-020: Sonar Chat Completions ended 2026-09-27; `fast` maps to Sonar Pro).
  PERPLEXITY_PRESET: z.string().default('fast'),
  GEMINI_API_KEY: secret,
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: secret,
  CLAUDE_MODEL: z.string().default('claude-opus-5-5'),
  CLAUDE_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  CLAUDE_WEB_SEARCH_MAX_USES: posInt(2),
  CLAUDE_REFUSAL_FALLBACK: bool(true),
  DATAFORSEO_LOGIN: secret,
  DATAFORSEO_PASSWORD: secret,
  DATAFORSEO_LOAD_ASYNC_AIO: bool(false),
  FAKE_PROVIDERS: bool(false),

  PROVIDER_LIMITS: json(
    z.partialRecord(
      z.enum(PROVIDERS),
      z.object({
        rpm: z.number().int().positive().optional(),
        concurrency: z.number().int().positive().optional(),
      }),
    ),
  ).optional(),
  PROVIDER_DAILY_CAP_USD: json(
    z.partialRecord(z.enum(PROVIDERS), z.number().positive()),
  ).optional(),
  MAX_INFLIGHT_PER_WORKSPACE: posInt(64),
  WORKER_CONCURRENCY: posInt(96),
  SHUTDOWN_GRACE_MS: posInt(50_000),

  STRIPE_SECRET_KEY: secret,
  STRIPE_WEBHOOK_SECRET: secret,
  STRIPE_PRICE_STARTER: secret,
  STRIPE_PRICE_PRO: secret,
  STRIPE_PRICE_AGENCY: secret,
  STRIPE_PRICE_TOPUP_50: secret,
  STRIPE_PRICE_TOPUP_100: secret,
  STRIPE_PRICE_TOPUP_200: secret,
  // Customer Portal configuration (`bpc_…`, from `pnpm admin stripe-portal --yes`); unset = the
  // account's default portal configuration.
  STRIPE_PORTAL_CONFIGURATION_ID: secret,

  // Unset: Resend when RESEND_API_KEY is set, else the log driver (D-018). `log` forces logging.
  EMAIL_DRIVER: z.enum(['log', 'resend']).optional(),
  RESEND_API_KEY: secret,
  EMAIL_FROM: z.string().default('PromptVerse <noreply@promptverse.info>'),

  SENTRY_DSN: z.url().optional(),

  // Shared with the Vercel middleware: only requests carrying it may set the client IP through
  // X-Forwarded-For (D-027 follow-up). Unset: X-Forwarded-For is trusted as before.
  EDGE_PROXY_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
});

type BaseEnv = z.output<typeof baseSchema>;

/** Required in production even though development and test may leave them unset. */
const PRODUCTION_REQUIRED = [
  'APP_URL',
  'JWT_ACCESS_SECRET',
  'GOOGLE_CLIENT_ID',
  'OPENAI_API_KEY',
  'PERPLEXITY_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_AGENCY',
  'STRIPE_PRICE_TOPUP_50',
  'STRIPE_PRICE_TOPUP_100',
  'STRIPE_PRICE_TOPUP_200',
] as const satisfies readonly (keyof BaseEnv)[];

const envSchema = baseSchema
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of PRODUCTION_REQUIRED) {
        if (env[key] === undefined) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'required in production' });
        }
      }
      if (env.FAKE_PROVIDERS) {
        ctx.addIssue({
          code: 'custom',
          path: ['FAKE_PROVIDERS'],
          message: 'must be false in production',
        });
      }
    }
    if (env.EMAIL_DRIVER === 'resend' && env.RESEND_API_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'required when EMAIL_DRIVER=resend',
      });
    }
  })
  .transform((env) => ({
    ...env,
    // Compared verbatim with the Origin header (07), so keep only scheme://host[:port].
    APP_URL: new URL(env.APP_URL ?? DEV_APP_URL).origin,
    LOG_LEVEL: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  }));

export type Env = z.output<typeof envSchema>;

/** Names of env vars whose values must never be logged (used for log redaction). */
export const SECRET_ENV_KEYS = Object.keys(baseSchema.shape).filter((key) =>
  /(_KEY|_SECRET|_PASSWORD|_DSN|_URI)$/.test(key),
);

export class EnvError extends Error {
  override name = 'EnvError';
}

/**
 * Parses and validates the environment. Empty strings count as unset, so `KEY=` lines copied from
 * `.env.example` behave like missing keys. Error messages name variables, never their values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const raw = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`,
    );
    throw new EnvError(`Invalid server environment:\n${problems.join('\n')}`);
  }
  return result.data;
}
