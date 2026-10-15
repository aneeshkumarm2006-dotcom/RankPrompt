import type { Platform, Run } from '@pv/shared';
import { VisibilityBarChart } from '../../components/charts/VisibilityBarChart';
import { Card } from '../../components/ui/PageHeader';
import { PLATFORM_COLORS, PLATFORM_SHORT, PlatformLabel } from '../../components/ui/PlatformIcon';
import { rank, ratioChartValue, ratioFraction, ratioPct } from '../../lib/format';
import { orderedPlatforms } from './range';

export type Aggregates = NonNullable<Run['aggregates']>;

/** Per-platform scores of the latest run; the platform filter limits the rows. */
export function PlatformScores({
  byPlatform,
  platform,
}: {
  byPlatform: Aggregates['byPlatform'];
  platform: Platform | null;
}) {
  const platforms = orderedPlatforms(Object.keys(byPlatform)).filter(
    (p) => platform === null || p === platform,
  );
  const rows = platforms.flatMap((p) => {
    const agg = byPlatform[p];
    return agg ? [{ platform: p, agg }] : [];
  });
  const data = rows.map(({ platform: p, agg }) => ({
    name: PLATFORM_SHORT[p],
    visibility: ratioChartValue(agg.visibility),
    fraction: ratioFraction(agg.visibility),
    color: PLATFORM_COLORS[p],
  }));

  return (
    <Card title="Platform Scores">
      <VisibilityBarChart
        data={data}
        height={240}
        emptyText="This platform wasn't in the latest run"
      />
      {rows.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-dark-900">
              <tr>
                {['Platform', 'Visibility', 'Citation rate', 'Top-3', 'Avg rank'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {rows.map(({ platform: p, agg }) => (
                <tr key={p}>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    <PlatformLabel platform={p} short />
                  </td>
                  <RatioCell ratio={agg.visibility} />
                  <RatioCell ratio={agg.citationRate} />
                  <RatioCell ratio={agg.top3Rate} />
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {rank(agg.avgRank.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function RatioCell({ ratio }: { ratio: { num: number; den: number; rate: number | null } }) {
  return (
    <td className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
      <span className="font-medium">{ratioPct(ratio)}</span>{' '}
      <span className="text-xs text-gray-500 dark:text-gray-400">{ratioFraction(ratio)}</span>
    </td>
  );
}
