import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import type { RunsFilter } from '../../lib/api/queryKeys';
import { RunFilters } from './RunFilters';
import { RunList } from './RunList';

/** `/app/runs`: every run across brands (F-17). */
export function RunsPage() {
  const [filter, setFilter] = useState<RunsFilter>({});
  return (
    <>
      <PageHeader title="All Reports" description="View and manage your visibility reports" />
      <RunFilters filter={filter} onChange={setFilter} showBrand />
      <RunList
        filter={filter}
        showBrand
        emptyAction={
          <Link to="/app/brands" className={buttonClass('primary')}>
            <Plus className="w-4 h-4" aria-hidden />
            Run your first analysis
          </Link>
        }
      />
    </>
  );
}
