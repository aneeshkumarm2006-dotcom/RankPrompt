import { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import { finalizeRun } from '../../modules/runs/finalize';
import type { JobHandler } from '../types';
import { DONE } from '../types';

/** How long finalize waits before looking again while some checks are still open. */
export const FINALIZE_WAIT_MS = 10_000;

/** The `finalize_run` job (04 § Finalize). Idempotent: see `finalizeRun`. */
export function createFinalizeHandler(deps: {
  logger: Logger;
  reporter: ErrorReporter;
  waitMs?: number;
  /** After a finalize (and on every later attempt, so a crash can't lose it): notifications. */
  onFinalized?: (workspaceId: Types.ObjectId, runId: Types.ObjectId) => Promise<void>;
}): JobHandler {
  return {
    type: 'finalize_run',

    async run({ job, signal }) {
      if (!job.workspaceId) throw new Error('finalize job has no workspaceId');
      if (signal.aborted) return { kind: 'abandoned' };
      const runId = new Types.ObjectId(String(job.payload.runId));
      const result = await finalizeRun({ workspaceId: job.workspaceId }, runId);
      if (result === 'waiting') {
        // A canceled run's in-flight checks are still finishing; they end within their timeout
        // or lease, so this is bounded. Waiting doesn't use up an attempt.
        return {
          kind: 'retry',
          delayMs: deps.waitMs ?? FINALIZE_WAIT_MS,
          refundAttempt: true,
          error: 'checks still open',
        };
      }
      if (result === 'finalized') deps.logger.info({ runId }, 'run finalized');
      await deps.onFinalized?.(job.workspaceId, runId);
      return DONE;
    },

    onGiveUp(job, error) {
      // The sweeper re-enqueues finalize for runs left unfinalized, so this only needs a report.
      deps.logger.error({ jobId: job._id, runId: job.runId, error }, 'finalize gave up');
      deps.reporter.capture(new Error(`finalize_run gave up: ${error}`), {
        runId: job.runId?.toHexString(),
      });
      return Promise.resolve();
    },
  };
}
