import { isFinalRunStatus, type RunListItem } from '@pv/shared';
import { Calendar, CalendarClock, Hand, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { RunStatusBadge } from '../../components/ui/Badge';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { PlatformIcon, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { formatDateTime, number, pluralize, ratioFraction, ratioPct } from '../../lib/format';
import { triggerLabel } from './RunFilters';
import { doneChecks } from './RunProgress';

/** One run in a list: v1 AllReports card look; live runs get the yellow in-progress border. */
export function RunCard({
  run,
  showBrand,
  onDelete,
}: {
  run: RunListItem;
  showBrand: boolean;
  onDelete: (run: RunListItem) => void;
}) {
  const final = isFinalRunStatus(run.status);
  const progress = run.progress;
  const done = progress ? doneChecks(progress) : 0;
  const TriggerIcon = run.trigger === 'scheduled' ? CalendarClock : Hand;
  return (
    <li
      className={`relative bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 transition-colors ${
        final
          ? 'border border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
          : 'border-2 border-yellow-500/30 dark:border-yellow-500/50 hover:border-yellow-500/50'
      }`}
    >
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          {showBrand && <BrandAvatar name={run.brandName} size="md" />}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white break-words">
                {/* Stretched link: the whole card opens the run, the delete button sits above it. */}
                <Link
                  to={`/app/runs/${run.id}`}
                  className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none focus-visible:underline"
                >
                  {showBrand ? run.brandName : `Run of ${formatDateTime(run.createdAt)}`}
                </Link>
              </h3>
              <RunStatusBadge status={run.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" aria-hidden />
                {formatDateTime(run.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TriggerIcon className="w-4 h-4" aria-hidden />
                {triggerLabel(run.trigger)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {run.platforms.map((p) => (
                  <span key={p} title={PLATFORM_SHORT[p]}>
                    <PlatformIcon platform={p} />
                  </span>
                ))}
                <span className="sr-only">
                  {run.platforms.map((p) => PLATFORM_SHORT[p]).join(', ')}
                </span>
              </span>
              <span>
                {pluralize(run.promptCount, 'prompt')} ×{' '}
                {pluralize(run.platforms.length, 'platform')} = {pluralize(run.checks, 'check')}
              </span>
            </div>

            {final ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm">Visibility:</span>
                <span className="text-purple-500 dark:text-purple-400 font-semibold">
                  {ratioPct(run.visibility)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {ratioFraction(run.visibility)}
                </span>
              </div>
            ) : progress ? (
              <div className="max-w-md">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>In progress</span>
                  <span>
                    {number(done)} / {number(progress.total)} checks
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-dark-700 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${progress.total > 0 ? (done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {final && (
          <button
            type="button"
            onClick={() => onDelete(run)}
            aria-label={`Delete run from ${formatDateTime(run.createdAt)}`}
            title="Delete run"
            className="relative z-10 flex items-center justify-center p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
}
