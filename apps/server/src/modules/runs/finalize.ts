import {
  METRICS_VERSION,
  computeRunAggregates,
  type MetricCheck,
  type RunAggregates,
  type RunStatus,
} from '@pv/shared';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import { jobsRepo } from '../../jobs/repo';
import { refundForRun, refundSplit } from '../credits/service';
import { resultsRepo } from '../results/repo';
import { runsRepo, type RunDoc, type Scope } from './repo';

/** The ledger ref of a run's credits: `run/<runId>`, then `run/<runId>:<n>` for admin reruns. */
export const creditRefId = (runId: Types.ObjectId, generation: number): string =>
  generation === 1 ? runId.toHexString() : `${runId.toHexString()}:${generation}`;

export const finalizeDedupeKey = (runId: Types.ObjectId): string =>
  `finalize:${runId.toHexString()}`;

/**
 * Enqueues `finalize_run` once no check of the run is still open (04 § last-check detection).
 * The dedupe key makes a second enqueue a no-op, so every check can safely call this.
 */
export async function enqueueFinalizeIfDone(scope: Scope, runId: Types.ObjectId): Promise<boolean> {
  if ((await resultsRepo.countOpen(scope, runId)) > 0) return false;
  await enqueueFinalize(scope, runId);
  return true;
}

export async function enqueueFinalize(scope: Scope, runId: Types.ObjectId): Promise<void> {
  await jobsRepo.enqueueUnique({
    type: 'finalize_run',
    payload: { runId: runId.toHexString() },
    workspaceId: new Types.ObjectId(scope.workspaceId),
    runId,
    dedupeKey: finalizeDedupeKey(runId),
  });
}

export interface RunTotals {
  counts: RunDoc['counts'];
  aggregates: RunAggregates;
  costMicros: number;
  models: RunDoc['models'];
}

/** Counts, aggregates (05), cost and models, all from `run_results`. Recomputable at any time. */
export async function computeTotals(scope: Scope, run: RunDoc): Promise<RunTotals> {
  const [checks, spend] = await Promise.all([
    resultsRepo.metricChecks(scope, run._id),
    resultsRepo.costAndModels(scope, run._id),
  ]);
  return {
    counts: countStatuses(checks),
    aggregates: computeRunAggregates(checks, {
      brandDomain: run.brandSnapshot.domain,
      competitors: run.brandSnapshot.competitors.map((c) => ({
        id: c._id.toHexString(),
        name: c.name,
      })),
    }),
    costMicros: spend.costMicros,
    models: spend.models,
  };
}

function countStatuses(checks: readonly MetricCheck[]): RunDoc['counts'] {
  const n = (s: MetricCheck['status']) => checks.filter((c) => c.status === s).length;
  return {
    total: checks.length,
    ok: n('ok'),
    noAnswer: n('no_answer'),
    failed: n('failed'),
    canceled: n('canceled'),
  };
}

/** completed: no failures · partial: some ok and some failed · failed: nothing ok (04). */
export function finalStatus(run: Pick<RunDoc, 'status'>, counts: RunDoc['counts']): RunStatus {
  if (run.status === 'canceled') return 'canceled';
  if (counts.failed === 0) return 'completed';
  return counts.ok > 0 ? 'partial' : 'failed';
}

class AlreadyFinalized extends Error {}

export type FinalizeResult = 'finalized' | 'already' | 'waiting';

/**
 * Finalize, idempotent (04 § Finalize). Waits while any check is open, then computes the totals
 * and, in one transaction, refunds failed and canceled checks to the buckets they came from and
 * marks this generation finalized. Running it twice, or on two instances at once, refunds once:
 * the transaction is conditional on `finalizedGen`, and the ledger key is unique per generation.
 */
export async function finalizeRun(scope: Scope, runId: Types.ObjectId): Promise<FinalizeResult> {
  const run = await runsRepo.findById(scope, runId);
  if (!run || run.finalizedGen >= run.generation) return 'already';
  if ((await resultsRepo.countOpen(scope, runId)) > 0) return 'waiting';

  await runsRepo.beginFinalize(scope, runId);
  const totals = await computeTotals(scope, run);
  const charged = totals.counts.ok + totals.counts.noAnswer;

  try {
    await withTransaction(async (session) => {
      const fresh = await runsRepo.findById(scope, runId, session);
      if (!fresh || fresh.finalizedGen >= fresh.generation || fresh.generation !== run.generation) {
        throw new AlreadyFinalized();
      }
      // Everything reserved so far, minus what the checks that answered cost, minus what earlier
      // generations already refunded.
      const refund = Math.max(0, fresh.credits.reserved - charged - fresh.credits.refunded);
      const split = refundSplit(refund, fresh.credits.split, fresh.credits.refundedSplit);
      if (refund > 0) {
        await refundForRun(session, {
          workspaceId: fresh.workspaceId,
          refId: creditRefId(fresh._id, fresh.generation),
          split,
          note: `Refund: ${refund} check${refund === 1 ? '' : 's'} failed or canceled`,
        });
      }
      const status = finalStatus(fresh, totals.counts);
      const written = await runsRepo.completeFinalize(session, scope, runId, fresh.generation, {
        status,
        counts: totals.counts,
        aggregates: totals.aggregates,
        metricsVersion: METRICS_VERSION,
        costMicros: totals.costMicros,
        models: totals.models,
        finishedAt: new Date(),
        error: status === 'failed' ? 'Every check failed. All credits were refunded.' : null,
        credits: {
          reserved: fresh.credits.reserved,
          charged,
          refunded: fresh.credits.refunded + refund,
          split: fresh.credits.split,
          refundedSplit: {
            plan: fresh.credits.refundedSplit.plan + split.plan,
            purchased: fresh.credits.refundedSplit.purchased + split.purchased,
          },
        },
      });
      if (!written) throw new AlreadyFinalized();
    });
  } catch (err) {
    if (err instanceof AlreadyFinalized || isDuplicateKeyError(err)) return 'already';
    throw err;
  }
  // Scheduled runs: the run-summary email and `schedules.lastRunId` arrive with Stage 7.
  return 'finalized';
}
