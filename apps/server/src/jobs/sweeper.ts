import type { Logger } from '../config/logger';
import type { ErrorReporter } from '../config/sentry';
import { enqueueFinalizeIfDone } from '../modules/runs/finalize';
import { runsRepo } from '../modules/runs/repo';
import { scheduleReconcile } from './handlers/reconcileLedger';
import { jobsRepo, type JobType } from './repo';
import type { JobHandler } from './types';

export interface SweepOptions {
  handlers: ReadonlyMap<JobType, JobHandler>;
  logger: Logger;
  reporter: ErrorReporter;
  /** A run untouched this long with no open checks gets finalize enqueued (04: 2 min). */
  finalizeIdleMs: number;
  /** A run still `queued` after this long is reported (04: 30 min). */
  stuckQueuedMs: number;
  now?: () => Date;
}

/** Runs already reported as stuck, so each alert fires once per instance. */
const reportedStuck = new Set<string>();

/**
 * The sweeper (04), every 60 s on every instance. Everything it does is idempotent:
 * 1. expired leases: the job is requeued (or failed on its last attempt, and its handler told);
 * 2. runs with no open checks that still aren't finalized: `finalize_run` is enqueued again;
 * 3. runs still `queued` after 30 minutes: an alert;
 * 4. today's ledger reconciliation is enqueued (once a day, 06).
 */
export interface SweepStats {
  requeued: number;
  failed: number;
  finalizeEnqueued: number;
  stuck: number;
}

export async function sweep(
  opts: Partial<SweepOptions> & Pick<SweepOptions, 'handlers' | 'logger' | 'reporter'>,
): Promise<SweepStats> {
  const now = opts.now?.() ?? new Date();
  const finalizeIdleMs = opts.finalizeIdleMs ?? 2 * 60_000;
  const stuckQueuedMs = opts.stuckQueuedMs ?? 30 * 60_000;
  const stats: SweepStats = { requeued: 0, failed: 0, finalizeEnqueued: 0, stuck: 0 };

  for (const job of await jobsRepo.findExpired(now, 200)) {
    const outcome = await jobsRepo.recoverExpired(job, now);
    if (outcome === 'requeued') stats.requeued++;
    if (outcome === 'failed') {
      stats.failed++;
      opts.logger.error(
        { jobId: job._id.toHexString(), type: job.type },
        'job failed: lease expired on its last attempt',
      );
      opts.reporter.capture(new Error(`job ${job.type} failed: lease expired on last attempt`), {
        jobId: job._id.toHexString(),
      });
      await opts.handlers.get(job.type)?.onGiveUp?.(job, 'lease expired on the last attempt');
    }
  }

  for (const run of await runsRepo.findUnfinalized(new Date(now.getTime() - finalizeIdleMs), 100)) {
    if (await enqueueFinalizeIfDone({ workspaceId: run.workspaceId }, run._id)) {
      stats.finalizeEnqueued++;
    }
  }

  for (const run of await runsRepo.findStuckQueued(new Date(now.getTime() - stuckQueuedMs), 50)) {
    const id = run._id.toHexString();
    if (reportedStuck.has(id)) continue;
    reportedStuck.add(id);
    stats.stuck++;
    opts.logger.error({ runId: id, createdAt: run.createdAt }, 'run still queued after 30 minutes');
    opts.reporter.capture(new Error('run stuck in queued'), { runId: id });
  }

  await scheduleReconcile(now);

  if (stats.requeued || stats.failed || stats.finalizeEnqueued || stats.stuck) {
    opts.logger.info(stats, 'sweep');
  }
  return stats;
}
