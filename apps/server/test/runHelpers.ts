import { randomUUID } from 'node:crypto';
import {
  brandSchema,
  isFinalRunStatus,
  promptListResponseSchema,
  runSchema,
  type Platform,
  type Run,
} from '@pv/shared';
import { PROVIDER_KEYS, type ProviderKey } from '@pv/engine';
import { Types } from 'mongoose';
import { expect, vi } from 'vitest';
import { ProviderGates } from '../src/jobs/providerGates';
import { createJobWorker } from '../src/jobs/runtime';
import type { SweepOptions } from '../src/jobs/sweeper';
import type { Worker } from '../src/jobs/worker';
import type { CheckEngine } from '../src/jobs/handlers/check';
import { ledgerMatchesBalance } from '../src/modules/credits/service';
import { noopReporter } from '../src/config/sentry';
import type { Mailer } from '../src/emails/mailer';
import type { RunNotifier } from '../src/modules/schedules/notify';
import { FakeMailer, fakeCheckEngine, silentLogger, testEnv, type Client } from './helpers';

/** A brand with `n` prompts, created through the API. */
export async function brandWithPrompts(
  agent: Client,
  n: number,
  opts: { name?: string; website?: string; competitors?: { name: string; domain: string }[] } = {},
): Promise<{ brandId: string; promptIds: string[] }> {
  const brand = brandSchema.parse(
    (
      await agent
        .post('/api/brands')
        .send({
          name: opts.name ?? 'Acme Analytics',
          websiteUrl: opts.website ?? `acme-${randomUUID().slice(0, 6)}.com`,
          competitors: opts.competitors ?? [
            { name: 'Globex', domain: 'globex.com' },
            { name: 'Initech', domain: 'initech.com' },
          ],
        })
        .expect(201)
    ).body,
  );
  const prompts = promptListResponseSchema.parse(
    (
      await agent
        .post(`/api/brands/${brand.id}/prompts`)
        .send({
          prompts: Array.from({ length: n }, (_, i) => ({
            text: `Best analytics tools for team ${i + 1}?`,
            category: i % 2 ? 'Tools' : 'Pricing',
          })),
        })
        .expect(201)
    ).body,
  );
  return { brandId: brand.id, promptIds: prompts.map((p) => p.id) };
}

export async function createRun(
  agent: Client,
  body: { brandId: string; promptIds: string[]; platforms?: Platform[] },
  key: string = randomUUID(),
  expectStatus = 201,
): Promise<Run> {
  const res = await agent
    .post('/api/runs')
    .set('Idempotency-Key', key)
    .send({
      brandId: body.brandId,
      promptIds: body.promptIds,
      platforms: body.platforms ?? ['chatgpt', 'perplexity'],
      country: 'US',
      language: 'en',
      scope: 'national',
    })
    .expect(expectStatus);
  return runSchema.parse(res.body);
}

/** A worker on fake providers with test-sized leases and delays. */
export function testWorker(
  opts: {
    instanceId?: string;
    engine?: CheckEngine;
    leaseMs?: number;
    renewMs?: number;
    concurrency?: number;
    maxInflightPerWorkspace?: number;
    gates?: ProviderGates;
    sweep?: Partial<SweepOptions>;
    mailer?: Mailer;
    notifyRunDone?: RunNotifier;
  } = {},
): Worker {
  return createJobWorker({
    env: {
      ...testEnv(),
      INSTANCE_ID: opts.instanceId ?? `test-${randomUUID().slice(0, 6)}`,
      WORKER_CONCURRENCY: opts.concurrency ?? 8,
      MAX_INFLIGHT_PER_WORKSPACE: opts.maxInflightPerWorkspace ?? 8,
    },
    logger: silentLogger,
    reporter: noopReporter,
    engine: opts.engine ?? fakeCheckEngine(),
    mailer: opts.mailer ?? new FakeMailer(),
    ...(opts.notifyRunDone ? { notifyRunDone: opts.notifyRunDone } : {}),
    overrides: {
      pollMs: 20,
      leaseMs: opts.leaseMs ?? 5_000,
      renewMs: opts.renewMs ?? 1_000,
      sweepMs: 0,
      delayScale: 0.001,
      finalizeWaitMs: 50,
      sweep: { finalizeIdleMs: 200, ...opts.sweep },
      gates: opts.gates ?? testGates(),
    },
  });
}

/**
 * Gates with per-minute limits far above the production defaults, so tests aren't paced by
 * Perplexity's 45 RPM. Concurrency stays at the defaults.
 */
export const FAST_LIMITS = Object.fromEntries(
  PROVIDER_KEYS.map((p) => [p, { rpm: 60_000 }]),
) as Partial<Record<ProviderKey, { rpm: number }>>;

export const testGates = (opts: Partial<ConstructorParameters<typeof ProviderGates>[0]> = {}) =>
  new ProviderGates({ logger: silentLogger, reporter: noopReporter, limits: FAST_LIMITS, ...opts });

/** Polls `GET /runs/:id` until the run is final and settled. */
export async function waitForRun(agent: Client, runId: string, timeout = 15_000): Promise<Run> {
  let run: Run | undefined;
  await vi.waitFor(
    async () => {
      run = runSchema.parse((await agent.get(`/api/runs/${runId}`).expect(200)).body);
      if (!isFinalRunStatus(run.status) || run.aggregates === null) {
        throw new Error(`run is ${run.status}`);
      }
    },
    { timeout, interval: 25 },
  );
  if (!run) throw new Error('unreachable');
  return run;
}

/** Runs a run to the end on a throwaway worker. */
export async function completeRun(agent: Client, runId: string): Promise<Run> {
  const worker = testWorker();
  worker.start();
  try {
    return await waitForRun(agent, runId);
  } finally {
    await worker.drain(5_000);
  }
}

/** Ledger = balance for the workspace (06). */
export async function expectLedgerBalanced(workspaceId: string): Promise<void> {
  const check = await ledgerMatchesBalance(new Types.ObjectId(workspaceId));
  expect(check.ledger).toEqual(check.balance);
}
