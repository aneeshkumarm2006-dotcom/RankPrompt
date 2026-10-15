import { Settings, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useCompetitorInsights } from '../../lib/api/insights';
import { hasCode } from '../../lib/errors';
import { CompetitorTable, ShareOfVoiceChart } from './CompetitorTable';
import { InsightsTabs } from './InsightsTabs';
import { RankMatrix } from './RankMatrix';
import { SuggestedCompetitors } from './SuggestedCompetitors';

/** Brand dashboard, Competitors tab (F-21, F-42). */
export function CompetitorsPage() {
  const brand = useBrandOutlet();
  const insights = useCompetitorInsights(brand.id);
  const settingsLink = (
    <Link to={`/app/brands/${brand.id}/settings`} className={buttonClass('outline', 'sm')}>
      <Settings className="w-4 h-4" aria-hidden />
      Edit competitors
    </Link>
  );

  const header = (
    <>
      <PageHeader
        title="Competitors"
        description={`${brand.competitors.length} tracked ${
          brand.competitors.length === 1 ? 'competitor' : 'competitors'
        } · how you rank against them in AI answers`}
        actions={settingsLink}
      />
      <InsightsTabs brandId={brand.id} />
    </>
  );

  const noRun = (
    <EmptyState
      icon={Users}
      title="No finished report yet"
      message="Competitor rankings appear once a report for this brand has finished."
      action={
        <Link to={`/app/brands/${brand.id}/runs/new`} className={buttonClass('primary')}>
          Create a report
        </Link>
      }
    />
  );

  if (insights.isPending) {
    return (
      <>
        {header}
        <PageSpinner />
      </>
    );
  }
  if (insights.isError) {
    return (
      <>
        {header}
        {hasCode(insights.error, 'RUN_NOT_FINAL') ? (
          noRun
        ) : (
          <ErrorState error={insights.error} onRetry={() => void insights.refetch()} />
        )}
      </>
    );
  }

  const data = insights.data;
  if (data.runId === null) {
    return (
      <>
        {header}
        {noRun}
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <span>
          From the latest finished report.{' '}
          <Link
            to={`/app/runs/${data.runId}`}
            className="font-medium text-action-600 hover:text-action-700 dark:text-action-400"
          >
            Open report →
          </Link>
        </span>
        {data.competitors.length === 0 && (
          <span>
            No competitors tracked yet: add some in Brand Settings or from the suggestions.
          </span>
        )}
      </div>
      <CompetitorTable data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShareOfVoiceChart data={data} />
        <SuggestedCompetitors brand={brand} suggestions={data.suggestedCompetitors} />
      </div>
      <RankMatrix data={data} />
    </>
  );
}
