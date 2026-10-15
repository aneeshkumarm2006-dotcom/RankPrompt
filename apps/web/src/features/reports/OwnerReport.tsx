import type { Run } from '@pv/shared';
import { useEffect, useMemo, useState } from 'react';
import { useRunResults } from '../../lib/api/runs';
import { ReportActions } from './ReportActions';
import { ReportView } from './ReportView';
import { fromRun, type ReportFilter } from './viewModel';

/**
 * The owner's report for a finished run: server-filtered results (`/runs/:id/results`) and
 * the owner actions around the shared `ReportView`.
 */
export function OwnerReport({ run }: { run: Run }) {
  const [filter, setFilter] = useState<ReportFilter>({});
  const results = useRunResults(run.id, filter);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isError } = results;

  // The matrix needs every row of the filtered set, so keep paging until the cursor runs out.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const items = useMemo(() => results.data?.pages.flatMap((p) => p.items) ?? [], [results.data]);
  const report = useMemo(() => fromRun(run, items), [run, items]);

  return (
    <ReportView
      report={report}
      filter={filter}
      onFilterChange={setFilter}
      resultsLoading={results.isPending || hasNextPage}
      {...(results.isError
        ? { resultsError: results.error, onRetryResults: () => void results.refetch() }
        : {})}
      actions={<ReportActions runId={run.id} brandId={run.brandId} report={report} />}
    />
  );
}
