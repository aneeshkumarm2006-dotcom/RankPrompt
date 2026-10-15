import type { Platform } from '@pv/shared';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useOverview } from '../../lib/api/insights';
import { CategoryVisibility } from './CategoryVisibility';
import { CategorySelect, FilterBar, PlatformSelect } from './FilterSelects';
import { InsightsTabs } from './InsightsTabs';
import { LatestRunTiles, OverviewStatusBar } from './OverviewSummary';
import { PlatformScores } from './PlatformScores';
import { RankedMissedPrompts } from './RankedMissedPrompts';
import { orderedPlatforms } from './range';
import { TopCitedDomains } from './TopCitedDomains';
import { TrendCard } from './TrendCard';

/** Brand dashboard, Overview tab (F-19, F-20; v1 PerformanceSummary). */
export function OverviewPage() {
  const brand = useBrandOutlet();
  const overview = useOverview(brand.id);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const header = (
    <>
      <PageHeader
        title="Performance Summary"
        description="Track your AI visibility across platforms"
      />
      <InsightsTabs brandId={brand.id} />
    </>
  );

  if (overview.isPending) {
    return (
      <>
        {header}
        <PageSpinner />
      </>
    );
  }
  if (overview.isError) {
    return (
      <>
        {header}
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  const data = overview.data;
  const run = data.latestRun;
  if (!run) {
    return (
      <>
        {header}
        <OverviewStatusBar brandId={brand.id} overview={data} />
        <EmptyState
          icon={TrendingUp}
          title="No reports yet"
          message="Run your first report to see visibility analytics for this brand."
          action={
            <Link to={`/app/brands/${brand.id}/runs/new`} className={buttonClass('primary')}>
              Create first report
            </Link>
          }
        />
      </>
    );
  }

  const platforms = orderedPlatforms([...run.platforms, ...Object.keys(run.aggregates.byPlatform)]);
  const categories = [
    ...new Set([...brand.categories.map((c) => c.name), ...Object.keys(run.aggregates.byCategory)]),
  ];

  return (
    <>
      {header}
      <OverviewStatusBar brandId={brand.id} overview={data} />
      <LatestRunTiles run={run} delta={data.delta} />
      <FilterBar>
        <CategorySelect value={category} categories={categories} onChange={setCategory} />
        <PlatformSelect value={platform} platforms={platforms} onChange={setPlatform} />
      </FilterBar>
      <TrendCard brandId={brand.id} platform={platform} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PlatformScores byPlatform={run.aggregates.byPlatform} platform={platform} />
        <CategoryVisibility byCategory={run.aggregates.byCategory} category={category} />
      </div>
      <RankedMissedPrompts
        brandId={brand.id}
        runId={run.id}
        runCreatedAt={run.createdAt}
        platform={platform}
        category={category}
      />
      <TopCitedDomains brandId={brand.id} domains={run.aggregates.topCitedDomains} />
    </>
  );
}
