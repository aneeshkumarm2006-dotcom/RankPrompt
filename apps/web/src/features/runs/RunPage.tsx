import { isFinalRunStatus } from '@pv/shared';
import { FileQuestion } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageSpinner } from '../../components/ui/Spinner';
import { useRun } from '../../lib/api/runs';
import { isNotFound } from '../../lib/errors';
import { OwnerReport } from '../reports/OwnerReport';
import { LiveRun } from './LiveRun';

/** `/app/runs/:runId`: live progress while the run goes, then the report on the same route. */
export function RunPage() {
  const { runId } = useParams();
  const run = useRun(runId);
  // `useRun` drops the cached result rows when the run turns final.
  const final = run.data ? isFinalRunStatus(run.data.status) : null;

  if (run.isPending) return <PageSpinner label="Loading run…" />;
  if (run.isError) {
    if (isNotFound(run.error)) {
      return (
        <EmptyState
          icon={FileQuestion}
          title="Run not found"
          message="It may have been deleted."
          action={
            <Link to="/app/runs" className={buttonClass('primary')}>
              All reports
            </Link>
          }
        />
      );
    }
    return <ErrorState error={run.error} onRetry={() => void run.refetch()} />;
  }
  return final ? <OwnerReport run={run.data} /> : <LiveRun run={run.data} />;
}
