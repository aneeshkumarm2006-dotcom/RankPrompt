import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../src/config/env';

const PROD_SECRETS = {
  APP_URL: 'https://app.example.com',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  GOOGLE_CLIENT_ID: 'google-client',
  OPENAI_API_KEY: 'sk-openai-secret-value',
  PERPLEXITY_API_KEY: 'pplx',
  GEMINI_API_KEY: 'gem',
  ANTHROPIC_API_KEY: 'ant',
  DATAFORSEO_LOGIN: 'login',
  DATAFORSEO_PASSWORD: 'pw',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  STRIPE_PRICE_STARTER: 'price_s',
  STRIPE_PRICE_PRO: 'price_p',
  STRIPE_PRICE_AGENCY: 'price_a',
  STRIPE_PRICE_TOPUP_50: 'price_50',
  STRIPE_PRICE_TOPUP_100: 'price_100',
  STRIPE_PRICE_TOPUP_200: 'price_200',
};
const MONGO = { MONGODB_URI: 'mongodb://127.0.0.1:27017/pv' };

const errorOf = (fn: () => unknown): EnvError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof EnvError) return err;
    throw err;
  }
  throw new Error('expected loadEnv to throw');
};

describe('loadEnv', () => {
  it('boots development with no secrets and applies defaults', () => {
    const env = loadEnv({ NODE_ENV: 'development', ...MONGO });
    expect(env.APP_URL).toBe('http://localhost:5173');
    expect(env.PORT).toBe(4000);
    expect(env.RUN_HTTP).toBe(true);
    expect(env.RUN_WORKER).toBe(true);
    expect(env.FAKE_PROVIDERS).toBe(false);
    expect(env.EMAIL_DRIVER).toBeUndefined();
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SHUTDOWN_GRACE_MS).toBe(50_000);
  });

  it('is silent by default under test', () => {
    expect(loadEnv({ NODE_ENV: 'test', ...MONGO }).LOG_LEVEL).toBe('silent');
  });

  it('fails fast without NODE_ENV or MONGODB_URI', () => {
    const err = errorOf(() => loadEnv({}));
    expect(err.message).toContain('NODE_ENV');
    expect(err.message).toContain('MONGODB_URI');
  });

  it('requires every integration secret in production, naming keys but never values', () => {
    const { OPENAI_API_KEY: _omit, ...withoutOpenAi } = PROD_SECRETS;
    const err = errorOf(() =>
      loadEnv({ NODE_ENV: 'production', ...MONGO, ...withoutOpenAi, FAKE_PROVIDERS: 'true' }),
    );
    expect(err.message).toContain('OPENAI_API_KEY: required in production');
    expect(err.message).toContain('FAKE_PROVIDERS: must be false in production');
    expect(err.message).not.toContain('sk_test');
    expect(err.message).not.toContain('mongodb://');
  });

  it('accepts a complete production env', () => {
    const env = loadEnv({ NODE_ENV: 'production', ...MONGO, ...PROD_SECRETS });
    expect(env.APP_URL).toBe('https://app.example.com');
  });

  it('treats empty strings as unset', () => {
    const env = loadEnv({ NODE_ENV: 'development', ...MONGO, PORT: '', OPENAI_API_KEY: ' ' });
    expect(env.PORT).toBe(4000);
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('parses booleans and numbers strictly', () => {
    const env = loadEnv({ NODE_ENV: 'test', ...MONGO, RUN_WORKER: 'false', PORT: '8080' });
    expect(env.RUN_WORKER).toBe(false);
    expect(env.PORT).toBe(8080);
    expect(() => loadEnv({ NODE_ENV: 'test', ...MONGO, RUN_WORKER: 'yes' })).toThrow(EnvError);
  });

  it('normalises APP_URL to an origin for the Origin check', () => {
    const env = loadEnv({ NODE_ENV: 'test', ...MONGO, APP_URL: 'https://app.example.com/' });
    expect(env.APP_URL).toBe('https://app.example.com');
  });

  it('requires RESEND_API_KEY for the resend email driver', () => {
    const err = errorOf(() => loadEnv({ NODE_ENV: 'test', ...MONGO, EMAIL_DRIVER: 'resend' }));
    expect(err.message).toContain('RESEND_API_KEY');
  });

  it('parses the JSON provider overrides', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      ...MONGO,
      PROVIDER_LIMITS: '{"perplexity":{"rpm":45,"concurrency":6}}',
    });
    expect(env.PROVIDER_LIMITS).toEqual({ perplexity: { rpm: 45, concurrency: 6 } });
    expect(() => loadEnv({ NODE_ENV: 'test', ...MONGO, PROVIDER_LIMITS: '{nope' })).toThrow(
      /PROVIDER_LIMITS: must be valid JSON/,
    );
    expect(() =>
      loadEnv({ NODE_ENV: 'test', ...MONGO, PROVIDER_DAILY_CAP_USD: '{"unknown":5}' }),
    ).toThrow(EnvError);
  });
});
