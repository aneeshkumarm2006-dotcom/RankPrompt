import { PLANS, metaResponseSchema, plansResponseSchema, type Plan } from '@pv/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertPlatformsAllowed, assertPromptCount } from '../src/modules/workspaces/limits';
import { AppError } from '../src/http/errors';
import { connectTestDb, dropTestDb, makeTestApp } from './helpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('meta_test'));
afterAll(() => dropTestDb());

describe('GET /plans and /meta', () => {
  it('serves the plan matrix publicly', async () => {
    const res = await request(app).get('/api/plans').expect(200);
    const body = plansResponseSchema.parse(res.body);
    expect(body.plans.find((p) => p.tier === 'free')?.limits.brands).toBe(1);
    expect(body.topups.map((t) => t.credits)).toEqual([50, 100, 200]);
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('serves the form option lists publicly', async () => {
    const body = metaResponseSchema.parse((await request(app).get('/api/meta').expect(200)).body);
    expect(body.languages).toHaveLength(18);
    expect(body.platforms).toContainEqual({ id: 'google_aio', label: 'Google AI Overviews' });
  });
});

const thrown = (fn: () => void): AppError => {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error('expected an AppError');
};

describe('plan limit checks', () => {
  const narrow: Plan = {
    ...PLANS.free,
    limits: { ...PLANS.free.limits, platforms: ['chatgpt', 'gemini'] },
  };

  it('rejects platforms outside the plan (F-37)', () => {
    expect(() => assertPlatformsAllowed(narrow, ['chatgpt'])).not.toThrow();
    expect(thrown(() => assertPlatformsAllowed(narrow, ['chatgpt', 'claude']))).toMatchObject({
      code: 'PLATFORM_NOT_IN_PLAN',
      status: 403,
      details: { notAllowed: ['claude'] },
    });
  });

  it('rejects more prompts per run than the plan allows', () => {
    expect(() => assertPromptCount(narrow, 25)).not.toThrow();
    expect(thrown(() => assertPromptCount(narrow, 26))).toMatchObject({
      code: 'TOO_MANY_PROMPTS',
      status: 422,
    });
  });
});
