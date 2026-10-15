import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import type { ErrorReporter } from '../config/sentry';
import { createCheckHandler, type CheckEngine, type CheckHandlerDeps } from './handlers/check';
import { createFinalizeHandler } from './handlers/finalizeRun';
import { createReconcileHandler } from './handlers/reconcileLedger';
import { createSendEmailHandler } from './handlers/sendEmail';
import type { Mailer } from '../emails/mailer';
import type { RunNotifier } from '../modules/schedules/notify';
import { ProviderGates } from './providerGates';
import { Worker, type WorkerOptions } from './worker';

/** Builds this instance's worker with every job handler (RUN_WORKER=true). */
export function createJobWorker(deps: {
  env: Pick<
    Env,
    | 'INSTANCE_ID'
    | 'PROVIDER_LIMITS'
    | 'PROVIDER_DAILY_CAP_USD'
    | 'WORKER_CONCURRENCY'
    | 'MAX_INFLIGHT_PER_WORKSPACE'
    | 'EMAIL_FROM'
  >;
  logger: Logger;
  reporter: ErrorReporter;
  engine: CheckEngine;
  mailer: Mailer;
  /** Scheduled-run summary email after finalize. */
  notifyRunDone?: RunNotifier;
  /** Tests: shorter leases and delays, a second instance id, a custom retry policy. */
  overrides?: Partial<WorkerOptions> & {
    retry?: CheckHandlerDeps['retry'];
    finalizeWaitMs?: number;
    gates?: ProviderGates;
  };
}): Worker {
  const { env, logger, reporter, overrides = {} } = deps;
  const { retry, finalizeWaitMs, gates: customGates, ...workerOverrides } = overrides;
  const gates =
    customGates ??
    new ProviderGates({
      limits: env.PROVIDER_LIMITS,
      capsUsd: env.PROVIDER_DAILY_CAP_USD,
      logger,
      reporter,
    });
  return new Worker({
    instanceId: env.INSTANCE_ID,
    handlers: [
      createCheckHandler({ engine: deps.engine, gates, logger, ...(retry ? { retry } : {}) }),
      createFinalizeHandler({
        logger,
        reporter,
        ...(finalizeWaitMs !== undefined ? { waitMs: finalizeWaitMs } : {}),
        ...(deps.notifyRunDone ? { onFinalized: deps.notifyRunDone } : {}),
      }),
      createReconcileHandler({ logger, reporter }),
      createSendEmailHandler({ mailer: deps.mailer, from: env.EMAIL_FROM, logger }),
    ],
    gates,
    logger,
    reporter,
    concurrency: env.WORKER_CONCURRENCY,
    maxInflightPerWorkspace: env.MAX_INFLIGHT_PER_WORKSPACE,
    ...workerOverrides,
  });
}
