import type { ListResultsQuery, ListRunsQuery, Platform } from '@pv/shared';

/** Optional insight filters, as they appear in query keys and URLs. */
export interface RangeFilter {
  from?: string | undefined;
  to?: string | undefined;
  platform?: Platform | undefined;
}

export type RunsFilter = Partial<Pick<ListRunsQuery, 'brandId' | 'status' | 'trigger'>>;
export type ResultsFilter = Partial<
  Pick<ListResultsQuery, 'platform' | 'category' | 'status' | 'mentioned'>
>;

/** Every TanStack Query key in the app, defined in one place (09 § Data layer). */
export const queryKeys = {
  health: ['health'] as const,
  ready: ['ready'] as const,
  me: ['me'] as const,
  plans: ['plans'] as const,
  meta: ['meta'] as const,

  brands: ['brands'] as const,
  brand: (id: string) => ['brand', id] as const,
  prompts: (brandId: string, includeArchived = false) =>
    ['prompts', brandId, { includeArchived }] as const,
  promptsAll: (brandId: string) => ['prompts', brandId] as const,

  runs: ['runs'] as const,
  runList: (filter: RunsFilter) => ['runs', 'list', filter] as const,
  run: (id: string) => ['run', id] as const,
  runResultsAll: (id: string) => ['run', id, 'results'] as const,
  runResults: (id: string, filter: ResultsFilter) => ['run', id, 'results', filter] as const,
  shares: (runId: string) => ['run', runId, 'shares'] as const,
  publicShare: (token: string) => ['publicShare', token] as const,

  insights: (brandId: string) => ['insights', brandId] as const,
  overview: (brandId: string) => ['insights', brandId, 'overview'] as const,
  trend: (brandId: string, filter: RangeFilter) => ['insights', brandId, 'trend', filter] as const,
  competitors: (brandId: string, runId?: string) =>
    ['insights', brandId, 'competitors', runId ?? 'latest'] as const,
  sources: (brandId: string, filter: RangeFilter) =>
    ['insights', brandId, 'sources', filter] as const,
  promptHistory: (brandId: string, filter: RangeFilter) =>
    ['insights', brandId, 'prompts', filter] as const,

  schedules: (brandId: string) => ['schedules', brandId] as const,
  subscription: ['billing', 'subscription'] as const,
  ledger: ['credits', 'ledger'] as const,
  referrals: ['referrals'] as const,
  survey: ['survey'] as const,
};
