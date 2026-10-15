import type { Schedule } from '@pv/shared';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Globe,
  History,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Trash2,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PlatformIcon, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { usePauseSchedule, useResumeSchedule, useRunScheduleNow } from '../../lib/api/schedules';
import { errorMessage, hasCode } from '../../lib/errors';
import { formatDateTime, languageLabel, locationLabel, pluralize } from '../../lib/format';
import { frequencySummary, pausedReasonText, skipReasonText } from './scheduleText';

function Info({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-xl p-4 min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="flex items-start gap-2 text-gray-800 dark:text-white font-semibold text-sm">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/** One schedule in the v1 "Scheduled Report Details" look, with its actions (F-25). */
export function ScheduleCard({
  schedule: s,
  readOnly,
  onEdit,
  onDelete,
}: {
  schedule: Schedule;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const pause = usePauseSchedule(s.brandId);
  const resume = useResumeSchedule(s.brandId);
  const runNow = useRunScheduleNow(s.brandId);
  const busy = pause.isPending || resume.isPending || runNow.isPending;

  const toggle = () => {
    const m = s.isActive ? pause : resume;
    m.mutate(s.id, {
      onSuccess: () => toast.success(s.isActive ? 'Schedule paused' : 'Schedule resumed'),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  const startNow = () =>
    runNow.mutate(s.id, {
      onSuccess: (run) => {
        toast.success('Run started');
        void navigate(`/app/runs/${run.id}`);
      },
      onError: (err) =>
        toast.error(
          hasCode(err, 'INSUFFICIENT_CREDITS')
            ? `Not enough credits to run this now: it needs ${pluralize(s.creditsPerRun, 'credit')}. Top up on the billing page.`
            : errorMessage(err),
        ),
    });

  const title = s.label || frequencySummary(s).split(' at ')[0] || 'Schedule';

  return (
    <article className="bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl p-5 sm:p-6 shadow-sm">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate">{title}</h2>
            {s.isActive ? (
              <Badge tone="green">● Active</Badge>
            ) : (
              <Badge tone={s.pausedReason === 'user' ? 'gray' : 'yellow'}>
                ● {pausedReasonText(s.pausedReason)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{frequencySummary(s)}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              icon={<Pencil className="w-4 h-4" />}
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={s.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              onClick={toggle}
              disabled={busy}
              loading={pause.isPending || resume.isPending}
            >
              {s.isActive ? 'Pause' : 'Resume'}
            </Button>
            <Button
              size="sm"
              icon={<Zap className="w-4 h-4" />}
              onClick={startNow}
              disabled={busy}
              loading={runNow.isPending}
            >
              Run now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 dark:text-red-400"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={onDelete}
              aria-label={`Delete schedule ${title}`}
            >
              Delete
            </Button>
          </div>
        )}
      </header>

      {s.isActive && s.consecutiveSkips > 0 && (
        <div className="mb-5 rounded-xl p-3 flex items-start gap-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            The last {pluralize(s.consecutiveSkips, 'run was', 'runs were')} skipped for lack of
            credits. After 3 in a row the schedule pauses itself.{' '}
            <Link to="/app/billing" className="underline hover:no-underline">
              Top up credits
            </Link>
          </span>
        </div>
      )}

      {s.isActive && s.lastSkip && s.lastSkip.reason !== 'insufficient_credits' && (
        <div className="mb-5 rounded-xl p-3 flex items-start gap-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            {skipReasonText(s.lastSkip.reason)} The last run ({formatDateTime(s.lastSkip.at)}) was
            skipped.{' '}
            {s.lastSkip.reason === 'no_prompts' && (
              <Link
                to={`/app/brands/${s.brandId}/prompts`}
                className="underline hover:no-underline"
              >
                Open the prompt library
              </Link>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Info label="Next run" icon={<Clock className="w-4 h-4 text-blue-500" />}>
          {s.isActive ? formatDateTime(s.nextRunAt) : 'Paused'}
        </Info>
        <Info label="Last run" icon={<History className="w-4 h-4 text-gray-400" />}>
          {s.lastRunId ? (
            <Link
              to={`/app/runs/${s.lastRunId}`}
              className="text-action-600 dark:text-action-400 hover:underline"
            >
              {formatDateTime(s.lastRunAt)}
            </Link>
          ) : (
            'Never'
          )}
        </Info>
        <Info label="Platforms" icon={<Calendar className="w-4 h-4 text-primary-500" />}>
          <span className="flex flex-wrap gap-1.5">
            {s.platforms.map((p) => (
              <span key={p} className="inline-flex items-center gap-1" title={PLATFORM_SHORT[p]}>
                <PlatformIcon platform={p} />
                <span className="sr-only">{PLATFORM_SHORT[p]}</span>
              </span>
            ))}
          </span>
        </Info>
        <Info label="Prompts" icon={<ListChecks className="w-4 h-4 text-purple-500" />}>
          {s.promptSelection.mode === 'all_active'
            ? 'All active'
            : `${pluralize(s.promptSelection.promptIds.length, 'fixed prompt')}`}
        </Info>
        <Info label="Location" icon={<Globe className="w-4 h-4 text-green-500" />}>
          <span className="block truncate">{locationLabel(s.country, s.city)}</span>
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
            {languageLabel(s.language)} · {s.scope === 'local' ? 'Local' : 'National'}
          </span>
        </Info>
        <Info label="Credits per run" icon={<Zap className="w-4 h-4 text-amber-500" />}>
          {pluralize(s.creditsPerRun, 'credit')}
        </Info>
      </div>
    </article>
  );
}
