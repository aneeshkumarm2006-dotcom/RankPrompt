import type { Platform } from '@pv/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ErrorReporter } from '../src/config/sentry';
import { op } from '../src/db/trusted';
import { JobModel } from '../src/jobs/model';
import { LedgerModel } from '../src/modules/credits/model';
import { providerSpendRepo } from '../src/modules/providerSpend/repo';
import { ProviderSpendModel } from '../src/modules/providerSpend/model';
import { ResultModel } from '../src/modules/results/model';
import { connectTestDb, dropTestDb, makeTestApp, signUp } from './helpers';
import {
  brandWithPrompts,
  createRun,
  expectLedgerBalanced,
  testGates,
  testWorker,
  waitForRun,
} from './runHelpers';

/**
 * TODO 8.2: a daily spend cap holds a provider's checks; it never fails or refunds them. Once the
 * cap clears (the next UTC day, or a higher cap), the same checks run and the run completes.
 */

const { app } = makeTestApp();
const SYSTEM = { crossWorkspace: true };
const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => connectTestDb('spend_caps_test'));
afterAll(() => dropTestDb());

function spyReporter(): ErrorReporter & { messages: string[] } {
  const messages: string[] = [];
  return {
    enabled: true,
    messages,
    capture: (err) => messages.push(err instanceof Error ? err.message : String(err)),
    flush: () => Promise.resolve(),
  };
}

async function heldState(runId: string, platforms: Platform[]) {
  const results = await ResultModel.find({ runId, platform: op({ $in: platforms }) })
    .setOptions(SYSTEM)
    .lean();
  const jobs = await JobModel.find({ runId, type: 'check' }).lean();
  const jobOf = new Map(jobs.map((j) => [j.payload.resultId as string, j]));
  return results.map((r) => ({
    status: r.status,
    job: jobOf.get(r._id.toHexString()),
  }));
}

describe('daily spend caps (8.2)', () => {
  it('holds an over-cap provider’s checks, then runs them when the day rolls over', async () => {
    await ProviderSpendModel.deleteMany({});
    const user = await signUp(app);
    const { brandId, promptIds } = await brandWithPrompts(user.agent, 3);
    // Today's Anthropic spend is already $2, over a $1 cap.
    await providerSpendRepo.add('anthropic', 2_000_000);
    let clock = Date.now();
    const reporter = spyReporter();
    const gates = testGates({
      capsUsd: { anthropic: 1 },
      spendRefreshMs: 0,
      now: () => clock,
      reporter,
    });
    const run = await createRun(user.agent, {
      brandId,
      promptIds,
      platforms: ['chatgpt', 'claude'],
    });
    const worker = testWorker({ gates });
    worker.start();
    try {
      // ChatGPT's checks finish; Claude's wait.
      await vi.waitFor(
        async () => {
          const done = await ResultModel.countDocuments({
            runId: run.id,
            platform: 'chatgpt',
            status: 'ok',
          }).setOptions(SYSTEM);
          if (done < 3) throw new Error(`${done}`);
        },
        { timeout: 10_000, interval: 20 },
      );
      await new Promise((r) => setTimeout(r, 400));
      const held = await heldState(run.id, ['claude']);
      expect(held).toHaveLength(3);
      for (const h of held) {
        expect(h.status).toBe('pending');
        expect(h.job?.status).toBe('queued');
        expect(h.job?.attempts).toBe(0); // never claimed: no attempt used, no lease taken
      }
      const live = await user.agent.get(`/api/runs/${run.id}`).expect(200);
      expect((live.body as { status: string }).status).toBe('running');
      expect(
        await LedgerModel.countDocuments({ refId: run.id, reason: 'run_refund' }).setOptions(
          SYSTEM,
        ),
      ).toBe(0);
      // One alert per provider per day, however often the gates are asked.
      expect(reporter.messages.filter((m) => m.includes('spend cap'))).toEqual([
        'provider spend cap reached: anthropic',
      ]);

      // Next UTC day: the cap clears and the same checks run.
      clock += DAY;
      const final = await waitForRun(user.agent, run.id);
      expect(final.status).toBe('completed');
      expect(final.credits.charged).toBe(6);
      expect(final.credits.refunded).toBe(0);
      await expectLedgerBalanced(user.me.workspace.id);
    } finally {
      await worker.drain(5_000);
    }
  });

  it('over the extractor’s (OpenAI) cap, every platform waits; a raised cap releases them', async () => {
    await ProviderSpendModel.deleteMany({});
    const user = await signUp(app);
    const { brandId, promptIds } = await brandWithPrompts(user.agent, 2);
    await providerSpendRepo.add('openai', 5_000_000);
    const platforms: Platform[] = ['perplexity', 'gemini', 'google_aio'];
    const run = await createRun(user.agent, { brandId, promptIds, platforms });
    const capped = testGates({ capsUsd: { openai: 1 }, spendRefreshMs: 0 });
    const worker = testWorker({ gates: capped });
    worker.start();
    await new Promise((r) => setTimeout(r, 600));
    await worker.drain(5_000);
    const held = await heldState(run.id, platforms);
    expect(held).toHaveLength(6);
    for (const h of held) {
      expect(h.status).toBe('pending');
      expect(h.job?.attempts).toBe(0);
    }

    // The operator raises the cap (PROVIDER_DAILY_CAP_USD) and restarts: nothing was lost.
    const raised = testWorker({ gates: testGates({ capsUsd: { openai: 100 } }) });
    raised.start();
    try {
      const final = await waitForRun(user.agent, run.id);
      expect(final.status).toBe('completed');
      expect(final.credits.refunded).toBe(0);
      await expectLedgerBalanced(user.me.workspace.id);
    } finally {
      await raised.drain(5_000);
    }
  });
});
