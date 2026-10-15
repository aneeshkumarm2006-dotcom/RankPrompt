import type { Env } from './env';
import type { Logger } from './logger';
import { VERSION } from '../version';

/** Where 5xx errors, failed jobs and alerts are reported. Sentry is optional (D-018). */
export interface ErrorReporter {
  readonly enabled: boolean;
  capture(error: unknown, context?: Record<string, unknown>): void;
  flush(timeoutMs: number): Promise<void>;
}

export const noopReporter: ErrorReporter = {
  enabled: false,
  capture: () => undefined,
  flush: () => Promise.resolve(),
};

/** Sentry stays off (and is never even loaded) when `SENTRY_DSN` is empty. */
export async function initSentry(
  env: Pick<Env, 'SENTRY_DSN' | 'NODE_ENV'>,
  logger: Logger,
): Promise<ErrorReporter> {
  if (!env.SENTRY_DSN) return noopReporter;

  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: VERSION,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  logger.info('sentry enabled');

  return {
    enabled: true,
    capture: (error, context) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    },
    flush: async (timeoutMs) => {
      await Sentry.flush(timeoutMs);
    },
  };
}
