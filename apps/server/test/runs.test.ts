import { randomUUID } from 'node:crypto';
import { ProviderError, createFakeAdapter } from '@pv/engine';
import {
  checkResultPageSchema,
  errorEnvelopeSchema,
  runEstimateSchema,
  runListResponseSchema,
  runSchema,
  type BrandListItem,
} from '@pv/shared';
import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '../src/db/transaction';
import { JobModel } from '../src/jobs/model';
import { adminAdjust } from '../src/modules/credits/service';
import { LedgerModel } from '../src/modules/credits/model';
import { ResultModel } from '../src/modules/results/model';
import { RunModel } from '../src/modules/runs/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import {
  connectTestDb,
  dropTestDb,
  fakeCheckEngine,
  makeTestApp,
  signUp,
  type Client,
} from './helpers';
import {
  brandWithPrompts,
  completeRun,
  createRun,
  expectLedgerBalanced,
  testWorker,
  waitForRun,
} from './runHelpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('runs_test'));
afterAll(() => dropTestDb());

const credits = async (workspaceId: string) =>
  (await WorkspaceModel.findById(workspaceId).lean())?.credits;

async function account() {
  const user = await signUp(app);
  return { agent: user.agent, ws: user.me.workspace.id };
}

const runBody = (brandId: string, promptIds: string[], platforms = ['chatgpt', 'perplexity']) => ({
  brandId,
  promptIds,
  platforms,
  country: 'US',
  language: 'en',
  scope: 'national',
});

describe('POST /runs/estimate', () => {
  it('prices a run at prompts × platforms and compares it with the balance', async () => {
    const { agent } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 3);
    const estimate = runEstimateSchema.parse(
      (
        await agent
          .post('/api/runs/estimate')
          .send({ brandId, promptIds, platforms: ['chatgpt', 'gemini', 'claude'] })
          .expect(200)
      ).body,
    );
    expect(estimate).toEqual({
      checks: 9,
      credits: 9,
      balance: { plan: 0, purchased: 50 },
      sufficient: true,
    });
  });

  it("enforces the plan's prompt cap (422 TOO_MANY_PROMPTS)", async () => {
    const { agent } = await account();
    const { brandId } = await brandWithPrompts(agent, 1);
    const ids = Array.from({ length: 26 }, () => new Types.ObjectId().toHexString());
    const res = await agent
      .post('/api/runs/estimate')
      .send({ brandId, promptIds: ids, platforms: ['chatgpt'] })
      .expect(422);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('TOO_MANY_PROMPTS');
  });
});

describe('POST /runs', () => {
  it('reserves credits and creates the run, its checks and their jobs in one go', async () => {
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds });

    expect(run).toMatchObject({
      status: 'queued',
      trigger: 'manual',
      promptCount: 2,
      progress: { total: 4, pending: 4, ok: 0 },
      credits: { reserved: 4, charged: 0, refunded: 0 },
      aggregates: null,
      brand: { name: 'Acme Analytics' },
    });
    expect(run.brand.competitors.map((c) => c.name)).toEqual(['Globex', 'Initech']);
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 46 });
    expect(await ResultModel.countDocuments({ workspaceId: ws, runId: run.id })).toBe(4);
    expect(await JobModel.countDocuments({ runId: run.id, type: 'check', status: 'queued' })).toBe(
      4,
    );
    const ledger = await LedgerModel.find({ workspaceId: ws, reason: 'run_reserve' }).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      delta: -4,
      bucket: 'purchased',
      refType: 'run',
      refId: run.id,
    });
    await expectLedgerBalanced(ws);
  });

  it('is idempotent: the same Idempotency-Key returns the same run, charged once', async () => {
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 1);
    const key = randomUUID();
    const first = await createRun(agent, { brandId, promptIds }, key, 201);
    const again = await createRun(agent, { brandId, promptIds }, key, 200);
    expect(again.id).toBe(first.id);

    // Two at once with a fresh key: one run, one charge.
    const key2 = randomUUID();
    const [a, b] = await Promise.all([
      agent.post('/api/runs').set('Idempotency-Key', key2).send(runBody(brandId, promptIds)),
      agent.post('/api/runs').set('Idempotency-Key', key2).send(runBody(brandId, promptIds)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(runSchema.parse(a.body).id).toBe(runSchema.parse(b.body).id);
    expect(await RunModel.countDocuments({ workspaceId: ws })).toBe(2);
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 46 });
    await expectLedgerBalanced(ws);
  });

  it('needs an Idempotency-Key', async () => {
    const { agent } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 1);
    const res = await agent.post('/api/runs').send(runBody(brandId, promptIds)).expect(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a run the balance can’t cover (402), creating nothing', async () => {
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 13);
    const res = await agent
      .post('/api/runs')
      .set('Idempotency-Key', randomUUID())
      .send(runBody(brandId, promptIds, ['chatgpt', 'perplexity', 'gemini', 'claude']))
      .expect(402);
    expect(errorEnvelopeSchema.parse(res.body).error).toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      details: { required: 52, available: 50 },
    });
    expect(await RunModel.countDocuments({ workspaceId: ws })).toBe(0);
    expect(await ResultModel.countDocuments({ workspaceId: ws })).toBe(0);
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 50 });
    await expectLedgerBalanced(ws);
  });

  it('spends plan credits first, then purchased', async () => {
    const { agent, ws } = await account();
    await withTransaction((session) =>
      adminAdjust(session, {
        workspaceId: new Types.ObjectId(ws),
        bucket: 'plan',
        delta: 3,
        note: 'test plan credits',
      }),
    );
    const { brandId, promptIds } = await brandWithPrompts(agent, 4);
    await createRun(agent, { brandId, promptIds, platforms: ['chatgpt'] });
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 49 });
    await expectLedgerBalanced(ws);
  });

  it('rejects archived and unknown prompts', async () => {
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    await agent.delete(`/api/prompts/${promptIds[0]}`).expect(204);
    for (const ids of [promptIds, [promptIds[1] ?? '', new Types.ObjectId().toHexString()]]) {
      await agent
        .post('/api/runs')
        .set('Idempotency-Key', randomUUID())
        .send(runBody(brandId, ids))
        .expect(400);
    }
    expect(await RunModel.countDocuments({ workspaceId: ws })).toBe(0);
  });

  it('refuses platforms the server has no key for (503), before charging', async () => {
    const engine = fakeCheckEngine();
    delete engine.adapters.claude;
    const { app: noClaude } = makeTestApp({ checks: engine });
    const user = await signUp(noClaude);
    const { brandId, promptIds } = await brandWithPrompts(user.agent, 1);
    const res = await user.agent
      .post('/api/runs')
      .set('Idempotency-Key', randomUUID())
      .send(runBody(brandId, promptIds, ['chatgpt', 'claude']))
      .expect(503);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(await credits(user.me.workspace.id)).toEqual({ plan: 0, purchased: 50 });
  });
});

describe('a run end to end', () => {
  let agent: Client;
  let ws: string;
  let runId: string;
  let brandId: string;

  beforeAll(async () => {
    ({ agent, ws } = await account());
    const made = await brandWithPrompts(agent, 3);
    brandId = made.brandId;
    const run = await createRun(agent, {
      brandId,
      promptIds: made.promptIds,
      platforms: ['chatgpt', 'perplexity', 'google_aio'],
    });
    runId = run.id;
    await completeRun(agent, runId);
  });

  it('finishes with aggregates, charged in full', async () => {
    const run = runSchema.parse((await agent.get(`/api/runs/${runId}`).expect(200)).body);
    expect(run.status).toBe('completed');
    expect(run.progress.pending).toBe(0);
    expect(run.progress.ok + run.progress.noAnswer).toBe(9);
    expect(run.credits).toEqual({ reserved: 9, charged: 9, refunded: 0 });
    expect(run.metricsVersion).toBe('1');
    expect(run.models.chatgpt).toBe('fake-chatgpt');
    const agg = run.aggregates;
    expect(agg?.total.visibility.den).toBe(run.progress.ok);
    expect(Object.keys(agg?.byPlatform ?? {}).sort()).toEqual([
      'chatgpt',
      'google_aio',
      'perplexity',
    ]);
    expect(agg?.byPlatform.google_aio?.aioPresence?.den).toBe(3);
    expect(agg?.competitors.map((c) => c.name)).toEqual(['Globex', 'Initech']);
    expect(agg?.topCitedDomains.length).toBeGreaterThan(0);
    await expectLedgerBalanced(ws);
  });

  it('lists results with filters and a cursor', async () => {
    const all = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${runId}/results`).expect(200)).body,
    );
    expect(all.items).toHaveLength(9);
    expect(all.nextCursor).toBeNull();
    const ok = all.items.find((r) => r.status === 'ok');
    expect(ok?.vendors.length).toBeGreaterThan(0);
    expect(ok?.competitors.map((c) => c.name)).toEqual(['Globex', 'Initech']);

    const page1 = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${runId}/results?limit=4`).expect(200)).body,
    );
    const page2 = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${runId}/results?limit=4&cursor=${page1.nextCursor}`).expect(200))
        .body,
    );
    expect(page1.items.map((r) => r.id)).toEqual(all.items.slice(0, 4).map((r) => r.id));
    expect(page2.items.map((r) => r.id)).toEqual(all.items.slice(4, 8).map((r) => r.id));

    const chatgpt = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${runId}/results?platform=chatgpt`).expect(200)).body,
    );
    expect(chatgpt.items.every((r) => r.platform === 'chatgpt')).toBe(true);
    expect(chatgpt.items).toHaveLength(3);
    const mentioned = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${runId}/results?mentioned=true`).expect(200)).body,
    );
    expect(mentioned.items.every((r) => r.brand.mentioned)).toBe(true);
  });

  it('shows up in the run list and on the brand', async () => {
    const list = runListResponseSchema.parse(
      (await agent.get(`/api/runs?brandId=${brandId}`).expect(200)).body,
    );
    expect(list.items[0]).toMatchObject({
      id: runId,
      status: 'completed',
      checks: 9,
      progress: null,
    });
    expect(list.items[0]?.visibility).not.toBeNull();
    const brands = (await agent.get('/api/brands').expect(200)).body as BrandListItem[];
    expect(brands[0]?.latestRun).toMatchObject({ id: runId, status: 'completed' });
  });

  it('exports an XLSX with the documented sheets', async () => {
    const res = await agent
      .get(`/api/runs/${runId}/export.xlsx`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=".+\.xlsx"/);
    const wb = new ExcelJS.Workbook();
    const buf = res.body as Buffer;
    await wb.xlsx.load(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Summary',
      'Prompt Rankings',
      'AI Answers',
      'Citations',
      'Competitors',
    ]);
    expect(wb.getWorksheet('Prompt Rankings')?.rowCount).toBe(10);
  });

  it("can't be canceled once finished (409)", async () => {
    const res = await agent.post(`/api/runs/${runId}/cancel`).expect(409);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('CONFLICT');
  });

  it('deletes a finished run with its results; ledger rows stay', async () => {
    await agent.delete(`/api/runs/${runId}`).expect(204);
    await agent.get(`/api/runs/${runId}`).expect(404);
    expect(await ResultModel.countDocuments({ workspaceId: ws, runId })).toBe(0);
    expect(await LedgerModel.countDocuments({ workspaceId: ws, refId: runId })).toBe(1);
    await expectLedgerBalanced(ws);
  });
});

describe('cancel, failures and refunds', () => {
  it('cancel before any check runs refunds everything', async () => {
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds });
    await agent.delete(`/api/runs/${run.id}`).expect(409); // not final yet

    const canceled = runSchema.parse(
      (await agent.post(`/api/runs/${run.id}/cancel`).expect(200)).body,
    );
    expect(canceled.status).toBe('canceled');
    expect(canceled.progress.canceled).toBe(4);
    const again = await agent.post(`/api/runs/${run.id}/cancel`).expect(200);
    expect(runSchema.parse(again.body).status).toBe('canceled');

    const worker = testWorker();
    worker.start();
    const final = await waitForRun(agent, run.id).finally(() => worker.drain(5_000));
    expect(final.status).toBe('canceled');
    expect(final.credits).toEqual({ reserved: 4, charged: 0, refunded: 4 });
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 50 });
    await expectLedgerBalanced(ws);
  });

  it('refunds failed checks to the buckets they came from (purchased first)', async () => {
    const engine = fakeCheckEngine();
    engine.adapters.perplexity = {
      ...createFakeAdapter('perplexity'),
      ask: () => Promise.reject(new ProviderError('perplexity', 'refused', 'nope')),
    };
    const { agent, ws } = await account();
    await withTransaction((session) =>
      adminAdjust(session, {
        workspaceId: new Types.ObjectId(ws),
        bucket: 'plan',
        delta: 2,
        note: 'test',
      }),
    );
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds }); // 2 from plan, 2 from purchased
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 48 });

    const worker = testWorker({ engine });
    worker.start();
    const final = await waitForRun(agent, run.id).finally(() => worker.drain(5_000));
    expect(final.status).toBe('partial');
    expect(final.progress).toMatchObject({ ok: 2, failed: 2 });
    expect(final.credits).toEqual({ reserved: 4, charged: 2, refunded: 2 });
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 50 });
    const refunds = await LedgerModel.find({ workspaceId: ws, reason: 'run_refund' }).lean();
    expect(refunds.map((r) => [r.bucket, r.delta])).toEqual([['purchased', 2]]);

    const failed = checkResultPageSchema.parse(
      (await agent.get(`/api/runs/${run.id}/results?status=failed`).expect(200)).body,
    );
    expect(failed.items[0]?.error).toEqual({
      code: 'refused',
      message: expect.stringMatching(/declined/) as string,
    });
    expect(JSON.stringify(failed)).not.toContain('nope');
    await expectLedgerBalanced(ws);
  });

  it('a run where every check fails is `failed` and fully refunded', async () => {
    const engine = fakeCheckEngine();
    engine.extractor = undefined;
    const { agent, ws } = await account();
    const { brandId, promptIds } = await brandWithPrompts(agent, 1);
    const run = await createRun(agent, { brandId, promptIds });
    const worker = testWorker({ engine });
    worker.start();
    const final = await waitForRun(agent, run.id).finally(() => worker.drain(5_000));
    expect(final.status).toBe('failed');
    expect(final.credits.refunded).toBe(2);
    expect(await credits(ws)).toEqual({ plan: 0, purchased: 50 });
    await expectLedgerBalanced(ws);
  });
});
