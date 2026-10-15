import type { Platform } from '@pv/shared';
import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts';
import { tooltipStyle } from '../../components/charts/VisibilityBarChart';
import { Card } from '../../components/ui/PageHeader';
import { PLATFORM_COLORS, PLATFORM_SHORT } from '../../components/ui/PlatformIcon';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { useTrend } from '../../lib/api/insights';
import { RangeSelect } from './FilterSelects';
import { DEFAULT_RANGE_DAYS, rangeFrom, type RangeDays } from './range';
import { buildTrendSeries, platformKey, type TrendDatum } from './trend';

const TOTAL_COLOR = '#8B5CF6';
const CHANGED_COLOR = '#F59E0B';

function TotalDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: TrendDatum }) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  return payload.changed ? (
    <path
      d={`M${cx},${cy - 7} L${cx + 7},${cy} L${cx},${cy + 7} L${cx - 7},${cy} Z`}
      fill={CHANGED_COLOR}
      stroke="#fff"
      strokeWidth={1}
    />
  ) : (
    <circle cx={cx} cy={cy} r={4} fill={TOTAL_COLOR} />
  );
}

/** Visibility over time (F-20): total, plus one line per platform when not filtered. */
export function TrendCard({ brandId, platform }: { brandId: string; platform: Platform | null }) {
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE_DAYS);
  const from = rangeFrom(days);
  const trend = useTrend(brandId, { from, ...(platform ? { platform } : {}) });

  const series = useMemo(
    () => buildTrendSeries(trend.data?.points ?? [], platform === null),
    [trend.data, platform],
  );
  const labelOf = useMemo(() => new Map(series.data.map((d) => [d.runId, d.label])), [series.data]);
  const latest = series.data.at(-1);

  return (
    <Card
      title="Visibility Trend"
      actions={<RangeSelect value={days} onChange={setDays} />}
      className="mb-6"
    >
      {trend.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="sm" label="Loading trend data…" />
        </div>
      ) : trend.isError ? (
        <ErrorState error={trend.error} onRetry={() => void trend.refetch()} />
      ) : series.data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
          <TrendingUp className="w-12 h-12 text-gray-400 mb-3" aria-hidden />
          <p>Not enough data to show a trend</p>
          <p className="text-xs mt-1">No finished runs in the selected range.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Latest {platform ? PLATFORM_SHORT[platform] : 'total'} visibility
              </div>
              <span className="text-2xl sm:text-3xl font-bold text-action-600 dark:text-action-400">
                {latest ? `${latest.total}%` : '—'}
              </span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {latest?.totalFraction}
              </span>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Runs analyzed</div>
              <span className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                {series.data.length}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
              <XAxis
                dataKey="runId"
                stroke="#9CA3AF"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickFormatter={(id: string) => labelOf.get(id) ?? ''}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                domain={[0, 100]}
                unit="%"
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(id) => (typeof id === 'string' ? (labelOf.get(id) ?? '') : '')}
                formatter={(value) => `${String(value)}%`}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} iconSize={10} />
              {series.changedRunIds.map((id) => (
                <ReferenceLine key={id} x={id} stroke={CHANGED_COLOR} strokeDasharray="4 4" />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                name={platform ? PLATFORM_SHORT[platform] : 'Total'}
                stroke={TOTAL_COLOR}
                strokeWidth={3}
                dot={(props: DotItemDotProps) => (
                  <TotalDot
                    key={props.index}
                    {...(props.cx !== undefined ? { cx: Number(props.cx) } : {})}
                    {...(props.cy !== undefined ? { cy: Number(props.cy) } : {})}
                    payload={props.payload as TrendDatum}
                  />
                )}
                isAnimationActive={false}
              />
              {series.platforms.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={platformKey(p)}
                  name={PLATFORM_SHORT[p]}
                  stroke={PLATFORM_COLORS[p]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: PLATFORM_COLORS[p] }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <ChangedLegend count={series.changedRunIds.length} />
        </>
      )}
    </Card>
  );
}

export function ChangedLegend({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
        <path d="M7,0 L14,7 L7,14 L0,7 Z" fill={CHANGED_COLOR} />
      </svg>
      Prompt set or platforms changed ({count} {count === 1 ? 'run' : 'runs'}): not directly
      comparable with the run before.
    </p>
  );
}
