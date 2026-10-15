import { ProviderError, createFakeAdapter } from '@pv/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AdminError,
  adjustCredits,
  inspectRun,
  recomputeAggregates,
  rerunFailed,
} from '../src/admin';
import { LedgerModel } from '../src/modules/credits/model';
import { RunModel } from '../src/modules/runs/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { connectTestDb, dropTestDb, fakeCheckEngine, makeTestApp, signUp } from './helpers';
import {
  brandWithPrompts,
  createRun,
  expectLedgerBalanced,
  testWorker,
  waitForRun,
} from './runHelpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('admin_test'));
afterAll(() => dropTestDb());

describe('admin scripts (4.10)', () => {
  it('adjust-credits: a ledger row plus the balance change; never below zero', async () => {
    const { me } = await signUp(app);
    const ws = me.workspace.id;
    const res = await adjustCredits({
      workspaceId: ws,
      bucket: 'purchased',
      delta: 15,
      note: 'Goodwill after outage',
    });
    expect(res).toEqual({ before: { plan: 0, purchased: 50 }, after: { plan: 0, purchased: 65 } });
    const row = await LedgerModel.findOne({ workspaceId: ws, reason: 'admin_adjust' }).lean();
    expect(row).toMatchObject({
      delta: 15,
      bucket: 'purchased',
      refType: 'admin',
      note: 'Goodwill after outage',
    });

    await expect(
      adjustCredits({ workspaceId: ws, bucket: 'plan', delta: -1, note: 'x' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
    await expect(
      adjustCredits({ workspaceId: ws, bucket: 'plan', delta: 1, note: ' ' }),
    ).rejects.toBeInstanceOf(AdminError);
    await expect(
      adjustCredits({ workspaceId: 'nope', bucket: 'plan', delta: 1, note: 'x' }),
    ).rejects.toBeInstanceOf(AdminError);
    await expectLedgerBalanced(ws);
  });

  it('rerun-failed: charges the failed checks again, finalize settles the new generation', async () => {
    const { agent, me } = await signUp(app);
    const ws = me.workspace.id;
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds });

    // An outage on Perplexity: half the run fails and is refunded.
    const outage = fakeCheckEngine();
    outage.adapters.perplexity = {
      ...createFakeAdapter('perplexity'),
      ask: () => Promise.reject(new ProviderError('perplexity', 'bad_request', 'outage')),
    };
    let w = testWorker({ engine: outage });
    w.start();
    const first = await waitForRun(agent, run.id).finally(() => w.drain(5_000));
    expect(first.status).toBe('partial');
    expect(first.credits).toEqual({ reserved: 4, charged: 2, refunded: 2 });

    await expect(rerunFailed(run.id)).resolves.toEqual({ checks: 2, generation: 2 });
    expect((await WorkspaceModel.findById(ws).lean())?.credits.purchased).toBe(46);
    await expect(rerunFailed(run.id)).rejects.toThrow(/wait for it to finish/);

    w = testWorker();
    w.start();
    const second = await waitForRun(agent, run.id).finally(() => w.drain(5_000));
    expect(second.status).toBe('completed');
    expect(second.credits).toEqual({ reserved: 6, charged: 4, refunded: 2 });
    expect((await WorkspaceModel.findById(ws).lean())?.credits.purchased).toBe(46);
    await expect(rerunFailed(run.id)).rejects.toThrow(/no failed checks/);

    const report = await inspectRun(run.id);
    expect(report.run).toMatchObject({ status: 'completed', generation: 2, finalizedGen: 2 });
    expect(report.ledger.map((l) => [l.reason, l.delta, l.refId])).toEqual([
      ['run_reserve', -4, run.id],
      ['run_refund', 2, run.id],
      ['run_reserve', -2, `${run.id}:2`],
    ]);
    expect(report.workspaceLedgerBalanced).toBe(true);
    await expectLedgerBalanced(ws);
  });

  it('recompute-aggregates rebuilds what finalize wrote; inspect-run explains a run', async () => {
    const { agent, me } = await signUp(app);
    const { brandId, promptIds } = await brandWithPrompts(agent, 2);
    const run = await createRun(agent, { brandId, promptIds });
    await expect(recomputeAggregates(run.id)).rejects.toThrow(/aggregates come at finalize/);
    const w = testWorker();
    w.start();
    const final = await waitForRun(agent, run.id).finally(() => w.drain(5_000));

    await RunModel.updateOne(
      { workspaceId: me.workspace.id, _id: run.id },
      { $set: { 'aggregates.total.visibility': { num: 0, den: 999, rate: 0 } } },
    );
    const res = await recomputeAggregates(run.id);
    expect(res.visibility.before).toEqual({ num: 0, den: 999, rate: 0 });
    expect(res.visibility.after).toEqual(final.aggregates?.total.visibility);

    const report = await inspectRun(run.id);
    expect(report.run).toMatchObject({ id: run.id, settled: true, prompts: 2 });
    expect(report.checks.reduce((n, c) => n + c.n, 0)).toBe(4);
    expect(report.jobs['check:done']).toBe(4);
    await expect(inspectRun('0123456789abcdef01234567')).rejects.toThrow(/not found/);
  });
});
