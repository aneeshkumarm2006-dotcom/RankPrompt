import type { BrandListItem } from '@pv/shared';
import { Building2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { inputClass } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { useBrands } from '../../lib/api/brands';
import { ArchiveBrandDialog } from './ArchiveBrandDialog';
import { BrandCard } from './BrandCard';
import { BrandLimitBanner, isBrandLimitReached } from './BrandLimitBanner';
import { BRAND_SORTS, filterAndSortBrands, type BrandSort } from './brandList';

/** `/app/brands`: the v1 MyBrands page (F-18, F-36). Archived brands aren't listed. */
export function BrandsPage() {
  const brands = useBrands();
  const { data: me } = useMe();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BrandSort>('newest');
  const [archiving, setArchiving] = useState<BrandListItem | null>(null);

  const visible = useMemo(
    () => filterAndSortBrands(brands.data ?? [], query, sort),
    [brands.data, query, sort],
  );
  const full = isBrandLimitReached(me);

  const addButton = full ? (
    <Button icon={<Plus className="w-5 h-5" />} disabled title="Brand limit reached">
      Add brand
    </Button>
  ) : (
    <Link to="/app/brands/new" className={buttonClass('primary')}>
      <Plus className="w-5 h-5" aria-hidden />
      Add brand
    </Link>
  );

  if (brands.isPending) return <PageSpinner label="Loading brands…" />;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="My Brands"
        description="Manage your brands and their AI visibility reports"
        actions={addButton}
      />

      {me && <BrandLimitBanner me={me} />}

      {brands.isError ? (
        <ErrorState
          error={brands.error}
          title="Could not load your brands"
          onRetry={() => void brands.refetch()}
        />
      ) : brands.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brands yet"
          message="Create your first brand to start tracking its visibility in AI assistants."
          action={full ? undefined : addButton}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
              <input
                type="search"
                aria-label="Search brands"
                placeholder="Search by brand name or website…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClass} pl-10 py-2.5`}
              />
            </div>
            <select
              aria-label="Sort brands"
              value={sort}
              onChange={(e) => setSort(e.target.value as BrandSort)}
              className={`${inputClass} sm:w-48 py-2.5`}
            >
              {BRAND_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="text-center py-12 text-gray-500 dark:text-gray-400">
              No brands match “{query}”.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((b) => (
                <BrandCard key={b.id} brand={b} onArchive={setArchiving} />
              ))}
            </div>
          )}
        </>
      )}

      <ArchiveBrandDialog brand={archiving} onClose={() => setArchiving(null)} />
    </div>
  );
}
