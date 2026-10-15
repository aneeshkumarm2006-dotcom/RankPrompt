import { shareTokenParamsSchema } from '@pv/shared';
import { LinkIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Logo } from '../../app/layout/Sidebar';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageSpinner } from '../../components/ui/Spinner';
import { ApiError } from '../../lib/api/client';
import { usePublicReport } from '../../lib/api/shares';
import { ReportView } from './ReportView';
import { filterChecks, fromPublicReport, type ReportFilter } from './viewModel';

/** Asks search engines not to index the page while it is mounted (F-14). */
function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}

/** A 4xx from the share endpoint means the link is unknown, revoked or expired. */
const isGone = (error: unknown): boolean =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-dark-950">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-dark-900/90 backdrop-blur border-b border-gray-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <Link to="/" aria-label="PromptVerse home">
            <Logo />
          </Link>
          <Link to="/register" className={buttonClass('gradient', 'sm')}>
            Track your brand free
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

function Unavailable() {
  return (
    <EmptyState
      icon={LinkIcon}
      title="This link is no longer available"
      message="The report may have been unshared, or the link expired. Ask the person who sent it for a new one."
      action={
        <Link to="/register" className={buttonClass('primary')}>
          Create your own AI visibility report
        </Link>
      }
    />
  );
}

/** `/share/:token`: the public, read-only report (F-15). */
export function SharedReportPage() {
  useNoIndex();
  const { token } = useParams();
  const valid = shareTokenParamsSchema.safeParse({ token }).success;
  const query = usePublicReport(valid ? token : undefined);
  const [filter, setFilter] = useState<ReportFilter>({});

  const base = useMemo(() => (query.data ? fromPublicReport(query.data) : null), [query.data]);
  const report = useMemo(
    () => (base ? { ...base, checks: filterChecks(base.checks, filter) } : null),
    [base, filter],
  );

  let body: ReactNode;
  if (!valid || (query.isError && isGone(query.error))) body = <Unavailable />;
  else if (query.isError)
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  else if (!report) body = <PageSpinner label="Loading report…" />;
  else body = <ReportView report={report} readOnly filter={filter} onFilterChange={setFilter} />;

  return <PublicShell>{body}</PublicShell>;
}
