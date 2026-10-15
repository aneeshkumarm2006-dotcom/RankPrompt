import type { Platform, RunTrigger, TrendPoint } from '@pv/shared';
import { formatShortDate, ratioChartValue, ratioFraction } from '../../lib/format';
import { orderedPlatforms } from './range';

export type PlatformKey = `p_${Platform}`;
export const platformKey = (p: Platform): PlatformKey => `p_${p}`;

export type TrendDatum = {
  runId: string;
  label: string;
  trigger: RunTrigger;
  /** 0–100 chart value of the server's total (or `?platform`) visibility. */
  total: number;
  totalFraction: string;
  /** The prompt set or platform list changed since the previous point. */
  changed: boolean;
} & Partial<Record<PlatformKey, number>>;

export interface TrendSeries {
  data: TrendDatum[];
  /** Platforms that get their own line (empty when filtered to one platform). */
  platforms: Platform[];
  /** Points drawn with a "not comparable" marker. */
  changedRunIds: string[];
}

/**
 * Trend points → chart rows. Only reshapes server numbers (05): every value is the server's
 * ratio turned into a 0–100 chart value. The first point never gets a marker (nothing before it).
 */
export function buildTrendSeries(points: TrendPoint[], perPlatform: boolean): TrendSeries {
  const platforms = perPlatform
    ? orderedPlatforms(points.flatMap((p) => Object.keys(p.byPlatform)))
    : [];
  const data = points.map((point, index): TrendDatum => {
    const row: TrendDatum = {
      runId: point.runId,
      label: formatShortDate(point.date),
      trigger: point.trigger,
      total: ratioChartValue(point.visibility),
      totalFraction: ratioFraction(point.visibility),
      changed: index > 0 && !point.comparableWithPrevious,
    };
    for (const p of platforms) {
      const ratio = point.byPlatform[p];
      if (ratio) row[platformKey(p)] = ratioChartValue(ratio);
    }
    return row;
  });
  return { data, platforms, changedRunIds: data.filter((d) => d.changed).map((d) => d.runId) };
}
