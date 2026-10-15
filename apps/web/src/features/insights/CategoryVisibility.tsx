import { VisibilityBarChart } from '../../components/charts/VisibilityBarChart';
import { Card } from '../../components/ui/PageHeader';
import { ratioChartValue, ratioFraction, ratioPct } from '../../lib/format';
import type { Aggregates } from './PlatformScores';

/** Visibility per prompt category in the latest run; the category filter limits the bars. */
export function CategoryVisibility({
  byCategory,
  category,
}: {
  byCategory: Aggregates['byCategory'];
  category: string | null;
}) {
  const entries = Object.entries(byCategory).filter(([name]) => !category || name === category);
  const data = entries.map(([name, agg]) => ({
    name,
    visibility: ratioChartValue(agg.visibility),
    fraction: ratioFraction(agg.visibility),
  }));
  return (
    <Card title="Category Visibility">
      <VisibilityBarChart data={data} height={280} wrapLabels emptyText="No category data" />
      {entries.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {entries.map(([name, agg]) => (
            <li key={name} className="flex justify-between gap-2">
              <span className="truncate">{name}</span>
              <span className="whitespace-nowrap">
                {ratioPct(agg.visibility)} visible · {ratioPct(agg.citationRate)} cited
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
