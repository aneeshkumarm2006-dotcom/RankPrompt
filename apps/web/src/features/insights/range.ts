import { PLATFORMS, type Platform } from '@pv/shared';

/** Date range choices for insights (the server default is 90 days). */
export const RANGE_OPTIONS = [30, 90, 180, 365] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
export const DEFAULT_RANGE_DAYS: RangeDays = 90;

/**
 * ISO start of the UTC day `days` ago. Rounded to the day so the query key stays the same across
 * re-renders (a new `from` every render would refetch forever).
 */
export function rangeFrom(days: number, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export const isRangeDays = (n: number): n is RangeDays =>
  (RANGE_OPTIONS as readonly number[]).includes(n);

export const isPlatform = (value: string): value is Platform =>
  (PLATFORMS as readonly string[]).includes(value);

/** Platforms in the canonical order, keeping only the ones present in `present`. */
export const orderedPlatforms = (present: Iterable<string>): Platform[] => {
  const set = new Set(present);
  return PLATFORMS.filter((p) => set.has(p));
};
