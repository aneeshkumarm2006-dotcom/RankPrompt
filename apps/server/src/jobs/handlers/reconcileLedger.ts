import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import { reconcileLedger } from '../../modules/credits/reconcile';
import { jobsRepo } from '../repo';
import type { JobHandler } from '../types';
import { DONE } from '../types';

/** When the nightly reconciliation runs (UTC), away from the busy hours. */
export const RECONCILE_HOUR_UTC = 3;

/** `reconcile_ledger:<YYYY-MM-DD>`, due at 03:00 UTC that day. */
export function reconcileJobFor(now: Date): { dedupeKey: string; runAt: Date } {
  const day = now.toISOString().slice(0, 10);
  return {
    dedupeKey: `reconcile_ledger:${day}`,
    runAt: new Date(`${day}T${String(RECONCILE_HOUR_UTC).padStart(2, '0')}:00:00.000Z`),
  };
}

/**
 * Called by every sweep on every instance: enqueues today's reconciliation once. The dedupe key
 * is never revived, so it runs once a day however many instances sweep.
 */
export async function scheduleReconcile(now: Date): Promise<boolean> {
  const { dedupeKey, runAt } = reconcileJobFor(now);
  return jobsRepo.enqueueOnce({
    type: 'reconcile_ledger',
    payload: {},
    workspaceId: null,
    dedupeKey,
    runAt,
    maxAttempts: 3,
  });
}

/** The `reconcile_ledger` job (06 § nightly reconciliation): report-only, never fixes anything. */
export function createReconcileHandler(deps: {
  logger: Logger;
  reporter: ErrorReporter;
}): JobHandler {
  return {
    type: 'reconcile_ledger',
    async run({ signal }) {
      if (signal.aborted) return { kind: 'abandoned' };
      await reconcileLedger(deps);
      return DONE;
    },
    onGiveUp(job, error) {
      deps.logger.error({ jobId: job._id, error }, 'ledger reconciliation gave up');
      deps.reporter.capture(new Error(`ledger reconciliation failed: ${error}`));
      return Promise.resolve();
    },
  };
}
