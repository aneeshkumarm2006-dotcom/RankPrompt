import { PROVIDER_OF } from '@pv/engine';
import { METRICS_VERSION, isFinalRunStatus, type CreditBucket } from '@pv/shared';
import { Types } from 'mongoose';
import { withTransaction } from '../db/transaction';
import { jobsRepo } from '../jobs/repo';
import { ledgerRepo } from '../modules/credits/repo';
import { adminAdjust, ledgerMatchesBalance, reserveForRun } from '../modules/credits/service';
import { resultsRepo } from '../modules/results/repo';
import { computeTotals, creditRefId } from '../modules/runs/finalize';
import { isSettled } from '../modules/runs/mapper';
import { runsRepo, type RunDoc } from '../modules/runs/repo';
import { workspacesRepo } from '../modules/workspaces/repo';

/**
 * Support operations behind `pnpm admin <command>` (scripts/admin.ts, TODO 4.10). Each is safe to
 * run while the app is live: they use the same atomic updates and the same ledger as the app.
 */

export class AdminError extends Error {
  override name = 'AdminError';
}

const oid = (id: string, what: string): Types.ObjectId => {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AdminError(`${what} must be a 24-character id`);
  return new Types.ObjectId(id);
};

async function loadRun(runId: string): Promise<RunDoc> {
  const run = await runsRepo.findAnyById(oid(runId, '--run').toHexString());
  if (!run) throw new AdminError(`run ${runId} not found`);
  return run;
}

type Balance = { plan: number; purchased: number };

/** `adjust-credits`: an `admin_adjust` ledger row plus the matching balance change (06). */
export async function adjustCredits(a: {
  workspaceId: string;
  bucket: CreditBucket;
  delta: number;
  note: string;
}): Promise<{ before: Balance; after: Balance }> {
  if (!Number.isInteger(a.delta) || a.delta === 0) {
    throw new AdminError('--delta must be a non-zero whole number');
  }
  if (!a.note.trim()) throw new AdminError('--note is required (it is shown in the ledger)');
  const workspaceId = oid(a.workspaceId, '--workspace');
  const ws = await workspacesRepo.findById(workspaceId);
  if (!ws) throw new AdminError(`workspace ${a.workspaceId} not found`);
  const after = await withTransaction((session) =>
    adminAdjust(session, { workspaceId, bucket: a.bucket, delta: a.delta, note: a.note.trim() }),
  );
  return {
    before: { plan: ws.credits.plan, purchased: ws.credits.purchased },
    after: { plan: after.plan, purchased: after.purchased },
  };
}

/**
 * `rerun-failed`: puts a finished run's failed checks back in the queue as a new generation. The
 * checks are charged again (`run_reserve` under `run/<id>:<generation>`) and finalize refunds the
 * ones that fail again. Canceled runs are left alone.
 */
export async function rerunFailed(runId: string): Promise<{ checks: number; generation: number }> {
  const run = await loadRun(runId);
  if (!isSettled(run)) throw new AdminError(`run is ${run.status}; wait for it to finish`);
  if (run.status === 'canceled') throw new AdminError('run was canceled; start a new run instead');
  const scope = { workspaceId: run.workspaceId };
  const generation = run.generation + 1;

  const checks = await withTransaction(async (session) => {
    const reset = await resultsRepo.resetFailed(session, scope, run._id);
    if (!reset.length) return 0;
    const split = await reserveForRun(session, {
      workspaceId: run.workspaceId,
      refId: creditRefId(run._id, generation),
      cost: reset.length,
      note: `Rerun of ${reset.length} failed check${reset.length === 1 ? '' : 's'}`,
      actorUserId: null,
    });
    const started = await runsRepo.beginRerun(session, scope, run._id, run.generation, {
      total: reset.length,
      split,
    });
    if (!started) throw new AdminError('the run changed while preparing the rerun; try again');
    await jobsRepo.insertMany(
      session,
      reset.map((r) => ({
        type: 'check' as const,
        payload: { resultId: r._id.toHexString() },
        workspaceId: run.workspaceId,
        runId: run._id,
        providerKey: PROVIDER_OF[r.platform],
      })),
    );
    return reset.length;
  });
  if (!checks) throw new AdminError('the run has no failed checks');
  return { checks, generation };
}

/** `recompute-aggregates`: rebuilds counts and aggregates (05) from `run_results`. No credit change. */
export async function recomputeAggregates(runId: string) {
  const run = await loadRun(runId);
  if (!isSettled(run)) throw new AdminError(`run is ${run.status}; aggregates come at finalize`);
  const scope = { workspaceId: run.workspaceId };
  const totals = await computeTotals(scope, run);
  await runsRepo.setAggregates(scope, run._id, {
    counts: totals.counts,
    aggregates: totals.aggregates,
    metricsVersion: METRICS_VERSION,
    costMicros: totals.costMicros,
    models: totals.models,
  });
  return {
    visibility: {
      before: run.aggregates?.total.visibility ?? null,
      after: totals.aggregates.total.visibility,
    },
    counts: { before: run.counts, after: totals.counts },
  };
}

/** `inspect-run`: everything support needs to explain one run. Read-only. */
export async function inspectRun(runId: string) {
  const run = await loadRun(runId);
  const scope = { workspaceId: run.workspaceId };
  const refIds = Array.from({ length: run.generation }, (_, i) => creditRefId(run._id, i + 1));
  const [breakdown, jobs, ledger, balance] = await Promise.all([
    resultsRepo.breakdown(scope, run._id),
    jobsRepo.countsForRun(run._id),
    ledgerRepo.listForRef(run.workspaceId, 'run', refIds),
    ledgerMatchesBalance(run.workspaceId),
  ]);
  return {
    run: {
      id: run._id.toHexString(),
      workspaceId: run.workspaceId.toHexString(),
      brand: `${run.brandSnapshot.name} (${run.brandSnapshot.domain})`,
      status: run.status,
      final: isFinalRunStatus(run.status),
      settled: isSettled(run),
      generation: run.generation,
      finalizedGen: run.finalizedGen,
      trigger: run.trigger,
      platforms: run.config.platforms,
      location: [run.config.country, run.config.city].filter(Boolean).join(' / '),
      prompts: run.promptIds.length,
      engineVersion: run.engineVersion,
      metricsVersion: run.metricsVersion,
      models: run.models,
      costUsd: run.costMicros / 1_000_000,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
    },
    credits: run.credits,
    counts: run.counts,
    checks: breakdown.map((b) => ({
      platform: b._id.platform,
      status: b._id.status,
      error: b._id.error ?? null,
      n: b.n,
      attempts: b.attempts,
    })),
    jobs,
    ledger: ledger.map((l) => ({
      reason: l.reason,
      bucket: l.bucket,
      delta: l.delta,
      refId: l.refId,
      note: l.note,
      at: l.createdAt,
    })),
    workspaceLedgerBalanced: balance.ok,
  };
}
