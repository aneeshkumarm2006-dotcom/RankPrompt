/**
 * Fake-provider load test (TODO 8.1, CHECKLIST P8):
 *
 *   pnpm loadtest                         (real time, about 10 minutes)
 *   LOAD_TIME_SCALE=10 pnpm loadtest      (10× faster: latencies ÷ 10, rate limits × 10)
 *
 * Three workspaces each start a run of 150 prompts × 5 platforms (2,250 checks) at the same
 * moment, on one instance with the production worker settings (env defaults, or whatever
 * WORKER_CONCURRENCY / MAX_INFLIGHT_PER_WORKSPACE / PROVIDER_LIMITS say). The fake providers have
 * realistic latency (per platform, with jitter), their own provider-side rate limit a little
 * above our configured RPM (so a deploy overlap or a bursty limiter gets real 429s with
 * Retry-After), plus random 429s and 5xx. The vendor extractor gets latency and random 429s too.
 *
 * Pass criteria (exit code 1 otherwise):
 * - every run `completed`, every check `ok` / `no_answer`, no failed job, ledger = balance;
 * - the 429 path was exercised (some checks were retried after a 429);
 * - speed: each run finishes within LOAD_TARGET_MIN (default 12) minutes of real-time-equivalent;
 * - fairness: when the first run finishes, every other run is at least LOAD_FAIR_PCT (75) % done.
 *
 * It also prints the floor the provider limits impose (checks ÷ RPM, and checks × latency ÷
 * concurrency, per provider), so a slow result says whether the queue or the limits are to blame.
 * Latencies are assumptions until the 2.11 hand-check measures real ones (LATENCY_MS below).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import request from 'supertest';
import {
  DEFAULT_PROVIDER_LIMITS,
  PROVIDER_KEYS,
  PROVIDER_OF,
  ProviderError,
  createFakeAdapter,
  createFakeExtractor,
  ExtractError,
  type Extractor,
  type PlatformAdapter,
  type ProviderKey,
} from '@pv/engine';
import {
  PLATFORMS,
  brandSchema,
  promptListResponseSchema,
  runSchema,
  type Platform,
} from '@pv/shared';
import { loadEnv } from '../src/config/env';
import { createLogger } from '../src/config/logger';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import { ensureIndexes } from '../src/db/indexes';
import { withTransaction } from '../src/db/transaction';
import { op } from '../src/db/trusted';
import { createApp } from '../src/http/app';
import { buildIntegrations } from '../src/integrations';
import type { CheckEngine } from '../src/jobs/handlers/check';
import { JobModel } from '../src/jobs/model';
import { ProviderGates } from '../src/jobs/providerGates';
import { createJobWorker } from '../src/jobs/runtime';
import type { Worker } from '../src/jobs/worker';
import { adminAdjust, ledgerMatchesBalance } from '../src/modules/credits/service';
import { ResultModel } from '../src/modules/results/model';
import { RunModel } from '../src/modules/runs/model';
import { WorkspaceModel } from '../src/modules/workspaces/model';
import { buildServices } from '../src/services';

const SCALE = Number(process.env.LOAD_TIME_SCALE ?? 1);
const RUNS = Number(process.env.LOAD_RUNS ?? 3);
const PROMPTS = Number(process.env.LOAD_PROMPTS ?? 150);
const INSTANCES = Number(process.env.LOAD_INSTANCES ?? 1);
const TARGET_MIN = Number(process.env.LOAD_TARGET_MIN ?? 12);
const FAIR_PCT = Number(process.env.LOAD_FAIR_PCT ?? 75);
const APP_URL = 'http://localhost:5173';
const SYSTEM = { crossWorkspace: true };

/** Median answer latency per platform (ms, real time). Jitter multiplies it by 0.5–1.8. */
const LATENCY_MS: Record<Platform, number> = {
  chatgpt: 12_000, // Responses API + web_search
  perplexity: 6_000, // Agent API `fast`
  gemini: 5_000, // Flash with Search grounding
  claude: 25_000, // Opus + web search (up to 2 searches)
  google_aio: 6_000, // DataForSEO live/advanced
};
const EXTRACT_LATENCY_MS = 1_500;
/** The providers' own limits sit this far above our configured RPM. */
const PROVIDER_HEADROOM = 1.1;
const RANDOM_429 = 0.01;
const RANDOM_5XX = 0.005;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
const jitter = (ms: number) => (ms * (0.5 + Math.random() * 1.3)) / SCALE;

// ---- Fake providers with their own rate limits ------------------------------------------------

const stats = { calls: 0, limited429: 0, random429: 0, random5xx: 0, extract429: 0 };

/** The provider side: a token bucket holding 15 s of its limit. */
class ProviderBucket {
  private tokens: number;
  private at = Date.now();
  constructor(private readonly rpm: number) {
    this.tokens = rpm / 4;
  }
  take(): number | null {
    const now = Date.now();
    this.tokens = Math.min(this.rpm / 4, this.tokens + ((now - this.at) / 60_000) * this.rpm);
    this.at = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return null;
    }
    return Math.ceil(((1 - this.tokens) / this.rpm) * 60_000);
  }
}

function loadAdapter(platform: Platform, bucket: ProviderBucket): PlatformAdapter {
  const base = createFakeAdapter(platform);
  const provider = PROVIDER_OF[platform];
  return {
    ...base,
    async ask(input, signal) {
      stats.calls++;
      await sleep(200 / SCALE, signal);
      const wait = bucket.take();
      if (wait !== null) {
        stats.limited429++;
        throw new ProviderError(provider, 'rate_limited', '429 rate limit (provider side)', {
          status: 429,
          retryAfterMs: Math.max(1_000 / SCALE, wait),
        });
      }
      if (Math.random() < RANDOM_429) {
        stats.random429++;
        throw new ProviderError(provider, 'rate_limited', '429 (random)', {
          status: 429,
          retryAfterMs: (2_000 + Math.random() * 6_000) / SCALE,
        });
      }
      const latency = jitter(LATENCY_MS[platform]);
      await sleep(latency, signal);
      if (Math.random() < RANDOM_5XX) {
        stats.random5xx++;
        throw new ProviderError(provider, 'transient', '503 (random)', { status: 503 });
      }
      const ans = await base.ask(input, signal);
      return { ...ans, latencyMs: Math.round(latency * SCALE) };
    },
  };
}

/** Like the real extractor: random 429s, two internal retries (1 s, 3 s), then ExtractError. */
function loadExtractor(): Extractor {
  const base = createFakeExtractor();
  return {
    ...base,
    async extract(prose, signal) {
      for (let attempt = 1; ; attempt++) {
        await sleep(jitter(EXTRACT_LATENCY_MS), signal);
        if (Math.random() >= RANDOM_429) return base.extract(prose, signal);
        stats.extract429++;
        if (attempt === 3) throw new ExtractError('vendor extraction failed: 429 three times');
        await sleep((1_000 * 3 ** (attempt - 1)) / SCALE, signal);
      }
    },
  };
}

// ---- Main -------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const env = loadEnv({
    NODE_ENV: 'development',
    MONGODB_URI: replSet.getUri('load'),
    APP_URL,
    JWT_ACCESS_SECRET: 'load-secret-'.padEnd(40, 'x'),
    FAKE_PROVIDERS: 'true',
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
    ...(process.env.WORKER_CONCURRENCY
      ? { WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY }
      : {}),
    ...(process.env.MAX_INFLIGHT_PER_WORKSPACE
      ? { MAX_INFLIGHT_PER_WORKSPACE: process.env.MAX_INFLIGHT_PER_WORKSPACE }
      : {}),
    ...(process.env.PROVIDER_LIMITS ? { PROVIDER_LIMITS: process.env.PROVIDER_LIMITS } : {}),
  });
  const limits = Object.fromEntries(
    PROVIDER_KEYS.map((p) => {
      const o = env.PROVIDER_LIMITS?.[p];
      const d = DEFAULT_PROVIDER_LIMITS[p];
      return [p, { rpm: o?.rpm ?? d.rpm ?? 600, concurrency: o?.concurrency ?? d.concurrency }];
    }),
  ) as Record<ProviderKey, { rpm: number; concurrency: number }>;

  console.log(
    `load test: ${RUNS} runs × ${PROMPTS} prompts × ${PLATFORMS.length} platforms, ` +
      `${INSTANCES} instance(s), time scale ${SCALE}×, WORKER_CONCURRENCY ${env.WORKER_CONCURRENCY}, ` +
      `MAX_INFLIGHT_PER_WORKSPACE ${env.MAX_INFLIGHT_PER_WORKSPACE}`,
  );
  console.log('provider limits (per instance):');
  const floors: number[] = [];
  for (const p of PROVIDER_KEYS) {
    const platforms = PLATFORMS.filter((pl) => PROVIDER_OF[pl] === p);
    const n = RUNS * PROMPTS * platforms.length;
    const meanLatency =
      platforms.reduce((s, pl) => s + LATENCY_MS[pl] * 1.15 + 200, 0) / platforms.length +
      EXTRACT_LATENCY_MS * 1.15;
    const byRpm = n / limits[p].rpm;
    const byConcurrency = (n * meanLatency) / limits[p].concurrency / 60_000;
    floors.push(Math.max(byRpm, byConcurrency));
    console.log(
      `  ${p.padEnd(10)} rpm ${String(limits[p].rpm).padStart(4)}  concurrency ${String(limits[p].concurrency).padStart(3)}` +
        `  → ${n} checks need ≥ ${byRpm.toFixed(1)} min by RPM, ≥ ${byConcurrency.toFixed(1)} min by concurrency`,
    );
  }
  console.log(`floor set by the provider limits: ${Math.max(...floors).toFixed(1)} min\n`);

  const logger = createLogger(env);
  await connectDb(env.MONGODB_URI, { logger, autoIndex: true });
  await ensureIndexes();
  const integrations = buildIntegrations(env, logger);
  const buckets = Object.fromEntries(
    PROVIDER_KEYS.map((p) => [p, new ProviderBucket(limits[p].rpm * SCALE * PROVIDER_HEADROOM)]),
  ) as Record<ProviderKey, ProviderBucket>;
  const engine: CheckEngine = {
    adapters: Object.fromEntries(
      PLATFORMS.map((pl) => [pl, loadAdapter(pl, buckets[PROVIDER_OF[pl]])]),
    ),
    extractor: loadExtractor(),
  };
  const scaledLimits = Object.fromEntries(
    PROVIDER_KEYS.map((p) => [
      p,
      { rpm: limits[p].rpm * SCALE, concurrency: limits[p].concurrency },
    ]),
  );

  const workers: Worker[] = [];
  const services = buildServices({
    env,
    logger,
    reporter: noopReporter,
    integrations,
    onEnqueued: () => workers.forEach((w) => w.wake()),
  });
  for (let i = 0; i < INSTANCES; i++) {
    workers.push(
      createJobWorker({
        env: { ...env, INSTANCE_ID: `load-${i}` },
        logger,
        reporter: noopReporter,
        engine,
        mailer: integrations.mailer,
        overrides: {
          delayScale: 1 / SCALE,
          fairRefreshMs: 2_000 / SCALE,
          gates: new ProviderGates({ limits: scaledLimits, logger, reporter: noopReporter }),
        },
      }),
    );
  }
  const BIG = { limit: 1_000_000, windowMs: 60_000 };
  const app = createApp({
    env,
    logger,
    reporter: noopReporter,
    readiness: { pingDb, workerHeartbeatAgeMs: () => null, isShuttingDown: () => false },
    integrations,
    services,
    rateLimits: {
      global: BIG,
      authPerIp: BIG,
      loginPerEmail: { ...BIG, maxLockMs: 60_000 },
      emailSendsPerKey: BIG,
      costlyPerWorkspace: BIG,
      publicSharePerIp: BIG,
    },
  });

  // ---- Data: RUNS agency workspaces with PROMPTS prompts each ------------------------------
  const accounts: {
    agent: ReturnType<typeof request.agent>;
    ws: string;
    brandId: string;
    promptIds: string[];
  }[] = [];
  for (let w = 0; w < RUNS; w++) {
    const agent = request.agent(app).set('Origin', APP_URL);
    const me = await agent
      .post('/api/auth/register')
      .send({ name: `Load ${w}`, email: `load${w}@example.com`, password: 'correct horse battery' })
      .expect(201);
    const ws = (me.body as { workspace: { id: string } }).workspace.id;
    await WorkspaceModel.updateOne(
      { _id: ws },
      { $set: { 'plan.tier': 'agency', 'plan.status': 'active' } },
    ).setOptions(SYSTEM);
    await withTransaction((session) =>
      adminAdjust(session, {
        workspaceId: new Types.ObjectId(ws),
        bucket: 'purchased',
        delta: PROMPTS * PLATFORMS.length,
        note: 'load test',
      }),
    );
    const brand = brandSchema.parse(
      (
        await agent
          .post('/api/brands')
          .send({
            name: `Acme ${w}`,
            websiteUrl: `acme${w}.com`,
            competitors: [
              { name: 'Globex', domain: 'globex.example' },
              { name: 'Initech', domain: 'initech.example' },
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
            prompts: Array.from({ length: PROMPTS }, (_, i) => ({
              text: `Best analytics tool for workload ${w}.${i}?`,
              category: 'Load',
            })),
          })
          .expect(201)
      ).body,
    );
    accounts.push({ agent, ws, brandId: brand.id, promptIds: prompts.map((p) => p.id) });
  }

  // ---- Start every run at once -------------------------------------------------------------
  for (const w of workers) w.start();
  const started = Date.now();
  const runIds = await Promise.all(
    accounts.map(async (a, i) => {
      const res = await a.agent
        .post('/api/runs')
        .set('Idempotency-Key', `load-run-${i}`)
        .send({
          brandId: a.brandId,
          promptIds: a.promptIds,
          platforms: PLATFORMS,
          country: 'US',
          language: 'en',
          scope: 'national',
        })
        .expect(201);
      return runSchema.parse(res.body).id;
    }),
  );
  const total = PROMPTS * PLATFORMS.length;
  const minutes = (ms: number) => (ms * SCALE) / 60_000;

  // ---- Watch progress ----------------------------------------------------------------------
  const finishedAt = new Map<string, number>();
  const firstProgressAt = new Map<string, number>();
  let pctAtFirstFinish: number[] | null = null;
  let lastPrint = 0;
  const sampleMs = 2_000 / SCALE;
  const deadline = started + (TARGET_MIN * 3 * 60_000) / SCALE;
  for (;;) {
    const rows = await ResultModel.aggregate<{ _id: Types.ObjectId; done: number }>([
      { $match: { runId: { $in: runIds.map((id) => new Types.ObjectId(id)) } } },
      {
        $group: {
          _id: '$runId',
          done: {
            $sum: {
              $cond: [{ $in: ['$status', ['ok', 'no_answer', 'failed', 'canceled']] }, 1, 0],
            },
          },
        },
      },
    ]).option(SYSTEM);
    const done = runIds.map((id) => rows.find((r) => r._id.toHexString() === id)?.done ?? 0);
    const now = Date.now();
    done.forEach((d, i) => {
      const id = runIds[i] as string;
      if (d > 0 && !firstProgressAt.has(id)) firstProgressAt.set(id, now);
    });
    const runs = await RunModel.find({ _id: op({ $in: runIds }) })
      .setOptions(SYSTEM)
      .select({ status: 1, finalizedGen: 1, generation: 1 })
      .lean();
    for (const r of runs) {
      const id = r._id.toHexString();
      if (r.finalizedGen >= r.generation && !finishedAt.has(id)) {
        finishedAt.set(id, now);
        if (!pctAtFirstFinish) pctAtFirstFinish = done.map((d) => (100 * d) / total);
      }
    }
    if (now - lastPrint >= 30_000 / SCALE || finishedAt.size === runIds.length) {
      lastPrint = now;
      console.log(
        `t=${minutes(now - started)
          .toFixed(1)
          .padStart(5)} min  ` +
          done
            .map((d, i) => `run${i} ${String(Math.round((100 * d) / total)).padStart(3)}%`)
            .join('  ') +
          `  (429s so far: ${stats.limited429 + stats.random429})`,
      );
    }
    if (finishedAt.size === runIds.length || now > deadline) break;
    await sleep(sampleMs);
  }
  await Promise.all(workers.map((w) => w.drain(10_000)));

  // ---- Checks ------------------------------------------------------------------------------
  const problems: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}`);
  };
  console.log('\nresults:');
  const durations = runIds.map((id) => {
    const end = finishedAt.get(id);
    return end === undefined ? Number.POSITIVE_INFINITY : minutes(end - started);
  });
  runIds.forEach((id, i) => {
    const first = firstProgressAt.get(id);
    console.log(
      `  run${i}: finished in ${(durations[i] ?? 0).toFixed(1)} min` +
        ` (first check done after ${first ? (((first - started) * SCALE) / 1000).toFixed(1) : '—'} s)`,
    );
  });
  const finals = await RunModel.find({ _id: op({ $in: runIds }) })
    .setOptions(SYSTEM)
    .lean();
  check(
    finals.length === runIds.length && finals.every((r) => r.status === 'completed'),
    `every run completed (${finals.map((r) => r.status).join(', ')})`,
  );
  const failedChecks = await ResultModel.countDocuments({
    runId: op({ $in: runIds }),
    status: op({ $nin: ['ok', 'no_answer'] }),
  }).setOptions(SYSTEM);
  check(failedChecks === 0, `every check ok or no_answer (others: ${failedChecks})`);
  const failedJobs = await JobModel.countDocuments({ status: 'failed' });
  check(failedJobs === 0, `no failed jobs (got ${failedJobs})`);
  for (const a of accounts) {
    const r = await ledgerMatchesBalance(new Types.ObjectId(a.ws));
    check(
      r.ledger.plan === r.balance.plan && r.ledger.purchased === r.balance.purchased,
      `ledger = balance for workspace ${a.ws}`,
    );
  }
  const retried = await ResultModel.countDocuments({
    runId: op({ $in: runIds }),
    attempts: op({ $gt: 1 }),
  }).setOptions(SYSTEM);
  console.log(
    `  provider calls ${stats.calls}; 429s: ${stats.limited429} from provider limits, ` +
      `${stats.random429} random; 5xx: ${stats.random5xx}; extractor 429s: ${stats.extract429}; ` +
      `checks that needed more than one attempt: ${retried}`,
  );
  check(stats.limited429 + stats.random429 > 0, '429s happened and were retried');
  const slowest = Math.max(...durations);
  check(
    slowest <= TARGET_MIN,
    `each run finished within ${TARGET_MIN} min (slowest ${slowest.toFixed(1)} min)`,
  );
  const lagging = pctAtFirstFinish ? Math.min(...pctAtFirstFinish) : 0;
  check(
    lagging >= FAIR_PCT,
    `fairness: when the first run finished, every run was ≥ ${FAIR_PCT}% done ` +
      `(${(pctAtFirstFinish ?? []).map((p) => `${Math.round(p)}%`).join(', ')})`,
  );

  await disconnectDb();
  await replSet.stop();
  if (problems.length) {
    console.error(`\nload test FAILED: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('\nload test passed');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
