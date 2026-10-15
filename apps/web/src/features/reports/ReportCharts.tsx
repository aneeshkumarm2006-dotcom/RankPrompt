import type { Platform } from '@pv/shared';
import type { ReactNode } from 'react';
import { PLATFORM_COLORS, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import {
  VisibilityBarChart,
  type VisibilityBarDatum,
} from '../../components/charts/VisibilityBarChart';
import { ratioChartValue, ratioFraction, ratioPct } from '../../lib/format';
import type { ReportAggregates } from './viewModel';

/** Chart rows per platform, in the run's platform order (server ratios only). */
export function platformChartData(
  aggregates: ReportAggregates | null,
  platforms: Platform[],
): VisibilityBarDatum[] {
  if (!aggregates) return [];
  return platforms.flatMap((p) => {
    const row = aggregates.byPlatform[p];
    if (!row) return [];
    return [
      {
        name: PLATFORM_SHORT[p],
        visibility: ratioChartValue(row.visibility),
        fraction: ratioFraction(row.visibility),
        color: PLATFORM_COLORS[p],
      },
    ];
  });
}

/** Chart rows per category, best first. */
export function categoryChartData(aggregates: ReportAggregates | null): VisibilityBarDatum[] {
  if (!aggregates) return [];
  return Object.entries(aggregates.byCategory)
    .map(([name, row]) => ({
      name,
      visibility: ratioChartValue(row.visibility),
      fraction: ratioFraction(row.visibility),
    }))
    .sort((a, b) => b.visibility - a.visibility);
}

function ChartCard({
  title,
  footer,
  children,
}: {
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-dark-900 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-dark-700">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-4">
        {title}
      </h2>
      {children}
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{footer}</div>
    </section>
  );
}

/** v1 "Visibility Score by Platform" and "Category Visibility Trends" side by side. */
export function ReportCharts({
  aggregates,
  platforms,
}: {
  aggregates: ReportAggregates | null;
  platforms: Platform[];
}) {
  const byPlatform = platformChartData(aggregates, platforms);
  const byCategory = categoryChartData(aggregates);
  const top = byCategory[0];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <ChartCard
        title="Visibility by platform"
        footer={
          <p>
            Overall visibility:{' '}
            <span className="text-gray-800 dark:text-white font-bold">
              {ratioPct(aggregates?.total.visibility)}
            </span>{' '}
            ({ratioFraction(aggregates?.total.visibility)} answered checks)
          </p>
        }
      >
        <VisibilityBarChart data={byPlatform} emptyText="No platform data available" />
      </ChartCard>
      <ChartCard
        title="Visibility by category"
        footer={
          <p>
            Top category:{' '}
            <span className="text-gray-800 dark:text-white font-bold">
              {top ? `${top.name} (${top.visibility}%)` : '—'}
            </span>
          </p>
        }
      >
        <VisibilityBarChart
          data={byCategory}
          color="#10B981"
          wrapLabels
          emptyText="No category data available"
        />
      </ChartCard>
    </div>
  );
}
