import { ProviderError, createFakeAdapter, type AnswerRaw, type PlatformAdapter } from '@pv/engine';
import type { Platform, Run } from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { noopReporter } from '../src/config/sentry';
import { op } from '../src/db/trusted';
import { createCheckHandler } from '../src/jobs/handlers/check';
import { JobModel } from '../src/jobs/model';
import { Worker } from '../src/jobs/worker';
import { LedgerModel } from '../src/modules/credits/model';
import { ResultModel } from '../src/modules/results/model';
import { finalizeRun } from '../src/modules/runs/finalize';
import { RunModel } from '../src/modules/runs/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import {
  connectTestDb,
  dropTestDb,
  fakeCheckEngine,
  makeTestApp,
  signUp,
  silentLogger,
} from './helpers';
import {
  brandWithPrompts,
  createRun,
  expectLedgerBalanced,
  testGates,
  testWorker,
  waitForRun,
} from './runHelpers';

/**
 * Chaos tests (TODO 4.11, CHECKLIST P4 exit). In every case the stored results must be right,
 * nothing may be counted or refunded twice, and ledger = balance.
 */

const { app } = makeTestApp();

beforeAll(() => connectTestDb('chaos_test'));
afterAll(() => dropTestDb());

async function account(prompts: number) {
  const user = await signUp(app);
  const made = await brandWithPrompts(user.agent, prompts);
  return { agent: user.agent, ws: user.me.workspace.id, ...made };
}

/** Wraps an adapter to count calls per prompt. */
function counting(adapter: PlatformAdapter) {
  const calls = new Map<string, number>();
  const wrapped: PlatformAdapter = {
    ...adapter,
    ask: (input, signal) => {
      calls.set(input.prompt, (calls.get(input.prompt) ?? 0) + 1);
      return adapter.ask(input, signal);
    },
  };
  return { adapter: wrapped, calls, total: () => [...calls.values()].reduce((a, b) => a + b, 0) };
}

const slowEngine = (latencyMs: number, platforms: Platform[] = ['chatgpt', 'perplexity']) => {
  const engine = fakeCheckEngine();
  for (const p of platforms) engine.adapters[p] = createFakeAdapter(p, { latencyMs });
  return engine;
};

async function expectRunIntegrity(ws: string, run: Run): Promise<void> {
  const results = await ResultModel.find({ workspaceId: ws, runId: run.id }).lean();
  expect(results).toHaveLength(run.progress.total);
  expect(results.filter((r) => r.status === 'pending' || r.status === 'running')).toEqual([]);
  const charged = results.filter((r) => r.status === 'ok' || r.status === 'no_answer').length;
  expect(run.credits.charged).toBe(charged);
  expect(run.credits.refunded).toBe(run.credits.reserved - charged);
  // One reserve, at most one refund per bucket for this run.
  const rows = await LedgerModel.find({ workspaceId: ws, refType: 'run', refId: run.id }).lean();
  const keys = rows.map((r) => `${r.reason}:${r.bucket}`);
  expect(new Set(keys).size).toBe(keys.length);
  await expectLedgerBalanced(ws);
}

describe('chaos (4.11)', () => {
  it('a worker killed mid-run: its leases expire, another instance finishes the run', async () => {
    const { agent, ws, brandId, promptIds } = await account(6);
    const run = await createRun(agent, { brandId, promptIds });

    // Worker A answers three checks, then hangs inside the provider call (like a process that is
    // about to die), so exactly the checks it holds at the kill are in flight.
    let answered = 0;
    let hanging = 0;
    const hang = slowEngine(0);
    for (const p of ['chatgpt', 'perplexity'] as const) {
      const base = hang.adapters[p] as PlatformAdapter;
      hang.adapters[p] = {
        ...base,
        ask: (input, signal) =>
          answered++ < 3
            ? base.ask(input, signal)
            : new Promise((_, reject) => {
                hanging++;
                signal.addEventListener('abort', () => reject(new Error('aborted')), {
                  once: true,
                });
              }),
      };
    }
    const a = testWorker({ engine: hang, leaseMs: 300, renewMs: 100, concurrency: 4 });
    a.start();
    await vi.waitFor(
      async () => {
        const done = await ResultModel.countDocuments({
          workspaceId: ws,
          runId: run.id,
          status: op({ $in: ['ok', 'no_answer'] }),
        });
        const held = await JobModel.countDocuments({ runId: run.id, status: 'running' });
        if (done < 3 || hanging < 4 || held < 4) throw new Error(`${done} done, ${hanging} hung`);
      },
      { timeout: 10_000, interval: 10 },
    );
    await a.kill();
    const orphaned = await JobModel.countDocuments({ runId: run.id, status: 'running' });

    const b = testWorker({ engine: slowEngine(5) });
    b.start();
    const sweeper = setInterval(() => void b.sweepNow(), 100);
    try {
      const final = await waitForRun(agent, run.id);
      expect(final.status).toBe('completed');
      expect(final.progress.ok + final.progress.noAnswer).toBe(12);
      await expectRunIntegrity(ws, final);
    } finally {
      clearInterval(sweeper);
      await b.drain(5_000);
    }
    expect(orphaned).toBe(4); // the kill really left leased jobs behind
  });

  it('a forced lease expiry: two workers run the same check, it is stored once', async () => {
    const { agent, ws, brandId, promptIds } = await account(1);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let entered!: () => void;
    const firstCallStarted = new Promise<void>((r) => (entered = r));
    let calls = 0;
    const base = createFakeAdapter('chatgpt');
    const adapter: PlatformAdapter = {
      ...base,
      async ask(input, signal): Promise<AnswerRaw> {
        calls++;
        const ans = await base.ask(input, signal);
        if (calls === 1) {
          entered();
          await gate; // worker A stalls here past its lease
          return { ...ans, answer: `FIRST ${ans.answer}`, model: 'first' };
        }
        return { ...ans, model: 'second' };
      },
    };
    const engine = fakeCheckEngine();
    engine.adapters.chatgpt = adapter;
    const run = await createRun(agent, {
      brandId,
      promptIds: promptIds.slice(0, 1),
      platforms: ['chatgpt'],
    });

    // A never renews in time (renewMs ≫ leaseMs), like a stalled process; with one slot, it
    // can't claim anything else while it is stuck.
    const a = testWorker({ engine, leaseMs: 150, renewMs: 60_000, concurrency: 1 });
    const b = testWorker({ engine });
    let final: Run;
    try {
      a.start();
      await firstCallStarted;
      await new Promise((r) => setTimeout(r, 250));
      expect((await a.sweepNow())?.requeued).toBeGreaterThanOrEqual(1);
      const job = await JobModel.findOne({ runId: run.id, type: 'check' }).lean();
      expect(job?.status).toBe('queued');

      b.start();
      final = await waitForRun(agent, run.id);
    } finally {
      release(); // A wakes up with its stale answer
      await a.drain(5_000);
      await b.drain(5_000);
    }

    expect(calls).toBe(2); // the provider was paid twice …
    const results = await ResultModel.find({ workspaceId: ws, runId: run.id }).lean();
    expect(results).toHaveLength(1); // … but the check is stored once, by the lease that owned it
    expect(results[0]?.model).toBe('second');
    expect(final.status).toBe('completed');
    const after = await RunModel.findOne({ workspaceId: ws, _id: run.id }).lean();
    expect(after?.models.chatgpt).toBe('second');
    await expectRunIntegrity(ws, final);
  });

  it('a 429 storm: Retry-After retries don’t use attempts; without it they fail and refund', async () => {
    const { agent, ws, brandId, promptIds } = await account(4);
    let storm = 10;
    const chatgpt = counting({
      ...createFakeAdapter('chatgpt'),
      ask: (input, signal) =>
        storm-- > 0
          ? Promise.reject(
              new ProviderError('openai', 'rate_limited', '429', { status: 429, retryAfterMs: 20 }),
            )
          : createFakeAdapter('chatgpt').ask(input, signal),
    });
    const perplexity = counting({
      ...createFakeAdapter('perplexity'),
      ask: () =>
        Promise.reject(new ProviderError('perplexity', 'rate_limited', '429', { status: 429 })),
    });
    const engine = fakeCheckEngine();
    engine.adapters.chatgpt = chatgpt.adapter;
    engine.adapters.perplexity = perplexity.adapter;
    const gates = testGates();
    const run = await createRun(agent, { brandId, promptIds });

    const w = testWorker({ engine, gates });
    w.start();
    const final = await waitForRun(agent, run.id).finally(() => w.drain(5_000));

    expect(final.status).toBe('partial');
    expect(final.progress).toMatchObject({ failed: 4 });
    expect(final.progress.ok + final.progress.noAnswer).toBe(4);
    expect(chatgpt.total()).toBe(14); // 10 throttled + 4 answered, none gave up
    expect(perplexity.total()).toBe(4 * 5); // five attempts each, then failed
    const failed = await ResultModel.find({
      workspaceId: ws,
      runId: run.id,
      status: 'failed',
    }).lean();
    expect(
      failed.every((r) => r.platform === 'perplexity' && r.error?.code === 'rate_limited'),
    ).toBe(true);
    // AIMD: the limiter slowed down (once for the whole burst, then recovered a little).
    expect(gates.limiter('openai').currentRpm).toBeLessThan(60_000);
    await expectRunIntegrity(ws, final);
  });

  it('a deploy overlap: two instances share a run; one drains mid-run; each check runs once', async () => {
    const { agent, ws, brandId, promptIds } = await account(10);
    const engineA = slowEngine(15, ['chatgpt', 'perplexity', 'gemini']);
    const engineB = slowEngine(15, ['chatgpt', 'perplexity', 'gemini']);
    const counters = (['chatgpt', 'perplexity', 'gemini'] as const).map((p) => {
      const a = counting(engineA.adapters[p] as PlatformAdapter);
      const b = counting(engineB.adapters[p] as PlatformAdapter);
      engineA.adapters[p] = a.adapter;
      engineB.adapters[p] = b.adapter;
      return { a, b };
    });
    const run = await createRun(agent, {
      brandId,
      promptIds,
      platforms: ['chatgpt', 'perplexity', 'gemini'],
    });

    const a = testWorker({ engine: engineA, instanceId: 'old-instance', concurrency: 3 });
    const b = testWorker({ engine: engineB, instanceId: 'new-instance', concurrency: 3 });
    a.start();
    b.start();
    await vi.waitFor(
      async () => {
        const done = await ResultModel.countDocuments({
          workspaceId: ws,
          runId: run.id,
          status: op({ $in: ['ok', 'no_answer'] }),
        });
        if (done < 8) throw new Error(`${done}`);
      },
      { timeout: 10_000, interval: 10 },
    );
    await a.drain(0); // the old instance gets SIGTERM with no grace left
    const final = await waitForRun(agent, run.id).finally(() => b.drain(5_000));

    expect(final.status).toBe('completed');
    expect(counters.every((c) => c.b.total() > 0)).toBe(true);
    const jobs = await JobModel.find({ runId: run.id, type: 'check' }).lean();
    expect(jobs).toHaveLength(30);
    // A released job gives its attempt back, so every check job ends on exactly one attempt.
    expect(jobs.every((j) => j.status === 'done' && j.attempts === 1)).toBe(true);
    await expectRunIntegrity(ws, final);
  });

  it('cancel mid-run: running checks finish, the rest are canceled and refunded', async () => {
    const { agent, ws, brandId, promptIds } = await account(8);
    const run = await createRun(agent, { brandId, promptIds });
    const w = testWorker({ engine: slowEngine(30), concurrency: 2 });
    w.start();
    await vi.waitFor(
      async () => {
        const done = await ResultModel.countDocuments({
          workspaceId: ws,
          runId: run.id,
          status: op({ $in: ['ok', 'no_answer'] }),
        });
        if (done < 3) throw new Error(`${done}`);
      },
      { timeout: 10_000, interval: 5 },
    );
    await agent.post(`/api/runs/${run.id}/cancel`).expect(200);
    const final = await waitForRun(agent, run.id).finally(() => w.drain(5_000));

    expect(final.status).toBe('canceled');
    expect(final.progress.ok + final.progress.noAnswer).toBeGreaterThanOrEqual(3);
    expect(final.progress.canceled).toBeGreaterThan(0);
    expect(final.progress.ok + final.progress.noAnswer + final.progress.canceled).toBe(16);
    const ws2 = await WorkspaceModel.findById(ws).lean();
    expect(ws2?.credits.purchased).toBe(50 - final.credits.charged);
    await expectRunIntegrity(ws, final);
  });

  it('finalize run twice, and three times at once: one refund, one result', async () => {
    const { agent, ws, brandId, promptIds } = await account(2);
    const engine = fakeCheckEngine();
    engine.adapters.perplexity = {
      ...createFakeAdapter('perplexity'),
      ask: () => Promise.reject(new ProviderError('perplexity', 'refused', 'no')),
    };
    const run = await createRun(agent, { brandId, promptIds });
    // A worker that runs checks but never finalizes, so the test drives finalize itself.
    const gates = testGates();
    const checksOnly = new Worker({
      instanceId: 'checks-only',
      handlers: [createCheckHandler({ engine, gates, logger: silentLogger })],
      gates,
      logger: silentLogger,
      reporter: noopReporter,
      concurrency: 4,
      maxInflightPerWorkspace: 4,
      pollMs: 10,
      sweepMs: 0,
      delayScale: 0.001,
    });
    checksOnly.start();
    await vi.waitFor(
      async () => {
        const open = await ResultModel.countDocuments({
          workspaceId: ws,
          runId: run.id,
          status: op({ $in: ['pending', 'running'] }),
        });
        if (open) throw new Error(`${open} open`);
      },
      { timeout: 10_000, interval: 10 },
    );
    await checksOnly.drain(5_000);

    const scope = { workspaceId: new Types.ObjectId(ws) };
    const runId = new Types.ObjectId(run.id);
    const outcomes = await Promise.all([
      finalizeRun(scope, runId),
      finalizeRun(scope, runId),
      finalizeRun(scope, runId),
    ]);
    expect(outcomes.filter((o) => o === 'finalized')).toHaveLength(1);
    expect(await finalizeRun(scope, runId)).toBe('already');

    // Even with the run's state rolled back, the ledger's unique key refuses a second refund.
    await RunModel.updateOne({ workspaceId: ws, _id: run.id }, { $set: { finalizedGen: 0 } });
    expect(await finalizeRun(scope, runId)).toBe('already');
    await RunModel.updateOne({ workspaceId: ws, _id: run.id }, { $set: { finalizedGen: 1 } });

    const final = await waitForRun(agent, run.id);
    expect(final.status).toBe('partial');
    expect(final.credits).toEqual({ reserved: 4, charged: 2, refunded: 2 });
    const refunds = await LedgerModel.countDocuments({ workspaceId: ws, reason: 'run_refund' });
    expect(refunds).toBe(1);
    await expectRunIntegrity(ws, final);
  });
});

describe('worker housekeeping', () => {
  it('the sweeper re-enqueues finalize for a run left unfinalized', async () => {
    const { agent, brandId, promptIds } = await account(1);
    const run = await createRun(agent, { brandId, promptIds, platforms: ['chatgpt'] });
    const w = testWorker();
    w.start();
    await waitForRun(agent, run.id);
    await w.drain(5_000);
    // Lose the finalize job and roll the run back, as if an instance died mid-finalize.
    await JobModel.deleteMany({ runId: run.id, type: 'finalize_run' });
    await RunModel.updateOne(
      { _id: run.id },
      {
        $set: { status: 'finalizing', finalizedGen: 0, updatedAt: new Date(Date.now() - 300_000) },
      },
      { timestamps: false },
    ).setOptions({ crossWorkspace: true });
    expect((await w.sweepNow())?.finalizeEnqueued).toBe(1);
    const again = testWorker();
    again.start();
    const final = await waitForRun(agent, run.id).finally(() => again.drain(5_000));
    expect(final.status).toBe('completed');
  });

  it('the spend cap holds a provider’s jobs instead of failing them', async () => {
    const { agent, brandId, promptIds } = await account(1);
    const engine = fakeCheckEngine();
    engine.adapters.claude = {
      ...createFakeAdapter('claude'),
      ask: async (input, signal) => ({
        ...(await createFakeAdapter('claude').ask(input, signal)),
        costMicros: 2_000_000, // $2 a check
      }),
    };
    const gates = testGates({ capsUsd: { anthropic: 1 }, spendRefreshMs: 0 });
    const run = await createRun(agent, {
      brandId,
      promptIds: promptIds.slice(0, 1),
      platforms: ['claude', 'chatgpt'],
    });
    const w = testWorker({ engine, gates });
    w.start();
    try {
      await vi.waitFor(
        async () => {
          const done = await ResultModel.countDocuments({
            runId: run.id,
            status: op({ $in: ['ok', 'no_answer', 'failed'] }),
          }).setOptions({ crossWorkspace: true });
          if (done < 2) throw new Error(`${done}`);
        },
        { timeout: 10_000, interval: 10 },
      );
      // Today's anthropic spend ($2 from this run, maybe more) is now over the $1 cap.
      await gates.refreshSpend(true);
      expect(gates.saturated()).toContain('anthropic');
      const second = await createRun(agent, {
        brandId,
        promptIds: promptIds.slice(0, 1),
        platforms: ['claude'],
      });
      await new Promise((r) => setTimeout(r, 300));
      const held = await ResultModel.findOne({ runId: second.id })
        .setOptions({ crossWorkspace: true })
        .lean();
      expect(held?.status).toBe('pending'); // waiting, not failed
      expect(await JobModel.countDocuments({ runId: second.id, status: 'queued' })).toBe(1);
    } finally {
      await w.drain(5_000);
    }
  });
});
