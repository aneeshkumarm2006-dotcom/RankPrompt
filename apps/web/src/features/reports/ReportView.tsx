import { useState, type ReactNode } from 'react';
import { ErrorState } from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Spinner';
import { pluralize } from '../../lib/format';
import { AnswerModal } from './AnswerModal';
import { ReportCharts } from './ReportCharts';
import { ReportFilters } from './ReportFilters';
import { ReportHeader } from './ReportHeader';
import { ShareOfVoice, SuggestedCompetitors, TopCitedDomains } from './ReportLists';
import { ReportTiles } from './ReportTiles';
import { ResultsTable } from './ResultsTable';
import type { ReportCheck, ReportFilter, ReportViewModel } from './viewModel';

export interface ReportViewProps {
  report: ReportViewModel;
  /** Public share: no actions and nothing owner-only (F-15). */
  readOnly?: boolean;
  /** The results filters; `report.checks` must already be filtered by them. */
  filter: ReportFilter;
  onFilterChange: (filter: ReportFilter) => void;
  /** Owner actions (share, export, schedule, delete); never rendered when `readOnly`. */
  actions?: ReactNode;
  /** Results still loading (the owner view pages through `/runs/:id/results`). */
  resultsLoading?: boolean;
  resultsError?: unknown;
  onRetryResults?: () => void;
}

/**
 * The run report (F-13..F-16), one component for the owner and the public share. It only
 * displays server numbers (05); `report` comes from `fromRun` or `fromPublicReport`.
 */
export function ReportView({
  report,
  readOnly = false,
  filter,
  onFilterChange,
  actions,
  resultsLoading = false,
  resultsError,
  onRetryResults,
}: ReportViewProps) {
  const [open, setOpen] = useState<ReportCheck | null>(null);
  const columns = filter.platform ? [filter.platform] : report.platforms;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ReportHeader report={report} readOnly={readOnly} actions={actions} />
      <ReportTiles aggregates={report.aggregates} />
      <ReportCharts aggregates={report.aggregates} platforms={report.platforms} />
      <ShareOfVoice aggregates={report.aggregates} brandName={report.brand.name} />

      <section aria-labelledby="report-results" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="report-results" className="text-xl font-bold text-gray-800 dark:text-white">
            Results
          </h2>
          {!resultsLoading && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pluralize(report.checks.length, 'check')}
            </span>
          )}
        </div>
        <ReportFilters
          filter={filter}
          onChange={onFilterChange}
          platforms={report.platforms}
          categories={report.categories}
        />
        {resultsError ? (
          <ErrorState
            error={resultsError}
            title="Could not load the results"
            {...(onRetryResults ? { onRetry: onRetryResults } : {})}
          />
        ) : resultsLoading ? (
          <div className="py-12">
            <Spinner label="Loading results…" />
          </div>
        ) : (
          <ResultsTable checks={report.checks} platforms={columns} onOpen={setOpen} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TopCitedDomains aggregates={report.aggregates} />
        <SuggestedCompetitors aggregates={report.aggregates} />
      </div>

      <AnswerModal check={open} brand={report.brand} onClose={() => setOpen(null)} />
    </div>
  );
}
