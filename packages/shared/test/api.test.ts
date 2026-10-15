import { describe, expect, it } from 'vitest';
import {
  PLAN_TIERS,
  buildMetaResponse,
  buildPlansResponse,
  createBrandBodySchema,
  generatePromptsBodySchema,
  idParamsSchema,
  isCommonPassword,
  metaResponseSchema,
  passwordSchema,
  plansResponseSchema,
  referralCodeSchema,
  registerBodySchema,
} from '../src';

describe('password policy', () => {
  it('needs 8+ characters, at most 72 bytes, and not a common password', () => {
    expect(passwordSchema.safeParse('correct horse').success).toBe(true);
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('Password123').success).toBe(false);
    expect(isCommonPassword('QWERTYUIOP')).toBe(true);
    expect(passwordSchema.safeParse('é'.repeat(36)).success).toBe(true); // 72 bytes
    expect(passwordSchema.safeParse('é'.repeat(37)).success).toBe(false);
  });
});

describe('auth schemas', () => {
  it('normalises the email and strips unknown keys', () => {
    const body = registerBodySchema.parse({
      name: '  Ada   Lovelace ',
      email: ' Ada@Example.COM ',
      password: 'correct horse',
      role: 'admin',
    });
    expect(body).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct horse',
    });
  });

  it('accepts referral codes case-insensitively', () => {
    expect(referralCodeSchema.parse(' abcd2345 ')).toBe('ABCD2345');
    expect(referralCodeSchema.safeParse('abc').success).toBe(false);
  });
});

describe('ids', () => {
  it('accepts 24-hex ids only, lowercased', () => {
    expect(idParamsSchema.parse({ id: 'ABCDEF0123456789ABCDEF01' }).id).toBe(
      'abcdef0123456789abcdef01',
    );
    expect(idParamsSchema.safeParse({ id: '{"$ne":null}' }).success).toBe(false);
  });
});

describe('brand and prompt schemas', () => {
  it('fills brand defaults and requires a city for a local scope', () => {
    const body = createBrandBodySchema.parse({ name: 'Acme', websiteUrl: 'acme.com' });
    expect(body).toMatchObject({ summary: '', categories: [], aliases: [], competitors: [] });
    const local = createBrandBodySchema.safeParse({
      name: 'Acme',
      websiteUrl: 'acme.com',
      defaults: { country: 'CA', language: 'en', scope: 'local', platforms: ['chatgpt'] },
    });
    expect(local.success).toBe(false);
  });

  it('rejects duplicate category names and unknown platforms', () => {
    const dupes = createBrandBodySchema.safeParse({
      name: 'Acme',
      websiteUrl: 'acme.com',
      categories: [{ name: 'CRM' }, { name: 'crm' }],
    });
    expect(dupes.success).toBe(false);
    const platform = createBrandBodySchema.safeParse({
      name: 'Acme',
      websiteUrl: 'acme.com',
      defaults: {
        country: 'US',
        language: 'en',
        scope: 'national',
        platforms: ['google_ai_overview'],
      },
    });
    expect(platform.success).toBe(false);
  });

  it('bounds prompt generation', () => {
    const base = { categories: ['CRM'], scope: 'national', country: 'US', language: 'en' };
    expect(generatePromptsBodySchema.safeParse({ ...base, count: 0 }).success).toBe(false);
    expect(generatePromptsBodySchema.safeParse({ ...base, count: 151 }).success).toBe(false);
    expect(generatePromptsBodySchema.parse({ ...base, count: 10 }).city).toBeNull();
  });
});

describe('GET /plans and /meta payloads', () => {
  it('serve every plan and the option lists, matching their schemas', () => {
    const plans = plansResponseSchema.parse(buildPlansResponse());
    expect(plans.plans.map((p) => p.tier)).toEqual([...PLAN_TIERS]);
    expect(plans.grants.signupBonus).toBe(50);
    const meta = metaResponseSchema.parse(buildMetaResponse());
    expect(meta.countries).toHaveLength(38);
    expect(meta.platforms.map((p) => p.id)).toContain('google_aio');
  });
});
