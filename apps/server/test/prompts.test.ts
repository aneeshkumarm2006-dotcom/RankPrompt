import { createFakeBrandAI, type BrandAI } from '@pv/engine';
import {
  brandSchema,
  errorEnvelopeSchema,
  generatePromptsResponseSchema,
  promptListResponseSchema,
  promptSchema,
  type Brand,
} from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';

/** Records what the API asked the AI, so tests can check the inputs. */
const calls: Parameters<BrandAI['generatePrompts']>[0][] = [];
const fake = createFakeBrandAI();
const recordingAI: BrandAI = {
  ...fake,
  generatePrompts: (input, signal) => {
    calls.push(input);
    return fake.generatePrompts(input, signal);
  },
};
const { app } = makeTestApp({ brandAI: recordingAI });

beforeAll(() => connectTestDb('prompts_test'));
afterAll(() => dropTestDb());

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

async function setup(): Promise<{ agent: Client; brand: Brand }> {
  const { agent } = await signUp(app);
  const res = await agent
    .post('/api/brands')
    .send({
      name: 'Canadim',
      websiteUrl: 'canadim.com',
      categories: [{ name: 'Immigration Consulting', description: 'Visa and PR help' }],
    })
    .expect(201);
  return { agent, brand: brandSchema.parse(res.body) };
}

const add = (agent: Client, brandId: string, texts: string[], category = 'Visas') =>
  agent
    .post(`/api/brands/${brandId}/prompts`)
    .send({ prompts: texts.map((text) => ({ text, category })) });

describe('prompt library (D-014)', () => {
  it('bulk adds, skipping repeats of active prompts and within the request', async () => {
    const { agent, brand } = await setup();
    const first = await add(agent, brand.id, [
      'Best visa consultants?',
      'Cheapest PR route?',
    ]).expect(201);
    expect(promptListResponseSchema.parse(first.body).map((p) => p.source)).toEqual([
      'manual',
      'manual',
    ]);

    const second = await add(agent, brand.id, [
      'best   VISA consultants?',
      'New one',
      'new one',
    ]).expect(201);
    expect(promptListResponseSchema.parse(second.body).map((p) => p.text)).toEqual(['New one']);

    const list = promptListResponseSchema.parse(
      (await agent.get(`/api/brands/${brand.id}/prompts`).expect(200)).body,
    );
    expect(list.map((p) => p.text)).toEqual([
      'Best visa consultants?',
      'Cheapest PR route?',
      'New one',
    ]);
  });

  it('editing text archives the prompt and creates a linked replacement', async () => {
    const { agent, brand } = await setup();
    const [original] = promptListResponseSchema.parse(
      (await add(agent, brand.id, ['Old wording here']).expect(201)).body,
    );
    if (!original) throw new Error('no prompt');

    const res = await agent
      .patch(`/api/prompts/${original.id}`)
      .send({ text: 'New wording here' })
      .expect(200);
    const replacement = promptSchema.parse(res.body);
    expect(replacement).toMatchObject({
      text: 'New wording here',
      category: 'Visas',
      replacesId: original.id,
      archivedAt: null,
    });
    expect(replacement.id).not.toBe(original.id);

    const active = promptListResponseSchema.parse(
      (await agent.get(`/api/brands/${brand.id}/prompts`).expect(200)).body,
    );
    expect(active.map((p) => p.id)).toEqual([replacement.id]);
    const all = promptListResponseSchema.parse(
      (await agent.get(`/api/brands/${brand.id}/prompts?includeArchived=true`).expect(200)).body,
    );
    expect(all.find((p) => p.id === original.id)?.archivedAt).not.toBeNull();

    // The archived version can't be edited any more.
    await agent.patch(`/api/prompts/${original.id}`).send({ text: 'Fork it' }).expect(404);
  });

  it('changes only the category in place', async () => {
    const { agent, brand } = await setup();
    const [prompt] = promptListResponseSchema.parse(
      (await add(agent, brand.id, ['Which firm is best?']).expect(201)).body,
    );
    if (!prompt) throw new Error('no prompt');
    const res = await agent
      .patch(`/api/prompts/${prompt.id}`)
      .send({ category: 'Express Entry' })
      .expect(200);
    expect(promptSchema.parse(res.body)).toMatchObject({
      id: prompt.id,
      category: 'Express Entry',
    });
    await agent.patch(`/api/prompts/${prompt.id}`).send({}).expect(400);
  });

  it('concurrent edits of one prompt fork it at most once', async () => {
    const { agent, brand } = await setup();
    const [prompt] = promptListResponseSchema.parse(
      (await add(agent, brand.id, ['Race me']).expect(201)).body,
    );
    if (!prompt) throw new Error('no prompt');
    const results = await Promise.all(
      ['Edit A', 'Edit B', 'Edit C'].map((text) =>
        agent.patch(`/api/prompts/${prompt.id}`).send({ text }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 404)).toHaveLength(2);
    const active = promptListResponseSchema.parse(
      (await agent.get(`/api/brands/${brand.id}/prompts`).expect(200)).body,
    );
    expect(active).toHaveLength(1);
  });

  it('archives with DELETE (idempotent) and 404s unknown ids', async () => {
    const { agent, brand } = await setup();
    const [prompt] = promptListResponseSchema.parse(
      (await add(agent, brand.id, ['Archive me']).expect(201)).body,
    );
    if (!prompt) throw new Error('no prompt');
    await agent.delete(`/api/prompts/${prompt.id}`).expect(204);
    await agent.delete(`/api/prompts/${prompt.id}`).expect(204);
    await agent.delete(`/api/prompts/${new Types.ObjectId().toHexString()}`).expect(404);
    expect((await agent.get(`/api/brands/${brand.id}/prompts`).expect(200)).body).toEqual([]);
  });

  it('freezes the prompts of an archived brand but keeps them readable', async () => {
    const { agent, brand } = await setup();
    const [prompt] = promptListResponseSchema.parse(
      (await add(agent, brand.id, ['Frozen prompt']).expect(201)).body,
    );
    if (!prompt) throw new Error('no prompt');
    await agent.delete(`/api/brands/${brand.id}`).expect(204);
    await agent.get(`/api/brands/${brand.id}/prompts`).expect(200);
    await add(agent, brand.id, ['More']).expect(404);
    await agent.patch(`/api/prompts/${prompt.id}`).send({ text: 'Changed' }).expect(404);
  });

  it('validates prompt text', async () => {
    const { agent, brand } = await setup();
    await add(agent, brand.id, ['no']).expect(400);
    await agent.post(`/api/brands/${brand.id}/prompts`).send({ prompts: [] }).expect(400);
  });
});

describe('POST /brands/:id/prompts/generate (F-09)', () => {
  it('returns unsaved drafts, passing the location and category descriptions to the AI', async () => {
    const { agent, brand } = await setup();
    const res = await agent
      .post(`/api/brands/${brand.id}/prompts/generate`)
      .send({
        categories: ['Immigration Consulting'],
        count: 5,
        scope: 'local',
        country: 'CA',
        city: 'Toronto',
        language: 'en',
      })
      .expect(200);
    const { drafts } = generatePromptsResponseSchema.parse(res.body);
    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.category === 'Immigration Consulting')).toBe(true);
    expect(drafts.every((d) => !/canadim/i.test(d.text))).toBe(true);
    expect(drafts[0]?.text).toContain('Toronto, Canada');

    expect(calls.at(-1)).toMatchObject({
      scope: 'local',
      country: 'CA',
      city: 'Toronto',
      language: 'en',
      brand: { name: 'Canadim', domain: 'canadim.com' },
      categories: [{ name: 'Immigration Consulting', description: 'Visa and PR help' }],
    });
    // Nothing was saved.
    expect((await agent.get(`/api/brands/${brand.id}/prompts`).expect(200)).body).toEqual([]);
  });

  it("enforces the plan's prompts-per-run limit (free = 25)", async () => {
    const { agent, brand } = await setup();
    const res = await agent
      .post(`/api/brands/${brand.id}/prompts/generate`)
      .send({ categories: ['A'], count: 26, scope: 'national', country: 'US', language: 'en' })
      .expect(422);
    expect(errorEnvelopeSchema.parse(res.body).error).toMatchObject({
      code: 'TOO_MANY_PROMPTS',
      details: { max: 25 },
    });
  });

  it('needs a city for a local scope', async () => {
    const { agent, brand } = await setup();
    const res = await agent
      .post(`/api/brands/${brand.id}/prompts/generate`)
      .send({ categories: ['A'], count: 3, scope: 'local', country: 'US', language: 'en' })
      .expect(400);
    expect(codeOf(res.body)).toBe('VALIDATION_FAILED');
  });
});
