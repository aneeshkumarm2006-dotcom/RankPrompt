import { randomUUID } from 'node:crypto';
import {
  createFakeAdapter,
  createFakeBrandAI,
  createFakeExtractor,
  type BrandAI,
} from '@pv/engine';
import { PLATFORMS, meSchema, type Me } from '@pv/shared';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { pino } from 'pino';
import request from 'supertest';
import { inject, vi } from 'vitest';
import { loadEnv, type Env } from '../src/config/env';
import type { Logger } from '../src/config/logger';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import { ensureIndexes } from '../src/db/indexes';
import { EmailSendError, type Mailer, type OutgoingEmail } from '../src/emails/mailer';
import { createApp } from '../src/http/app';
import { AppError } from '../src/http/errors';
import { DEFAULT_RATE_LIMITS, type RateLimitConfig } from '../src/http/middleware/rateLimits';
import type { Integrations } from '../src/integrations';
import type { CheckEngine } from '../src/jobs/handlers/check';
import { createSendEmailHandler } from '../src/jobs/handlers/sendEmail';
import { jobsRepo } from '../src/jobs/repo';
import { buildServices, type Services } from '../src/services';
import type { GoogleIdentity, GoogleVerifier } from '../src/modules/auth/google';
import type { BillingGateway } from '../src/modules/billing/gateway';

export const silentLogger: Logger = pino({ level: 'silent' });

export const APP_URL = 'http://localhost:5173';
export const JWT_SECRET = 'test-secret-'.padEnd(40, 'x');

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    ...overrides,
  });
}

/** Limits high enough that only the test exercising one ever hits it. */
export const RELAXED_LIMITS: RateLimitConfig = {
  global: { limit: 100_000, windowMs: 60_000 },
  authPerIp: { limit: 100_000, windowMs: 60_000 },
  loginPerEmail: { ...DEFAULT_RATE_LIMITS.loginPerEmail },
  emailSendsPerKey: { limit: 100_000, windowMs: 60_000 },
  costlyPerWorkspace: { limit: 100_000, windowMs: 60_000 },
  publicSharePerIp: { limit: 100_000, windowMs: 60_000 },
};

/** Captures sent emails instead of logging them. `failures` makes the next sends throw. */
export class FakeMailer implements Mailer {
  readonly driver = 'fake';
  readonly sent: OutgoingEmail[] = [];
  /** The next sends fail: `transient` ones are retried by the job, `permanent` ones aren't. */
  failures: ('transient' | 'permanent')[] = [];

  send(message: OutgoingEmail): Promise<{ id: string | null }> {
    const failure = this.failures.shift();
    if (failure) {
      return Promise.reject(new EmailSendError(`fake ${failure} failure`, failure === 'permanent'));
    }
    this.sent.push(message);
    return Promise.resolve({ id: `fake_${this.sent.length}` });
  }

  /** Waits for the (queued) email to `to` with that template, and returns its link token. */
  async tokenFor(to: string, template: string): Promise<string> {
    let token = '';
    await vi.waitFor(() => {
      const message = this.sent.findLast((m) => m.to === to && m.template === template);
      const match = message && /token=([\w-]+)/.exec(message.text);
      if (!match?.[1]) throw new Error(`no ${template} email to ${to} yet`);
      token = match[1];
    });
    return token;
  }

  /** Waits until `n` emails with this template (to `to`, if given) have been sent. */
  async waitFor(template: string, n = 1, to?: string): Promise<OutgoingEmail[]> {
    let found: OutgoingEmail[] = [];
    await vi.waitFor(() => {
      found = this.sent.filter((m) => m.template === template && (!to || m.to === to));
      if (found.length < n) throw new Error(`${found.length}/${n} ${template} emails`);
    });
    return found;
  }
}

/**
 * Runs the queued `send_email` jobs that are due, with the real handler, until none are left
 * (the test stand-in for the worker: a test app without one would never send). Returns how many
 * jobs it ran.
 */
export async function deliverEmails(mailer: Mailer): Promise<number> {
  const handler = createSendEmailHandler({
    mailer,
    from: 'PromptVerse <test@example.com>',
    logger: silentLogger,
  });
  let n = 0;
  for (;;) {
    const job = await jobsRepo.claim({
      types: ['send_email'],
      instanceId: 'test-mail',
      leaseMs: 30_000,
      excludeProviders: [],
      excludeWorkspaces: [],
    });
    if (!job?.leaseId) return n;
    n++;
    const outcome = await handler.run({
      job,
      leaseId: job.leaseId,
      signal: new AbortController().signal,
    });
    if (outcome.kind === 'done') await jobsRepo.complete(job._id, job.leaseId);
    if (outcome.kind === 'retry') {
      await jobsRepo.requeue(job._id, job.leaseId, new Date(Date.now() + outcome.delayMs), {
        refundAttempt: outcome.refundAttempt,
        lastError: outcome.error,
      });
    }
    if (outcome.kind === 'failed' && (await jobsRepo.fail(job._id, job.leaseId, outcome.error))) {
      await handler.onGiveUp?.(job, outcome.error);
    }
  }
}

/** Delivers queued emails in the background whenever something is enqueued. */
function backgroundDelivery(mailer: Mailer): () => void {
  let running: Promise<void> | null = null;
  let again = false;
  const run = (): void => {
    if (running) {
      again = true;
      return;
    }
    running = deliverEmails(mailer)
      // The test file may already have closed its DB; nothing to report then.
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        running = null;
        if (again) {
          again = false;
          run();
        }
      });
  };
  return run;
}

/** Accepts credentials of the form `google:<key>` registered with `add()`. */
export class FakeGoogle implements GoogleVerifier {
  private readonly identities = new Map<string, GoogleIdentity>();

  add(key: string, identity: GoogleIdentity): string {
    this.identities.set(key, identity);
    return `google:${key}`;
  }

  verify(credential: string): Promise<GoogleIdentity> {
    const identity = this.identities.get(credential.replace(/^google:/, ''));
    if (!identity) throw new AppError('UNAUTHENTICATED', 'Google sign-in failed');
    return Promise.resolve(identity);
  }
}

/** FAKE_PROVIDERS for every platform: deterministic answers, no network, no cost. */
export function fakeCheckEngine(): CheckEngine {
  return {
    adapters: Object.fromEntries(PLATFORMS.map((p) => [p, createFakeAdapter(p)])),
    extractor: createFakeExtractor(),
  };
}

export interface TestApp {
  app: Express;
  env: Env;
  mailer: FakeMailer;
  google: FakeGoogle;
  integrations: Integrations;
  services: Services;
}

export function makeTestApp(
  opts: {
    env?: Record<string, string>;
    limits?: Partial<RateLimitConfig>;
    brandAI?: BrandAI | null;
    google?: boolean;
    checks?: CheckEngine;
    billing?: BillingGateway;
    onEnqueued?: () => void;
    /** Off: queued emails stay queued until the test calls `deliverEmails`. */
    deliverEmails?: boolean;
    /** A fake clock for schedule slots. */
    now?: () => Date;
  } = {},
): TestApp {
  const env = testEnv({ APP_URL, JWT_ACCESS_SECRET: JWT_SECRET, ...opts.env });
  const mailer = new FakeMailer();
  const google = new FakeGoogle();
  const integrations: Integrations = {
    google: opts.google === false ? null : google,
    brandAI: opts.brandAI === undefined ? createFakeBrandAI() : opts.brandAI,
    mailer,
    checks: opts.checks ?? fakeCheckEngine(),
    billing: opts.billing ?? null,
  };
  const deliver = opts.deliverEmails === false ? () => undefined : backgroundDelivery(mailer);
  const onEnqueued = () => {
    opts.onEnqueued?.();
    deliver();
  };
  const services = buildServices({
    env,
    logger: silentLogger,
    reporter: noopReporter,
    integrations,
    onEnqueued,
    ...(opts.now ? { now: opts.now } : {}),
  });
  const app = createApp({
    env,
    logger: silentLogger,
    reporter: noopReporter,
    readiness: { pingDb, workerHeartbeatAgeMs: () => null, isShuttingDown: () => false },
    integrations,
    rateLimits: { ...RELAXED_LIMITS, ...opts.limits },
    onEnqueued,
    services,
  });
  return { app, env, mailer, google, integrations, services };
}

/** Connects this test file to its own database on the shared replica set. */
export async function connectTestDb(name: string): Promise<void> {
  await connectDb(inject('mongoUri'), { logger: silentLogger, autoIndex: true, dbName: name });
  await ensureIndexes();
}

export async function dropTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

export const uniqueEmail = (prefix = 'user'): string =>
  `${prefix}-${randomUUID().slice(0, 8)}@example.com`;

export const PASSWORD = 'correct horse battery';

/** A cookie-keeping client that sends the app's Origin on every request, like the web app. */
export function client(app: Express) {
  return request.agent(app).set('Origin', APP_URL);
}
export type Client = ReturnType<typeof client>;

/** Registers a new account and returns its signed-in client and `Me`. */
export async function signUp(
  app: Express,
  body: { email?: string; name?: string; password?: string; ref?: string } = {},
): Promise<{ agent: Client; me: Me; email: string }> {
  const agent = client(app);
  const email = body.email ?? uniqueEmail();
  const res = await agent
    .post('/api/auth/register')
    .send({
      name: body.name ?? 'Test User',
      email,
      password: body.password ?? PASSWORD,
      ...(body.ref ? { ref: body.ref } : {}),
    })
    .expect(201);
  return { agent, me: meSchema.parse(res.body), email };
}

/** Parses a Set-Cookie header into `{ name: attributes }`. */
export function cookiesOf(res: { headers: Record<string, unknown> }): Record<string, string> {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  return Object.fromEntries(list.map((c) => [c.slice(0, c.indexOf('=')), c]));
}
