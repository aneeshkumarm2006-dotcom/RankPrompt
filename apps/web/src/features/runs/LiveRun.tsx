import type { Run } from '@pv/shared';
import { Info, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RunStatusBadge } from '../../components/ui/Badge';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Card } from '../../components/ui/PageHeader';
import { useCancelRun, useRunResults } from '../../lib/api/runs';
import { errorMessage, hasCode } from '../../lib/errors';
import { formatDateTime, locationLabel, pluralize } from '../../lib/format';
import { PlatformBreakdown } from './PlatformBreakdown';
import { doneChecks, RunProgress } from './RunProgress';

/** `/app/runs/:id` while the run is queued or running (F-11, F-41). */
export function LiveRun({ run }: { run: Run }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = useCancelRun();
  const results = useRunResults(run.id);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch, isError } = results;
  const done = doneChecks(run.progress);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // The run polls every 2 s; refresh the per-platform rows whenever a check finishes.
  useEffect(() => {
    if (done > 0) void refetch();
  }, [done, refetch]);

  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const status = run.status;

  const onCancel = () => {
    cancel.mutate(run.id, {
      onSuccess: () => {
        setConfirmCancel(false);
        toast.success('Run canceled. Checks that had not run yet were refunded.');
      },
      onError: (err) => {
        setConfirmCancel(false);
        toast.error(
          hasCode(err, 'CONFLICT') ? 'This run has already finished.' : errorMessage(err),
        );
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            <BrandAvatar name={run.brand.name} domain={run.brand.domain} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white break-words">
                  {run.brand.name}
                </h1>
                <RunStatusBadge status={status} />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {pluralize(run.promptCount, 'prompt')} ×{' '}
                {pluralize(run.config.platforms.length, 'platform')} ·{' '}
                {locationLabel(run.config.country, run.config.city)} · started{' '}
                {formatDateTime(run.startedAt ?? run.createdAt)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<XCircle className="w-4 h-4" />}
            onClick={() => setConfirmCancel(true)}
            disabled={status === 'finalizing'}
          >
            Cancel run
          </Button>
        </div>

        <div className="text-center mb-8">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-3" aria-hidden />
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {status === 'queued'
              ? 'Waiting to start…'
              : status === 'finalizing'
                ? 'Putting your report together…'
                : 'Asking the AI platforms…'}
          </h2>
        </div>

        <RunProgress progress={run.progress} />

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          You can close this tab; the run continues on the server. The report appears here when it
          finishes.
        </p>
      </div>

      <Card title="By platform">
        <PlatformBreakdown platforms={run.config.platforms} results={items} />
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this run?"
        message="Checks that haven't run yet are stopped and refunded. Answers already collected stay in the report."
        confirmLabel="Cancel run"
        danger
        loading={cancel.isPending}
        onConfirm={onCancel}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
