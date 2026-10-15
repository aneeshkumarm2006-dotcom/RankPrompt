import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { buttonClass } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import type { RunsFilter } from '../../lib/api/queryKeys';
import { RunFilters } from './RunFilters';
import { RunList } from './RunList';

/** `/app/brands/:brandId/runs`: the brand's runs (F-23). */
export function BrandRunsPage() {
  const brand = useBrandOutlet();
  const [filter, setFilter] = useState<Omit<RunsFilter, 'brandId'>>({});
  const newRun = (
    <Link to={`/app/brands/${brand.id}/runs/new`} className={buttonClass('primary')}>
      <Plus className="w-4 h-4" aria-hidden />
      New run
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Reports"
        description={`Visibility runs for ${brand.name}`}
        actions={newRun}
      />
      <RunFilters filter={filter} onChange={setFilter} />
      <RunList filter={{ ...filter, brandId: brand.id }} showBrand={false} emptyAction={newRun} />
    </>
  );
}
