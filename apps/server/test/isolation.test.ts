import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandSchema, errorEnvelopeSchema, promptListResponseSchema } from '@pv/shared';
import request from 'supertest';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROTECTED_PREFIXES } from '../src/http/app';
import { BrandModel } from '../src/modules/brands/model';
import { PromptModel } from '../src/modules/prompts/model';
import { ResultModel } from '../src/modules/results/model';
import { RunModel } from '../src/modules/runs/model';
import { ScheduleModel } from '../src/modules/schedules/model';
import { ShareModel } from '../src/modules/shares/model';
import { APP_URL, connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';
import { completeRun, createRun } from './runHelpers';

/**
 * Workspace isolation, layer 4 (07): workspace B calls every route that takes an id against
 * workspace A's resources and must get 404 (never 403, never data), with A's data unchanged.
 * The route list comes from the source, so a new id route fails this suite until it's covered.
 */

const { app } = makeTestApp();

beforeAll(() => connectTestDb('isolation_test'));
afterAll(() => dropTestDb());

// ---- Route discovery ------------------------------------------------------------------------

const MODULES = join(import.meta.dirname, '../src/modules');
const ROUTE_RE = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;

function discoverRoutes(): string[] {
  const routes: string[] = [];
  for (const mod of readdirSync(MODULES)) {
    let source: string;
    try {
      source = readFileSync(join(MODULES, mod, 'routes.ts'), 'utf8');
    } catch {
      continue;
    }
    for (const [, method, path] of source.matchAll(ROUTE_RE)) {
      routes.push(`${method?.toUpperCase()} ${path}`);
    }
  }
  return routes.sort();
}

const ROUTES = discoverRoutes();

/** Routes reachable without a session. Adding one here is a deliberate, reviewed decision. */
const PUBLIC_ROUTES = [
  'GET /health',
  'GET /ready',
  'GET /plans',
  'GET /meta',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/google',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/verify-email',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'GET /public/shares/:token',
  // Authenticated by the Stripe signature instead of a session (06, test/billing.test.ts).
  'POST /stripe/webhook',
];
/** Outside PROTECTED_PREFIXES but guarded by requireAuth on the route itself. */
const INLINE_PROTECTED = ['POST /auth/resend-verification', 'POST /auth/logout-all'];

describe('route inventory', () => {
  it('finds the routes', () => {
    expect(ROUTES.length).toBeGreaterThan(20);
    expect(ROUTES).toContain('GET /brands/:id');
  });

  it('every route is either explicitly public or requires a session', async () => {
    for (const route of ROUTES) {
      if (PUBLIC_ROUTES.includes(route)) continue;
      const [method = '', path = ''] = route.split(' ');
      const isProtected =
        INLINE_PROTECTED.includes(route) ||
        PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
      expect(isProtected, `${route} is neither public nor under a protected prefix`).toBe(true);

      const url = `/api${path.replace(/:id/g, '0123456789abcdef01234567')}`;
      const verb = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const res = await request(app)[verb](url).set('Origin', APP_URL).send({});
      expect(res.status, `${route} without a session`).toBe(401);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
    }
  });
});

// ---- Cross-workspace calls ------------------------------------------------------------------

interface Fixture {
  brandId: string;
  promptId: string;
  runId: string;
  shareId: string;
  scheduleId: string;
}

type Call = (b: Client, a: Fixture) => request.Test;

/** One entry per id route. B acts on A's ids. */
const ID_ROUTE_CALLS: Record<string, Call> = {
  'GET /brands/:id': (b, a) => b.get(`/api/brands/${a.brandId}`),
  'PATCH /brands/:id': (b, a) => b.patch(`/api/brands/${a.brandId}`).send({ name: 'Hacked' }),
  'DELETE /brands/:id': (b, a) => b.delete(`/api/brands/${a.brandId}`),
  'PUT /brands/:id/competitors': (b, a) =>
    b.put(`/api/brands/${a.brandId}/competitors`).send({ competitors: [] }),
  'GET /brands/:id/prompts': (b, a) => b.get(`/api/brands/${a.brandId}/prompts?includeArchived=1`),
  'POST /brands/:id/prompts': (b, a) =>
    b
      .post(`/api/brands/${a.brandId}/prompts`)
      .send({ prompts: [{ text: 'Injected prompt', category: 'X' }] }),
  'POST /brands/:id/prompts/generate': (b, a) =>
    b.post(`/api/brands/${a.brandId}/prompts/generate`).send({
      categories: ['X'],
      count: 1,
      scope: 'national',
      country: 'US',
      language: 'en',
    }),
  'PATCH /prompts/:id': (b, a) => b.patch(`/api/prompts/${a.promptId}`).send({ text: 'Hacked' }),
  'DELETE /prompts/:id': (b, a) => b.delete(`/api/prompts/${a.promptId}`),
  'GET /runs/:id': (b, a) => b.get(`/api/runs/${a.runId}`),
  'GET /runs/:id/results': (b, a) => b.get(`/api/runs/${a.runId}/results`),
  'POST /runs/:id/cancel': (b, a) => b.post(`/api/runs/${a.runId}/cancel`),
  'DELETE /runs/:id': (b, a) => b.delete(`/api/runs/${a.runId}`),
  'GET /runs/:id/export.xlsx': (b, a) => b.get(`/api/runs/${a.runId}/export.xlsx`),
  'POST /runs/:id/shares': (b, a) => b.post(`/api/runs/${a.runId}/shares`).send({}),
  'GET /runs/:id/shares': (b, a) => b.get(`/api/runs/${a.runId}/shares`),
  'DELETE /shares/:id': (b, a) => b.delete(`/api/shares/${a.shareId}`),
  'GET /brands/:id/insights/overview': (b, a) =>
    b.get(`/api/brands/${a.brandId}/insights/overview`),
  'GET /brands/:id/insights/trend': (b, a) => b.get(`/api/brands/${a.brandId}/insights/trend`),
  'GET /brands/:id/insights/competitors': (b, a) =>
    b.get(`/api/brands/${a.brandId}/insights/competitors?runId=${a.runId}`),
  'GET /brands/:id/insights/sources': (b, a) => b.get(`/api/brands/${a.brandId}/insights/sources`),
  'GET /brands/:id/insights/prompts': (b, a) => b.get(`/api/brands/${a.brandId}/insights/prompts`),
  'GET /brands/:id/schedules': (b, a) => b.get(`/api/brands/${a.brandId}/schedules`),
  'PATCH /schedules/:id': (b, a) => b.patch(`/api/schedules/${a.scheduleId}`).send({ hour: 3 }),
  'POST /schedules/:id/pause': (b, a) => b.post(`/api/schedules/${a.scheduleId}/pause`),
  'POST /schedules/:id/resume': (b, a) => b.post(`/api/schedules/${a.scheduleId}/resume`),
  'POST /schedules/:id/run-now': (b, a) =>
    b.post(`/api/schedules/${a.scheduleId}/run-now`).set('Idempotency-Key', 'isolation-run-now'),
  'DELETE /schedules/:id': (b, a) => b.delete(`/api/schedules/${a.scheduleId}`),
};

describe('cross-workspace isolation (3.9)', () => {
  let a: Fixture;
  let workspaceA: string;
  let agentB: Client;

  const snapshot = async () =>
    JSON.stringify({
      brands: await BrandModel.find({ workspaceId: workspaceA }).lean(),
      prompts: await PromptModel.find({ workspaceId: workspaceA }).lean(),
      schedules: await ScheduleModel.find({ workspaceId: workspaceA }).lean(),
      runs: await RunModel.find({ workspaceId: workspaceA }).lean(),
      results: await ResultModel.find({ workspaceId: workspaceA }).lean(),
      shares: await ShareModel.find({ workspaceId: workspaceA }).lean(),
    });

  beforeAll(async () => {
    const userA = await signUp(app);
    workspaceA = userA.me.workspace.id;
    const brand = brandSchema.parse(
      (
        await userA.agent
          .post('/api/brands')
          .send({
            name: 'Alpha',
            websiteUrl: 'alpha.com',
            competitors: [{ name: 'Beta', domain: 'beta.com' }],
          })
          .expect(201)
      ).body,
    );
    const [prompt] = promptListResponseSchema.parse(
      (
        await userA.agent
          .post(`/api/brands/${brand.id}/prompts`)
          .send({ prompts: [{ text: 'Best alpha tools?', category: 'Tools' }] })
          .expect(201)
      ).body,
    );
    if (!prompt) throw new Error('no prompt');
    const schedule = await ScheduleModel.create({
      workspaceId: workspaceA,
      brandId: brand.id,
      frequency: 'daily',
      hour: 8,
      timezone: 'UTC',
      platforms: ['chatgpt'],
      country: 'US',
      language: 'en',
      scope: 'national',
    });
    const run = await createRun(userA.agent, { brandId: brand.id, promptIds: [prompt.id] });
    await completeRun(userA.agent, run.id);
    const share = (await userA.agent.post(`/api/runs/${run.id}/shares`).send({}).expect(201))
      .body as { id: string };
    a = {
      brandId: brand.id,
      promptId: prompt.id,
      runId: run.id,
      shareId: share.id,
      scheduleId: schedule._id.toHexString(),
    };

    const userB = await signUp(app);
    agentB = userB.agent;
    // B owns a brand too, so "B has nothing" can't explain the 404s.
    await agentB.post('/api/brands').send({ name: 'Bravo', websiteUrl: 'bravo.com' }).expect(201);
  });

  it('covers every id route in the API', () => {
    const idRoutes = ROUTES.filter((r) => r.includes(':id'));
    expect(Object.keys(ID_ROUTE_CALLS).sort()).toEqual(idRoutes);
  });

  it.each(Object.keys(ID_ROUTE_CALLS))(
    '%s → 404 for another workspace, nothing changes',
    async (route) => {
      const before = await snapshot();
      const call = ID_ROUTE_CALLS[route];
      if (!call) throw new Error(route);
      const res = await call(agentB, a);
      expect(res.status).toBe(404);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toContain('Alpha');
      expect(await snapshot()).toBe(before);
    },
  );

  it("doesn't list or count another workspace's data", async () => {
    const brands = (await agentB.get('/api/brands').expect(200)).body as { name: string }[];
    expect(brands.map((b) => b.name)).toEqual(['Bravo']);
    const runs = (await agentB.get('/api/runs').expect(200)).body as { items: unknown[] };
    expect(runs.items).toEqual([]);
    const filtered = (await agentB.get(`/api/runs?brandId=${a.brandId}`).expect(200)).body as {
      items: unknown[];
    };
    expect(filtered.items).toEqual([]);
  });

  it("can't estimate or start a run on another workspace's brand or prompts", async () => {
    const before = await snapshot();
    const body = {
      brandId: a.brandId,
      promptIds: [a.promptId],
      platforms: ['chatgpt'],
      country: 'US',
      language: 'en',
      scope: 'national',
    };
    expect((await agentB.post('/api/runs/estimate').send(body)).status).toBe(404);
    expect(
      (await agentB.post('/api/runs').set('Idempotency-Key', 'iso-run-1').send(body)).status,
    ).toBe(404);
    const [bravo] = (await agentB.get('/api/brands').expect(200)).body as { id: string }[];
    const foreignPrompt = await agentB
      .post('/api/runs')
      .set('Idempotency-Key', 'iso-run-2')
      .send({ ...body, brandId: bravo?.id });
    expect(foreignPrompt.status).toBe(400);
    expect(await snapshot()).toBe(before);
  });

  it("can't create a schedule on another workspace's brand or prompts", async () => {
    const before = await snapshot();
    const body = {
      brandId: a.brandId,
      frequency: 'weekly',
      weekday: 1,
      hour: 9,
      timezone: 'UTC',
      platforms: ['chatgpt'],
      promptSelection: { mode: 'all_active' },
      country: 'US',
      language: 'en',
      scope: 'national',
    };
    const res = await agentB.post('/api/schedules').send(body).expect(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');

    // On B's own brand, A's prompt ids are unknown prompts.
    const [own] = z.array(brandSchema).parse((await agentB.get('/api/brands').expect(200)).body);
    if (!own) throw new Error('B has no brand');
    const fixed = await agentB
      .post('/api/schedules')
      .send({
        ...body,
        brandId: own.id,
        promptSelection: { mode: 'fixed', promptIds: [a.promptId] },
      })
      .expect(400);
    expect(errorEnvelopeSchema.parse(fixed.body).error.code).toBe('VALIDATION_FAILED');
    expect(await snapshot()).toBe(before);
  });

  it("can't adopt another workspace's competitor id", async () => {
    const alpha = await BrandModel.findOne({ workspaceId: workspaceA }).lean();
    const foreignId = alpha?.competitors[0]?._id.toHexString();
    expect(foreignId).toBeDefined();
    const [bravo] = (await agentB.get('/api/brands').expect(200)).body as { id: string }[];
    const res = await agentB
      .put(`/api/brands/${bravo?.id}/competitors`)
      .send({ competitors: [{ id: foreignId, name: 'Beta', domain: 'beta.com' }] })
      .expect(200);
    expect(brandSchema.parse(res.body).competitors[0]?.id).not.toBe(foreignId);
  });

  it('A still sees all of its own data', async () => {
    const brand = await BrandModel.findOne({ workspaceId: workspaceA, _id: a.brandId }).lean();
    expect(brand).toMatchObject({ name: 'Alpha', archivedAt: null });
    expect(await PromptModel.countDocuments({ workspaceId: workspaceA, archivedAt: null })).toBe(1);
  });
});
