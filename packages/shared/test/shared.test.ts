import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  ERROR_CODES,
  ERROR_STATUS,
  LANGUAGES,
  PLANS,
  PLAN_TIERS,
  PLATFORMS,
  TOPUPS,
  countryCodeSchema,
  errorEnvelopeSchema,
  isFinalRunStatus,
  languageCodeSchema,
  platformSchema,
} from '../src';

describe('enums', () => {
  it('has exactly the five platform ids (D-003)', () => {
    expect(PLATFORMS).toEqual(['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio']);
    expect(platformSchema.safeParse('google_ai_overview').success).toBe(false);
  });

  it('knows which run statuses are final', () => {
    expect(isFinalRunStatus('completed')).toBe(true);
    expect(isFinalRunStatus('canceled')).toBe(true);
    expect(isFinalRunStatus('running')).toBe(false);
  });
});

describe('errors', () => {
  it('maps every code to an HTTP error status', () => {
    for (const code of ERROR_CODES) expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
  });

  it('parses the error envelope and rejects unknown codes', () => {
    const ok = errorEnvelopeSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } });
    const bad = errorEnvelopeSchema.safeParse({ error: { code: 'NOPE', message: 'x' } });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });
});

describe('countries and languages', () => {
  it('ports the 38 countries and 18 languages from v1, without duplicates', () => {
    expect(COUNTRIES).toHaveLength(38);
    expect(LANGUAGES).toHaveLength(18);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(38);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(18);
  });

  it('validates codes', () => {
    expect(countryCodeSchema.safeParse('CA').success).toBe(true);
    expect(countryCodeSchema.safeParse('ca').success).toBe(false);
    expect(languageCodeSchema.safeParse('en').success).toBe(true);
    expect(languageCodeSchema.safeParse('English').success).toBe(false);
  });
});

describe('plans', () => {
  it('defines every tier with sane limits', () => {
    for (const tier of PLAN_TIERS) {
      const plan = PLANS[tier];
      expect(plan.tier).toBe(tier);
      expect(plan.limits.brands).toBeGreaterThan(0);
      expect(plan.limits.maxPromptsPerRun).toBeGreaterThan(0);
      expect(plan.limits.platforms.length).toBeGreaterThan(0);
      expect(Number.isInteger(plan.monthlyCredits)).toBe(true);
    }
  });

  it('keys every top-up by its own pack id', () => {
    for (const [pack, topup] of Object.entries(TOPUPS)) expect(topup.pack).toBe(pack);
  });
});
