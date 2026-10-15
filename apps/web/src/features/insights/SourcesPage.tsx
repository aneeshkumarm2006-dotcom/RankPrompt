import { PLATFORMS, type Platform, type SourcesResponse } from '@pv/shared';
import { Globe, Link2, Star } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { tooltipStyle } from '../../components/charts/VisibilityBarChart';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { MetricTile } from '../../components/ui/MetricTile';
import { Card, PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useSources } from '../../lib/api/insights';
import { number, pct } from '../../lib/format';
import { FilterBar, PlatformSelect, RangeSelect } from './FilterSelects';
import { DEFAULT_RANGE_DAYS, rangeFrom, type RangeDays } from './range';
import { SourcesTable } from './SourcesTable';

const TOP = 10;

function TopDomainsChart({ domains }: { domains: SourcesResponse['domains'] }) {
  const data = domains.slice(0, TOP).map((d) => ({
    name: d.domain,
    count: d.count,
    isBrand: d.isBrand,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
        <XAxis type="number" allowDecimals={false} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          stroke="#9CA3AF"
          tick={{ fontSize: 11 }}
        />
        <Tooltip {...tooltipStyle} formatter={(value) => [String(value), 'Citations']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.isBrand ? '#8B5CF6' : '#06B6D4'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Citations & Sources (F-24; v1 CitationsAndSources): every domain the AIs cited. */
export function SourcesPage() {
  const brand = useBrandOutlet();
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE_DAYS);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const sources = useSources(brand.id, {
    from: rangeFrom(days),
    ...(platform ? { platform } : {}),
  });

  const own = sources.data?.domains.find((d) => d.isBrand);

  return (
    <>
      <PageHeader
        title="Citations & Sources"
        description="The websites AI platforms cite when they answer your prompts"
      />
      <FilterBar>
        <RangeSelect value={days} onChange={setDays} />
        <PlatformSelect value={platform} platforms={PLATFORMS} onChange={setPlatform} />
      </FilterBar>
      {sources.isPending ? (
        <PageSpinner />
      ) : sources.isError ? (
        <ErrorState error={sources.error} onRetry={() => void sources.refetch()} />
      ) : sources.data.totalCitations === 0 ? (
        <EmptyState
          icon={Link2}
          title="No citations yet"
          message="No AI answer cited a source in this range. Try a longer range or another platform."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricTile
              label="Total citations"
              icon={Link2}
              value={number(sources.data.totalCitations)}
            />
            <MetricTile
              label="Cited domains"
              icon={Globe}
              accent="blue"
              value={number(sources.data.domains.length)}
              hint={sources.data.domains.length >= 100 ? 'Top 100 shown' : undefined}
            />
            <MetricTile
              label={`Citations of ${brand.domain}`}
              icon={Star}
              accent="green"
              value={own ? number(own.count) : '0'}
              hint={own ? `${pct(own.share, 1)} of all citations` : 'Your site was not cited'}
            />
          </div>
          <Card title={`Top ${TOP} Domains`} className="mb-6">
            <TopDomainsChart domains={sources.data.domains} />
          </Card>
          <Card title="All Cited Domains">
            <SourcesTable domains={sources.data.domains} />
          </Card>
        </>
      )}
    </>
  );
}
