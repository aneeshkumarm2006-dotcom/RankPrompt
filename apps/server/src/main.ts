import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { EnvError, loadEnv } from './config/env';
import { createLogger } from './config/logger';
import { initSentry } from './config/sentry';
import { connectDb, disconnectDb, pingDb } from './db/connection';
import { createApp } from './http/app';
import { buildIntegrations } from './integrations';
import { createJobWorker } from './jobs/runtime';
import { Scheduler } from './jobs/scheduler';
import type { Worker } from './jobs/worker';
import { closeHttpServer, createLifecycle } from './lifecycle/shutdown';
import { buildServices } from './services';
import { VERSION } from './version';

/** Boot: env → logger/Sentry → DB → worker + sweeper + scheduler (if RUN_WORKER) → HTTP (if RUN_HTTP). */
async function main(): Promise<void> {
  // Local convenience: apps/server/.env. Variables already in the environment win. Never in prod.
  const dotEnv = fileURLToPath(new URL('../.env', import.meta.url));
  if (process.env.NODE_ENV !== 'production' && existsSync(dotEnv)) process.loadEnvFile(dotEnv);

  const env = loadEnv();
  const logger = createLogger(env);
  const reporter = await initSentry(env, logger);
  const lifecycle = createLifecycle({ logger, graceMs: env.SHUTDOWN_GRACE_MS });

  process.once('SIGTERM', () => void lifecycle.shutdown('SIGTERM'));
  process.once('SIGINT', () => void lifecycle.shutdown('SIGINT'));
  const crash = (kind: string) => (err: unknown) => {
    logger.fatal({ err }, kind);
    reporter.capture(err, { kind });
    void lifecycle.shutdown(kind, 1);
  };
  process.on('unhandledRejection', crash('unhandledRejection'));
  process.on('uncaughtException', crash('uncaughtException'));

  logger.info({ version: VERSION, env: env.NODE_ENV }, 'starting');
  if (env.NODE_ENV === 'production' && !env.EDGE_PROXY_SECRET) {
    logger.warn('EDGE_PROXY_SECRET is not set: X-Forwarded-For is trusted from any caller (D-027)');
  }
  await connectDb(env.MONGODB_URI, { logger, autoIndex: env.NODE_ENV !== 'production' });
  const integrations = buildIntegrations(env, logger);

  let worker: Worker | null = null;
  const services = buildServices({
    env,
    logger,
    reporter,
    integrations,
    onEnqueued: () => worker?.wake(),
  });
  if (env.RUN_WORKER) {
    worker = createJobWorker({
      env,
      logger,
      reporter,
      engine: integrations.checks,
      mailer: integrations.mailer,
      notifyRunDone: services.notifyRunDone,
    });
    worker.start();
    const scheduler = new Scheduler({ schedules: services.schedules, logger, reporter });
    scheduler.start();
    // The scheduler stops first (it only queues work), then the worker drains while HTTP still
    // answers (readiness already says 503); ~10 s of the grace period stay for HTTP and the DB.
    lifecycle.register({ name: 'scheduler', run: () => scheduler.stop() });
    const drainMs = Math.max(1_000, env.SHUTDOWN_GRACE_MS - 10_000);
    const w = worker;
    lifecycle.register({ name: 'worker', run: () => w.drain(drainMs) });
  }

  if (env.RUN_HTTP) {
    const app = createApp({
      env,
      logger,
      reporter,
      integrations,
      readiness: {
        pingDb,
        workerHeartbeatAgeMs: () => worker?.heartbeatAgeMs() ?? null,
        isShuttingDown: () => lifecycle.isShuttingDown(),
      },
      services,
    });
    const server = await listen(createServer(app), env.PORT);
    lifecycle.register({
      name: 'http',
      run: () => closeHttpServer(server, env.SHUTDOWN_GRACE_MS),
    });
    logger.info({ port: env.PORT }, 'http listening');
  }

  lifecycle.register({ name: 'sentry', run: () => reporter.flush(2_000) });
  lifecycle.register({ name: 'db', run: disconnectDb });
}

function listen(server: Server, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

main().catch((err: unknown) => {
  // The logger may not exist yet (bad env), so write straight to stderr.
  console.error(err instanceof EnvError ? err.message : err);
  process.exit(1);
});
