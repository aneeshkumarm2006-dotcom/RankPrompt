/**
 * Local soak for schedules and email (TODO 7.5), with real timers:
 *
 *   pnpm --filter @pv/server soak            (60 s)
 *   SOAK_SECONDS=300 pnpm --filter @pv/server soak
 *
 * Starts its own in-memory replica set and two "instances" in one process, each with its own job
 * worker (sweeper on) and scheduler ticking every second, the way two Render instances overlap
 * during a deploy. Fake providers only: no network, no cost. Every few seconds it makes every
 * active schedule's slot due (time passing faster than real time). One workspace is kept short
 * of credits so its schedule skips and pauses itself.
 *
 * At the end it checks: one run per slot, every run final and finalized, no slot left claimed,
 * ledger = balance in every workspace, a sent summary email per finished scheduled run, the
 * poor schedule paused after 3 skips with its emails, and no failed jobs. Exit code 1 otherwise.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import request from 'supertest';
import { brandSchema, promptListResponseSchema, scheduleSchema, type Platform } from '@pv/shared';
import { loadEnv } from '../src/config/env';
import { createLogger } from '../src/config/logger';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import { ensureIndexes } from '../src/db/indexes';
import { withTransaction } from '../src/db/transaction';
import { op } from '../src/db/trusted';
import { createApp } from '../src/http/app';
import { buildIntegrations } from '../src/integrations';
import { JobModel } from '../src/jobs/model';
import { createJobWorker } from '../src/jobs/runtime';
import { Scheduler } from '../src/jobs/scheduler';
import type { Worker } from '../src/jobs/worker';
import { adminAdjust, ledgerMatchesBalance } from '../src/modules/credits/service';
import { EmailLogModel } from '../src/modules/emailLog/model';
import { RunModel } from '../src/modules/runs/model';
import { ScheduleModel } from '../src/modules/schedules/model';
import { buildServices } from '../src/services';

const SECONDS = Number(process.env.SOAK_SECONDS ?? 60);
const PUSH_EVERY_MS = 3_000;
const APP_URL = 'http://localhost:5173';
const BIG = { limit: 1_000_000, windowMs: 60_000 };
const SYSTEM = { crossWorkspace: true };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`);
};

async function main(): Promise<void> {
  console.log(`soak: ${SECONDS}s, 2 instances, real timers, fake providers`);
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const env = loadEnv({
    NODE_ENV: 'development',
    MONGODB_URI: replSet.getUri('soak'),
    APP_URL,
    JWT_ACCESS_SECRET: 'soak-secret-'.padEnd(40, 'x'),
    FAKE_PROVIDERS: 'true',
    LOG_LEVEL: 'warn',
    PROVIDER_LIMITS: JSON.stringify(
      Object.fromEntries(
        ['openai', 'perplexity', 'gemini', 'anthropic', 'dataforseo'].map((p) => [
          p,
          { rpm: 60_000 },
        ]),
      ),
    ),
  });
  const logger = createLogger(env);
  await connectDb(env.MONGODB_URI, { logger, autoIndex: true });
  await ensureIndexes();
  const integrations = buildIntegrations(env, logger);

  const instances = [0, 1].map((i) => {
    let worker: Worker | null = null;
    const services = buildServices({
      env,
      logger,
      reporter: noopReporter,
      integrations,
      onEnqueued: () => worker?.wake(),
    });
    worker = createJobWorker({
      env: { ...env, INSTANCE_ID: `soak-${i}` },
      logger,
      reporter: noopReporter,
      engine: integrations.checks,
      mailer: integrations.mailer,
      notifyRunDone: services.notifyRunDone,
      overrides: { sweepMs: 5_000, pollMs: 100 },
    });
    const scheduler = new Scheduler({
      schedules: services.schedules,
      logger,
      reporter: noopReporter,
      tickMs: 1_000,
    });
    return { services, worker, scheduler };
  });
  const first = instances[0];
  if (!first) throw new Error('no instance');

  const app = createApp({
    env,
    logger,
    reporter: noopReporter,
    readiness: { pingDb, workerHeartbeatAgeMs: () => null, isShuttingDown: () => false },
    integrations,
    services: first.services,
    rateLimits: {
      global: BIG,
      authPerIp: BIG,
      loginPerEmail: { ...BIG, maxLockMs: 60_000 },
      emailSendsPerKey: BIG,
      costlyPerWorkspace: BIG,
      publicSharePerIp: BIG,
    },
  });

  // ---- Data: 4 funded workspaces with mixed schedules, 1 poor one ----------------------------
  const platforms: Platform[] = ['chatgpt', 'perplexity', 'gemini'];
  const workspaces: string[] = [];
  let poorSchedule = '';
  for (let w = 0; w < 5; w++) {
    const agent = request.agent(app).set('Origin', APP_URL);
    const me = await agent
      .post('/api/auth/register')
      .send({ name: `Soak ${w}`, email: `soak${w}@example.com`, password: 'correct horse battery' })
      .expect(201);
    const workspaceId = (me.body as { workspace: { id: string } }).workspace.id;
    workspaces.push(workspaceId);
    const poor = w === 4;
    await withTransaction((session) =>
      adminAdjust(session, {
        workspaceId: new Types.ObjectId(workspaceId),
        bucket: 'purchased',
        delta: poor ? -45 : 5_000,
        note: 'soak',
      }),
    );
    const brand = brandSchema.parse(
      (
        await agent
          .post('/api/brands')
          .send({ name: `Brand ${w}`, websiteUrl: `soak${w}.com` })
          .expect(201)
      ).body,
    );
    promptListResponseSchema.parse(
      (
        await agent
          .post(`/api/brands/${brand.id}/prompts`)
          .send({
            prompts: Array.from({ length: 4 }, (_, i) => ({
              text: `Soak prompt ${w}.${i}?`,
              category: 'Soak',
            })),
          })
          .expect(201)
      ).body,
    );
    for (const [k, frequency] of (['weekly', 'monthly'] as const).entries()) {
      const s = scheduleSchema.parse(
        (
          await agent
            .post('/api/schedules')
            .send({
              brandId: brand.id,
              label: `${frequency} ${k}`,
              frequency,
              weekday: 2,
              dayOfMonth: 3,
              hour: 6 + k,
              timezone: k ? 'America/Toronto' : 'Europe/London',
              platforms: platforms.slice(0, 2 + k),
              promptSelection: { mode: 'all_active' },
              country: 'US',
              language: 'en',
              scope: 'national',
            })
            .expect(201)
        ).body,
      );
      if (poor && k === 0) poorSchedule = s.id;
      if (poor && k === 1) {
        await agent.delete(`/api/schedules/${s.id}`).expect(204);
      }
    }
  }

  // ---- Soak --------------------------------------------------------------------------------
  for (const i of instances) {
    i.worker.start();
    i.scheduler.start();
  }
  let pushes = 0;
  const started = Date.now();
  while (Date.now() - started < SECONDS * 1_000) {
    await ScheduleModel.updateMany(
      { isActive: true, inFlight: null },
      { $set: { nextRunAt: new Date() } },
    ).setOptions(SYSTEM);
    pushes++;
    await sleep(PUSH_EVERY_MS);
  }
  console.log(`pushed slots ${pushes} times; stopping schedulers and draining`);
  await Promise.all(instances.map((i) => i.scheduler.stop()));

  // Let in-flight runs and emails finish, then stop the workers.
  const deadline = Date.now() + 90_000;
  for (;;) {
    const open = await RunModel.countDocuments({
      $expr: op({ $lt: ['$finalizedGen', '$generation'] }),
    }).setOptions(SYSTEM);
    const emails = await JobModel.countDocuments({
      type: 'send_email',
      status: op({ $in: ['queued', 'running'] }),
    });
    if ((open === 0 && emails === 0) || Date.now() > deadline) break;
    await sleep(500);
  }
  await Promise.all(instances.map((i) => i.worker.drain(10_000)));

  // ---- Checks ------------------------------------------------------------------------------
  const runs = await RunModel.find({ trigger: 'scheduled' }).setOptions(SYSTEM).lean();
  console.log(`scheduled runs: ${runs.length}`);
  check(runs.length > 0, 'scheduled runs were created');
  const keys = new Set(runs.map((r) => `${r.workspaceId.toHexString()}|${r.idempotencyKey}`));
  check(keys.size === runs.length, 'one run per slot (no duplicate idempotency keys)');
  check(
    runs.every((r) => ['completed', 'partial', 'failed', 'canceled'].includes(r.status)),
    'every run is final',
  );
  check(
    runs.every((r) => r.finalizedGen >= r.generation),
    'every run is finalized',
  );
  const claimed = await ScheduleModel.countDocuments({ inFlight: op({ $ne: null }) }).setOptions(
    SYSTEM,
  );
  check(claimed === 0, 'no slot left claimed');
  for (const ws of workspaces) {
    const r = await ledgerMatchesBalance(new Types.ObjectId(ws));
    check(
      r.ledger.plan === r.balance.plan && r.ledger.purchased === r.balance.purchased,
      `ledger = balance for workspace ${ws}`,
    );
  }
  const summaries = await EmailLogModel.find({ template: 'scheduled_run_completed' }).lean();
  const sentFor = new Set(
    summaries.filter((e) => e.status === 'sent').map((e) => e.idempotencyKey.split(':')[1]),
  );
  const reportable = runs.filter((r) => r.status !== 'canceled');
  check(
    reportable.every((r) => sentFor.has(r._id.toHexString())),
    `a sent summary email for each of the ${reportable.length} finished scheduled runs`,
  );
  check(summaries.length === reportable.length, 'no duplicate summary emails');
  const poor = await ScheduleModel.findById(poorSchedule).setOptions(SYSTEM).lean();
  check(
    poor?.isActive === false && poor.pausedReason === 'insufficient_credits',
    'the short-of-credits schedule paused itself',
  );
  const skips = await EmailLogModel.countDocuments({
    template: 'run_skipped_low_credits',
    idempotencyKey: new RegExp(`^skip:${poorSchedule}:`),
  });
  check(skips === 3, `3 skip emails for it (got ${skips})`);
  const pausedMail = await EmailLogModel.countDocuments({
    template: 'schedule_paused',
    idempotencyKey: new RegExp(`^paused:${poorSchedule}:`),
  });
  check(pausedMail === 1, 'one schedule_paused email');
  const failedJobs = await JobModel.countDocuments({ status: 'failed' });
  check(failedJobs === 0, `no failed jobs (got ${failedJobs})`);
  const stuckEmails = await EmailLogModel.countDocuments({
    status: op({ $in: ['queued', 'failed'] }),
  });
  check(stuckEmails === 0, `every email sent or suppressed (left: ${stuckEmails})`);

  await disconnectDb();
  await replSet.stop();
  if (problems.length) {
    console.error(`\nsoak FAILED: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('\nsoak passed');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
