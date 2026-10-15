import type { RunListItem } from '@pv/shared';
import { TrendingUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import type { RunsFilter } from '../../lib/api/queryKeys';
import { useDeleteRun, useRuns } from '../../lib/api/runs';
import { errorMessage, hasCode } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { RunCard } from './RunCard';

/** Cursor-paginated run list with delete (F-17, F-23). Live runs refresh on their own. */
export function RunList({
  filter,
  showBrand,
  emptyAction,
}: {
  filter: RunsFilter;
  showBrand: boolean;
  emptyAction?: ReactNode;
}) {
  const runs = useRuns(filter);
  const deleteRun = useDeleteRun();
  const [toDelete, setToDelete] = useState<RunListItem | null>(null);

  const onConfirm = () => {
    if (!toDelete) return;
    deleteRun.mutate(toDelete.id, {
      onSuccess: () => toast.success('Run deleted'),
      onError: (err) =>
        toast.error(
          hasCode(err, 'RUN_NOT_FINAL')
            ? 'This run is still going. You can delete it once it finishes.'
            : errorMessage(err),
        ),
      onSettled: () => setToDelete(null),
    });
  };

  if (runs.isPending) {
    return (
      <div className="py-16">
        <Spinner label="Loading reports…" />
      </div>
    );
  }
  if (runs.isError) return <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />;

  const items = runs.data.pages.flatMap((p) => p.items);
  const filtered = Object.keys(filter).some((k) => k !== 'brandId');
  if (items.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={filtered ? 'No runs match these filters' : 'No reports yet'}
        message={
          filtered
            ? 'Try another status or run type.'
            : 'Run an analysis to see how AI platforms talk about your brand.'
        }
        {...(!filtered && emptyAction ? { action: emptyAction } : {})}
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4">
        {items.map((run) => (
          <RunCard key={run.id} run={run} showBrand={showBrand} onDelete={setToDelete} />
        ))}
      </ul>
      {runs.hasNextPage && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            loading={runs.isFetchingNextPage}
            onClick={() => void runs.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this run?"
        message={
          toDelete
            ? `The ${toDelete.brandName} run from ${formatDateTime(toDelete.createdAt)}, its results and any share links will be deleted. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete run"
        danger
        loading={deleteRun.isPending}
        onConfirm={onConfirm}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
