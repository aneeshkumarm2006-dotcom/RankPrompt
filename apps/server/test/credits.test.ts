import { ledgerPageSchema, referralsResponseSchema } from '@pv/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_URL,
  client,
  connectTestDb,
  dropTestDb,
  makeTestApp,
  signUp,
  PASSWORD,
} from './helpers';
import { brandWithPrompts, completeRun, createRun } from './runHelpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('credits_test'));
afterAll(() => dropTestDb());

describe('GET /credits/ledger (F-28)', () => {
  it('lists the signup bonus and run rows newest first, with the run id and a cursor', async () => {
    const { agent } = await signUp(app);
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds });
    await completeRun(agent, run.id);

    const all = ledgerPageSchema.parse((await agent.get('/api/credits/ledger').expect(200)).body);
    expect(all.items.at(-1)).toMatchObject({ reason: 'signup_bonus', delta: 50, runId: null });
    const reserve = all.items.find((e) => e.reason === 'run_reserve');
    expect(reserve).toMatchObject({ runId: run.id });
    expect(reserve?.delta).toBeLessThan(0);
    expect(all.nextCursor).toBeNull();

    const first = ledgerPageSchema.parse(
      (await agent.get('/api/credits/ledger?limit=1').expect(200)).body,
    );
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.id).toBe(all.items[0]?.id);
    const next = ledgerPageSchema.parse(
      (await agent.get(`/api/credits/ledger?limit=1&cursor=${first.nextCursor}`).expect(200)).body,
    );
    expect(next.items[0]?.id).toBe(all.items[1]?.id);
  });

  it('never shows another workspace’s rows', async () => {
    const { agent } = await signUp(app);
    const page = ledgerPageSchema.parse((await agent.get('/api/credits/ledger').expect(200)).body);
    expect(page.items).toHaveLength(1);
  });
});

describe('GET /referrals (F-04, F-31)', () => {
  it('gives the code, the register link and counts only', async () => {
    const { agent, me } = await signUp(app);
    await signUp(app, { ref: me.workspace.referralCode });

    const body = referralsResponseSchema.parse(
      (await agent.get('/api/referrals').expect(200)).body,
    );
    expect(body).toEqual({
      code: me.workspace.referralCode,
      link: `${APP_URL}/register?ref=${me.workspace.referralCode}`,
      referredCount: 1,
      creditedCount: 0,
      creditsEarned: 0,
    });
  });
});

describe('POST /auth/logout-all', () => {
  it('signs out every session, this one included', async () => {
    const { agent, email } = await signUp(app);
    const other = client(app);
    await other.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);

    await agent.post('/api/auth/logout-all').expect(204);
    await agent.get('/api/me').expect(401);
    await other.get('/api/me').expect(401);
  });
});
