import { engineVersion } from '@pv/engine';
import type { Env } from './config/env';
import type { Logger } from './config/logger';
import type { ErrorReporter } from './config/sentry';
import { createEmailOutbox, type EmailOutbox } from './emails/outbox';
import { availablePlatforms, type Integrations } from './integrations';
import { createLowCreditWarning } from './modules/credits/lowCredits';
import { createRunsService, type RunsService } from './modules/runs/service';
import { createRunNotifier, type RunNotifier } from './modules/schedules/notify';
import { createSchedulesService, type SchedulesService } from './modules/schedules/service';

/**
 * The services the HTTP app, the worker and the scheduler share. `main.ts` builds them once per
 * process; `createApp` builds its own when it isn't given them (tests).
 */
export interface Services {
  emails: EmailOutbox;
  runs: RunsService;
  schedules: SchedulesService;
  /** Finalize → the scheduled-run summary email (04 § Finalize step 5). */
  notifyRunDone: RunNotifier;
}

export function buildServices(deps: {
  env: Env;
  logger: Logger;
  reporter: ErrorReporter;
  integrations: Integrations;
  /** Jobs were enqueued: wake this instance's worker. */
  onEnqueued?: () => void;
  /** Tests: a fake clock for `nextRunAt`. */
  now?: () => Date;
}): Services {
  const { env, logger, integrations } = deps;
  const emails = createEmailOutbox({
    logger,
    ...(deps.onEnqueued ? { onEnqueued: deps.onEnqueued } : {}),
  });
  const runs = createRunsService({
    logger,
    availablePlatforms: () => availablePlatforms(integrations.checks),
    engineVersion: engineVersion(integrations.checks.extractor?.model ?? env.OPENAI_EXTRACT_MODEL),
    aioLoadAsync: env.DATAFORSEO_LOAD_ASYNC_AIO,
    onCreditsReserved: createLowCreditWarning({ emails, appUrl: env.APP_URL }),
    ...(deps.onEnqueued ? { onEnqueued: deps.onEnqueued } : {}),
  });
  const schedules = createSchedulesService({
    runs,
    emails,
    appUrl: env.APP_URL,
    logger,
    reporter: deps.reporter,
    ...(deps.now ? { now: deps.now } : {}),
  });
  return {
    emails,
    runs,
    schedules,
    notifyRunDone: createRunNotifier({ emails, appUrl: env.APP_URL }),
  };
}
