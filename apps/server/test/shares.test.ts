import {
  createdShareSchema,
  errorEnvelopeSchema,
  publicReportSchema,
  shareListResponseSchema,
} from '@pv/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ShareModel } from '../src/modules/shares/model';
import { APP_URL, connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';
import { brandWithPrompts, completeRun, createRun } from './runHelpers';

const { app } = makeTestApp({ limits: { publicSharePerIp: { limit: 1_000, windowMs: 60_000 } } });

beforeAll(() => connectTestDb('shares_test'));
afterAll(() => dropTestDb());

describe('shares (F-14, F-15)', () => {
  let agent: Client;
  let runId: string;

  beforeAll(async () => {
    ({ agent } = await signUp(app));
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    runId = (await createRun(agent, { brandId, promptIds })).id;
    await completeRun(agent, runId);
  });

  it('creates a share: the token is shown once and only its hash is stored', async () => {
    const share = createdShareSchema.parse(
      (await agent.post(`/api/runs/${runId}/shares`).send({ expiresInDays: 7 }).expect(201)).body,
    );
    expect(share.url).toBe(`${APP_URL}/share/${share.token}`);
    expect(share.expiresAt).not.toBeNull();
    const stored = await ShareModel.findById(share.id).setOptions({ crossWorkspace: true }).lean();
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(share.token);

    const list = shareListResponseSchema.parse(
      (await agent.get(`/api/runs/${runId}/shares`).expect(200)).body,
    );
    expect(list.map((s) => s.id)).toContain(share.id);
    expect(JSON.stringify(list)).not.toContain(share.token);
  });

  it('serves a trimmed public report with no ids, costs or models', async () => {
    const { token } = createdShareSchema.parse(
      (await agent.post(`/api/runs/${runId}/shares`).send({}).expect(201)).body,
    );
    const res = await request(app).get(`/api/public/shares/${token}`).expect(200);
    expect(res.headers['x-robots-tag']).toBe('noindex');
    expect(res.headers['cache-control']).toBe('private, max-age=60');
    const report = publicReportSchema.parse(res.body);
    expect(report.brand.name).toBe('Acme Analytics');
    expect(report.checks).toHaveLength(4);
    expect(report.aggregates?.competitors.map((c) => c.name)).toEqual(['Globex', 'Initech']);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/[a-f0-9]{24}/); // no ObjectIds anywhere
    for (const field of ['costMicros', 'model', 'workspaceId', 'email', 'competitorId', 'raw']) {
      expect(body).not.toContain(`"${field}"`);
    }

    const share = await ShareModel.findOne({})
      .setOptions({ crossWorkspace: true })
      .sort({ createdAt: -1 })
      .lean();
    expect(share?.viewCount).toBe(1);
  });

  it('revoked, expired and unknown links all 404', async () => {
    const created = createdShareSchema.parse(
      (await agent.post(`/api/runs/${runId}/shares`).send({}).expect(201)).body,
    );
    await agent.delete(`/api/shares/${created.id}`).expect(204);
    const revoked = await request(app).get(`/api/public/shares/${created.token}`).expect(404);
    expect(errorEnvelopeSchema.parse(revoked.body).error.code).toBe('NOT_FOUND');

    const expiring = createdShareSchema.parse(
      (await agent.post(`/api/runs/${runId}/shares`).send({ expiresInDays: 1 }).expect(201)).body,
    );
    await ShareModel.updateOne(
      { _id: expiring.id },
      { $set: { expiresAt: new Date(Date.now() - 1) } },
    ).setOptions({ crossWorkspace: true });
    await request(app).get(`/api/public/shares/${expiring.token}`).expect(404);

    await request(app)
      .get(`/api/public/shares/${'x'.repeat(43)}`)
      .expect(404);
    await request(app).get('/api/public/shares/short').expect(400);
  });

  it('only finished runs can be shared', async () => {
    const other = await signUp(app);
    const made = await brandWithPrompts(other.agent, 1);
    const run = await createRun(other.agent, { brandId: made.brandId, promptIds: made.promptIds });
    const res = await other.agent.post(`/api/runs/${run.id}/shares`).send({}).expect(409);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('RUN_NOT_FINAL');
  });

  it('is rate-limited per IP', async () => {
    const { app: limited } = makeTestApp({
      limits: { publicSharePerIp: { limit: 2, windowMs: 60_000 } },
    });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await request(limited).get(`/api/public/shares/${'y'.repeat(43)}`)).status);
    }
    expect(statuses).toEqual([404, 404, 429]);
  });
});
