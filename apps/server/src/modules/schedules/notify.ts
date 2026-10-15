import { isFinalRunStatus, visibilityDelta } from '@pv/shared';
import type { Types } from 'mongoose';
import type { EmailOutbox } from '../../emails/outbox';
import { resultsRepo } from '../results/repo';
import { runsRepo } from '../runs/repo';
import { schedulesRepo } from './repo';

const pct = (rate: number | null): number | null =>
  rate === null ? null : Math.round(rate * 1000) / 10;

/**
 * After a scheduled run is finalized (04 § Finalize step 5): the owners get
 * `scheduled_run_completed` with the headline numbers and the change since the schedule's previous
 * run (`run_done:<runId>`). Safe to call on every finalize attempt: the key sends it once.
 * A canceled run, or one with nothing answered and nothing to report, sends nothing.
 */
export function createRunNotifier(deps: { emails: EmailOutbox; appUrl: string }) {
  return async (workspaceId: Types.ObjectId, runId: Types.ObjectId): Promise<void> => {
    const scope = { workspaceId: workspaceId.toHexString() };
    const run = await runsRepo.findById(scope, runId);
    if (!run || run.trigger !== 'scheduled' || !run.scheduleId) return;
    if (!isFinalRunStatus(run.status) || run.status === 'canceled' || !run.aggregates) return;
    const schedule = await schedulesRepo.findById(scope, run.scheduleId.toHexString());

    const previous = await runsRepo.previousForSchedule(scope, run.scheduleId, run.createdAt);
    let deltaPts: number | null = null;
    if (previous) {
      const [prev, cur] = await Promise.all([
        resultsRepo.metricChecks(scope, previous._id),
        resultsRepo.metricChecks(scope, run._id),
      ]);
      deltaPts = visibilityDelta(prev, cur).deltaPts;
    }

    const total = run.aggregates.total;
    await deps.emails.toOwners(
      workspaceId,
      'scheduled_run_completed',
      `run_done:${run._id.toHexString()}`,
      (user) => ({
        name: user.name,
        brandName: run.brandSnapshot.name,
        scheduleLabel: schedule?.label ?? '',
        visibilityPct: pct(total.visibility.rate),
        deltaPts,
        answered: total.visibility.den,
        mentioned: total.visibility.num,
        citedPct: pct(total.citationRate.rate),
        avgRank: total.avgRank.value === null ? null : Math.round(total.avgRank.value * 10) / 10,
        failed: run.counts.failed,
        refunded: run.credits.refunded,
        runLink: `${deps.appUrl}/app/runs/${run._id.toHexString()}`,
        settingsLink: `${deps.appUrl}/app/settings`,
      }),
    );
  };
}

export type RunNotifier = ReturnType<typeof createRunNotifier>;
