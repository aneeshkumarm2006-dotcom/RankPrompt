import { ProviderError, createFakeBrandAI, type BrandAI } from '@pv/engine';
import {
  analyzeBrandResponseSchema,
  brandListResponseSchema,
  brandSchema,
  errorEnvelopeSchema,
  meSchema,
  type Brand,
} from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ScheduleModel } from '../src/modules/schedules/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { normalizeWebsite } from '../src/modules/brands/service';
import { client, connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('brands_test'));
afterAll(() => dropTestDb());

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

const setTier = (workspaceId: string, tier: 'free' | 'pro') =>
  WorkspaceModel.updateOne({ _id: workspaceId }, { $set: { 'plan.tier': tier } });

async function createBrand(agent: Client, body: Record<string, unknown> = {}): Promise<Brand> {
  const res = await agent
    .post('/api/brands')
    .send({ name: 'Canadim', websiteUrl: 'canadim.com', ...body })
    .expect(201);
  return brandSchema.parse(res.body);
}

describe('normalizeWebsite', () => {
  it.each([
    ['canadim.com', 'https://canadim.com', 'canadim.com'],
    ['WWW.Canadim.com/en/', 'https://www.canadim.com/en', 'canadim.com'],
    ['http://blog.example.co.uk/?utm=1#x', 'https://blog.example.co.uk', 'example.co.uk'],
  ])('%s → %s (%s)', (input, websiteUrl, domain) => {
    expect(normalizeWebsite(input)).toEqual({ websiteUrl, domain });
  });

  it.each(['localhost', '127.0.0.1', 'http://10.0.0.1/admin', 'ftp://example.com', 'not a url'])(
    'rejects %s',
    (input) => {
      expect(() => normalizeWebsite(input)).toThrow(/public website/);
    },
  );
});

describe('POST /brands/analyze (F-07, F-08)', () => {
  it('returns the domain, summary, ≤10 categories and alias suggestions', async () => {
    const { agent } = await signUp(app);
    const res = await agent
      .post('/api/brands/analyze')
      .send({ name: 'Acme Inc', websiteUrl: 'https://www.acme.com/about' })
      .expect(200);
    const body = analyzeBrandResponseSchema.parse(res.body);
    expect(body).toMatchObject({
      domain: 'acme.com',
      websiteUrl: 'https://www.acme.com/about',
      suggestedAliases: ['Acme'],
    });
    expect(body.summary).toContain('Acme Inc');
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.categories.length).toBeLessThanOrEqual(10);
  });

  it('rejects private or malformed websites without calling the AI', async () => {
    const { agent } = await signUp(app);
    const res = await agent
      .post('/api/brands/analyze')
      .send({ name: 'Local', websiteUrl: 'http://192.168.0.1' })
      .expect(400);
    expect(codeOf(res.body)).toBe('VALIDATION_FAILED');
  });

  it('is a retryable 503 when the AI is down or not configured, without leaking details', async () => {
    const failing: BrandAI = {
      ...createFakeBrandAI(),
      analyze: () =>
        Promise.reject(new ProviderError('openai', 'transient', 'secret upstream detail')),
    };
    for (const brandAI of [failing, null]) {
      const { app: broken } = makeTestApp({ brandAI });
      const { agent } = await signUp(broken);
      const res = await agent
        .post('/api/brands/analyze')
        .send({ name: 'Acme', websiteUrl: 'acme.com' })
        .expect(503);
      expect(codeOf(res.body)).toBe('UPSTREAM_UNAVAILABLE');
      expect(JSON.stringify(res.body)).not.toContain('secret upstream detail');
    }
  });
});

describe('brands CRUD', () => {
  it('creates a brand with normalised domain, aliases, competitors and workspace defaults', async () => {
    const { agent } = await signUp(app);
    const brand = await createBrand(agent, {
      websiteUrl: 'https://www.canadim.com/en/',
      aliases: ['Canadim Law', 'canadim'],
      categories: [{ name: 'Immigration Consulting', description: 'Visas', source: 'generated' }],
      competitors: [{ name: 'Visa Place', domain: 'https://www.visaplace.com', aliases: [] }],
    });
    expect(brand).toMatchObject({
      name: 'Canadim',
      domain: 'canadim.com',
      websiteUrl: 'https://www.canadim.com/en',
      aliases: ['Canadim', 'Canadim Law'],
      defaults: { country: 'US', city: null, language: 'en', scope: 'national' },
      archivedAt: null,
    });
    expect(brand.defaults.platforms).toHaveLength(5);
    expect(brand.competitors).toHaveLength(1);
    expect(brand.competitors[0]?.id).toMatch(/^[a-f0-9]{24}$/);
    expect(brand.competitors[0]).toMatchObject({
      name: 'Visa Place',
      domain: 'visaplace.com',
      aliases: ['Visa Place'],
    });

    const me = meSchema.parse((await agent.get('/api/me').expect(200)).body);
    expect(me.workspace.limits.brandsUsed).toBe(1);
    const fetched = await agent.get(`/api/brands/${brand.id}`).expect(200);
    expect(brandSchema.parse(fetched.body)).toEqual(brand);
  });

  it('enforces the plan brand limit (free = 1)', async () => {
    const { agent } = await signUp(app);
    await createBrand(agent);
    const res = await agent
      .post('/api/brands')
      .send({ name: 'Second', websiteUrl: 'second.com' })
      .expect(409);
    expect(errorEnvelopeSchema.parse(res.body).error).toMatchObject({
      code: 'BRAND_LIMIT_REACHED',
      details: { limit: 1, used: 1 },
    });
  });

  it('never exceeds the limit under concurrent creates', async () => {
    const { agent, me } = await signUp(app);
    await setTier(me.workspace.id, 'pro'); // 3 brands
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        agent.post('/api/brands').send({ name: `Brand ${i}`, websiteUrl: `brand${i}.com` }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409, 409]);
    const list = brandListResponseSchema.parse((await agent.get('/api/brands').expect(200)).body);
    expect(list).toHaveLength(3);
  });

  it('rejects a second active brand on the same domain', async () => {
    const { agent, me } = await signUp(app);
    await setTier(me.workspace.id, 'pro');
    await createBrand(agent);
    const res = await agent
      .post('/api/brands')
      .send({ name: 'Canadim again', websiteUrl: 'https://blog.canadim.com' })
      .expect(409);
    expect(codeOf(res.body)).toBe('BRAND_EXISTS');
  });

  it('patches fields, keeps the name in the aliases and re-checks the domain', async () => {
    const { agent, me } = await signUp(app);
    await setTier(me.workspace.id, 'pro');
    const brand = await createBrand(agent, { aliases: ['CNDM'] });
    await createBrand(agent, { name: 'Other', websiteUrl: 'other.com' });

    const renamed = await agent
      .patch(`/api/brands/${brand.id}`)
      .send({ name: 'Canadim Immigration', summary: 'New summary' })
      .expect(200);
    expect(brandSchema.parse(renamed.body)).toMatchObject({
      name: 'Canadim Immigration',
      summary: 'New summary',
      aliases: ['Canadim Immigration', 'CNDM'],
    });

    const taken = await agent
      .patch(`/api/brands/${brand.id}`)
      .send({ websiteUrl: 'other.com' })
      .expect(409);
    expect(codeOf(taken.body)).toBe('BRAND_EXISTS');

    const moved = await agent
      .patch(`/api/brands/${brand.id}`)
      .send({ websiteUrl: 'canadim.ca' })
      .expect(200);
    expect(brandSchema.parse(moved.body).domain).toBe('canadim.ca');

    await agent
      .patch(`/api/brands/${brand.id}`)
      .send({ defaults: { country: 'CA', language: 'fr', scope: 'local', platforms: ['chatgpt'] } })
      .expect(400);
    const local = await agent
      .patch(`/api/brands/${brand.id}`)
      .send({
        defaults: {
          country: 'CA',
          city: 'Toronto',
          language: 'fr',
          scope: 'local',
          platforms: ['chatgpt'],
        },
      })
      .expect(200);
    expect(brandSchema.parse(local.body).defaults).toEqual({
      country: 'CA',
      city: 'Toronto',
      language: 'fr',
      scope: 'local',
      platforms: ['chatgpt'],
    });
    await agent.patch(`/api/brands/${brand.id}`).send({}).expect(400);
    await agent
      .patch(`/api/brands/${brand.id}`)
      .send({ defaults: { country: 'CA', language: 'en', scope: 'national', platforms: ['bing'] } })
      .expect(400);
  });

  it('replaces competitors, keeping ids that are passed back', async () => {
    const { agent } = await signUp(app);
    const brand = await createBrand(agent, {
      competitors: [{ name: 'Visa Place', domain: 'visaplace.com' }],
    });
    const keptId = brand.competitors[0]?.id;

    const res = await agent
      .put(`/api/brands/${brand.id}/competitors`)
      .send({
        competitors: [
          { id: keptId, name: 'VisaPlace', domain: 'www.visaplace.com', aliases: ['Visa Place'] },
          { name: 'Moving2Canada', domain: 'moving2canada.com' },
        ],
      })
      .expect(200);
    const updated = brandSchema.parse(res.body);
    expect(updated.competitors.map((c) => [c.name, c.domain])).toEqual([
      ['VisaPlace', 'visaplace.com'],
      ['Moving2Canada', 'moving2canada.com'],
    ]);
    expect(updated.competitors[0]?.id).toBe(keptId);
    expect(updated.competitors[1]?.id).not.toBe(keptId);

    for (const competitors of [
      [{ name: 'Self', domain: 'canadim.com' }],
      [
        { name: 'A', domain: 'a.com' },
        { name: 'A again', domain: 'www.a.com' },
      ],
      [{ name: 'Private', domain: 'localhost' }],
    ]) {
      const bad = await agent
        .put(`/api/brands/${brand.id}/competitors`)
        .send({ competitors })
        .expect(400);
      expect(codeOf(bad.body)).toBe('VALIDATION_FAILED');
    }
    await agent.put(`/api/brands/${brand.id}/competitors`).send({ competitors: [] }).expect(200);
  });

  it('archives a brand: pauses its schedules, frees the slot, keeps it readable', async () => {
    const { agent, me } = await signUp(app);
    const brand = await createBrand(agent);
    await ScheduleModel.create({
      workspaceId: me.workspace.id,
      brandId: brand.id,
      frequency: 'weekly',
      hour: 9,
      timezone: 'UTC',
      weekday: 1,
      platforms: ['chatgpt'],
      country: 'US',
      language: 'en',
      scope: 'national',
      nextRunAt: new Date(),
    });
    const listed = brandListResponseSchema.parse((await agent.get('/api/brands').expect(200)).body);
    expect(listed[0]).toMatchObject({
      id: brand.id,
      activeSchedules: 1,
      promptCount: 0,
      latestRun: null,
    });

    await agent.delete(`/api/brands/${brand.id}`).expect(204);

    const schedule = await ScheduleModel.findOne({
      workspaceId: me.workspace.id,
      brandId: brand.id,
    }).lean();
    expect(schedule).toMatchObject({
      isActive: false,
      pausedReason: 'brand_archived',
      nextRunAt: null,
    });
    expect((await agent.get('/api/brands').expect(200)).body).toEqual([]);
    const archived = brandSchema.parse(
      (await agent.get(`/api/brands/${brand.id}`).expect(200)).body,
    );
    expect(archived.archivedAt).not.toBeNull();
    await agent.patch(`/api/brands/${brand.id}`).send({ name: 'X' }).expect(404);
    await agent.delete(`/api/brands/${brand.id}`).expect(404);

    // The slot is free again, even for the same domain.
    await createBrand(agent);
  });

  it('404s unknown ids and 400s malformed ones', async () => {
    const { agent } = await signUp(app);
    await agent.get(`/api/brands/${new Types.ObjectId().toHexString()}`).expect(404);
    const bad = await agent.get('/api/brands/not-an-id').expect(400);
    expect(codeOf(bad.body)).toBe('VALIDATION_FAILED');
  });

  it('requires sign-in', async () => {
    await client(app).get('/api/brands').expect(401);
  });
});
