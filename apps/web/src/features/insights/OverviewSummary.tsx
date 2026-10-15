import type { InsightsOverview } from '@pv/shared';
import {
  Award,
  Calendar,
  ExternalLink,
  Eye,
  FileText,
  Hash,
  Link2,
  ListChecks,
  PieChart,
  Repeat,
  Target,
} from 'lucide-react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/ui/Button';
import { MetricTile } from '../../components/ui/MetricTile';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { RunStatusBadge } from '../../components/ui/Badge';
import { deltaPts, formatDateTime, number, pluralize, rank, timeAgo } from '../../lib/format';

type LatestRun = NonNullable<InsightsOverview['latestRun']>;

function DeltaHint({ delta }: { delta: InsightsOverview['delta'] }) {
  if (!delta || delta.deltaPts === null) return <span>No previous comparable run</span>;
  const tone =
    delta.deltaPts > 0
      ? 'text-green-600 dark:text-green-400'
      : delta.deltaPts < 0
        ? 'text-red-600 dark:text-red-400'
        : '';
  return (
    <span>
      <strong className={tone}>{deltaPts(delta.deltaPts)}</strong> vs previous run over{' '}
      {pluralize(delta.sharedPrompts, 'shared prompt')}
    </span>
  );
}

/** The latest run's headline numbers (F-19): server aggregates only (05). */
export function LatestRunTiles({
  run,
  delta,
}: {
  run: LatestRun;
  delta: InsightsOverview['delta'];
}) {
  const t = run.aggregates.total;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <MetricTile
        label="Visibility"
        icon={Eye}
        ratio={t.visibility}
        hint={<DeltaHint delta={delta} />}
      />
      <MetricTile label="Citation rate" icon={Link2} accent="blue" ratio={t.citationRate} />
      <MetricTile label="Prompt coverage" icon={Target} accent="green" ratio={t.promptCoverage} />
      <MetricTile label="Top-3 rate" icon={Award} accent="orange" ratio={t.top3Rate} />
      <MetricTile
        label="Average rank"
        icon={Hash}
        accent="red"
        value={rank(t.avgRank.value)}
        hint={`over ${pluralize(t.avgRank.count, 'ranked mention')}`}
      />
      <MetricTile label="Share of voice" icon={PieChart} ratio={t.shareOfVoice} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Repeat; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-action-50 dark:bg-action-900/30">
        <Icon className="w-4 h-4 text-action-600 dark:text-action-400" aria-hidden />
      </div>
      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="font-semibold text-gray-800 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

/** Counts, next scheduled run and the link to the latest report. */
export function OverviewStatusBar({
  brandId,
  overview,
}: {
  brandId: string;
  overview: InsightsOverview;
}) {
  const { counts, nextScheduledRunAt, latestRun } = overview;
  return (
    <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 sm:p-5 mb-6 border border-gray-200 dark:border-dark-700 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
        <Stat icon={Repeat} label="Runs" value={number(counts.runs)} />
        <Stat icon={ListChecks} label="Active prompts" value={number(counts.activePrompts)} />
        <Stat icon={Calendar} label="Active schedules" value={number(counts.activeSchedules)} />
        <Stat
          icon={Calendar}
          label="Next scheduled run"
          value={
            nextScheduledRunAt
              ? `${formatDateTime(nextScheduledRunAt)} (${timeAgo(nextScheduledRunAt)})`
              : 'None scheduled'
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {latestRun && (
          <>
            <div className="flex items-center gap-1" aria-label="Platforms in the latest run">
              {latestRun.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} />
              ))}
            </div>
            <RunStatusBadge status={latestRun.status} />
            <Link to={`/app/runs/${latestRun.id}`} className={buttonClass('outline', 'sm')}>
              <FileText className="w-4 h-4" aria-hidden />
              Latest report
            </Link>
          </>
        )}
        <Link to={`/app/brands/${brandId}/schedules`} className={buttonClass('ghost', 'sm')}>
          Schedules
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
