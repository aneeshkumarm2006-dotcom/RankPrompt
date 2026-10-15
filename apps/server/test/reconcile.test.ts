import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ErrorReporter } from '../src/config/sentry';
import {
  createReconcileHandler,
  reconcileJobFor,
  scheduleReconcile,
} from '../src/jobs/handlers/reconcileLedger';
import { JobModel } from '../src/jobs/model';
import { sweep } from '../src/jobs/sweeper';
import { reconcileLedger } from '../src/modules/credits/reconcile';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { connectTestDb, dropTestDb, makeTestApp, signUp, silentLogger } from './helpers';

/** TODO 6.5: the nightly ledger reconciliation and its alert. */

const { app } = makeTestApp();

beforeAll(() => connectTestDb('reconcile_test'));
afterAll(() => dropTestDb());

function recordingReporter() {
  const captured: { error: unknown; context?: Record<string, unknown> }[] = [];
  const reporter: ErrorReporter = {
    enabled: true,
    capture: (error, context) => captured.push({ error, ...(context ? { context } : {}) }),
    flush: () => Promise.resolve(),
  };
  return { reporter, captured };
}

describe('ledger reconciliation (6.5)', () => {
  it('finds nothing when every balance matches its ledger, across several batches', async () => {
    for (let i = 0; i < 5; i++) await signUp(app);
    const { reporter, captured } = recordingReporter();
    const report = await reconcileLedger({ logger: silentLogger, reporter, batchSize: 2 });
    expect(report.checked).toBeGreaterThanOrEqual(5);
    expect(report.mismatches).toEqual([]);
    expect(captured).toEqual([]);
  });

  it('reports a balance changed without a ledger row, and never fixes it', async () => {
    const { me } = await signUp(app);
    const id = new Types.ObjectId(me.workspace.id);
    // A write that bypassed the ledger service.
    await WorkspaceModel.updateOne({ _id: id }, { $inc: { 'credits.purchased': 7 } });

    const { reporter, captured } = recordingReporter();
    const report = await reconcileLedger({ logger: silentLogger, reporter, batchSize: 2 });
    expect(report.mismatches).toEqual([
      {
        workspaceId: me.workspace.id,
        ledger: { plan: 0, purchased: 50 },
        balance: { plan: 0, purchased: 57 },
      },
    ]);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.context).toMatchObject({ workspaceId: me.workspace.id });
    const ws = await WorkspaceModel.findById(id).lean();
    expect(ws?.credits.purchased).toBe(57);
    await WorkspaceModel.updateOne({ _id: id }, { $inc: { 'credits.purchased': -7 } });
  });

  it('is enqueued once a day by the sweeper, due at 03:00 UTC', async () => {
    const now = new Date('2026-10-15T01:23:00Z');
    expect(reconcileJobFor(now)).toEqual({
      dedupeKey: 'reconcile_ledger:2026-10-15',
      runAt: new Date('2026-10-15T03:00:00Z'),
    });
    expect(await scheduleReconcile(now)).toBe(true);
    expect(await scheduleReconcile(now)).toBe(false);

    const { reporter } = recordingReporter();
    await sweep({ handlers: new Map(), logger: silentLogger, reporter, now: () => now });
    await sweep({ handlers: new Map(), logger: silentLogger, reporter, now: () => now });
    expect(await JobModel.countDocuments({ dedupeKey: 'reconcile_ledger:2026-10-15' })).toBe(1);

    // A finished day's job is never revived, unlike finalize's dedupe key.
    await JobModel.updateOne(
      { dedupeKey: 'reconcile_ledger:2026-10-15' },
      { $set: { status: 'done' } },
    );
    expect(await scheduleReconcile(now)).toBe(false);
    expect(
      await JobModel.findOne({ dedupeKey: 'reconcile_ledger:2026-10-15' }).lean(),
    ).toMatchObject({ status: 'done' });
  });

  it('the job handler runs the check', async () => {
    const { reporter } = recordingReporter();
    const handler = createReconcileHandler({ logger: silentLogger, reporter });
    const job = await JobModel.findOne({ type: 'reconcile_ledger' }).lean();
    if (!job) throw new Error('no job');
    const outcome = await handler.run({
      job,
      leaseId: new Types.ObjectId(),
      signal: new AbortController().signal,
    });
    expect(outcome).toEqual({ kind: 'done' });
  });
});
