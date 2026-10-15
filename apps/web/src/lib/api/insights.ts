import {
  competitorInsightsSchema,
  insightsOverviewSchema,
  promptHistoryResponseSchema,
  sourcesResponseSchema,
  trendResponseSchema,
} from '@pv/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { toQuery } from './query';
import { queryKeys, type RangeFilter } from './queryKeys';

const base = (brandId: string | undefined) => `/brands/${brandId}/insights`;

export function useOverview(brandId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.overview(brandId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch(`${base(brandId)}/overview`, { schema: insightsOverviewSchema, signal }),
    enabled: Boolean(brandId),
  });
}

export function useTrend(brandId: string | undefined, filter: RangeFilter = {}) {
  return useQuery({
    queryKey: queryKeys.trend(brandId ?? '', filter),
    queryFn: ({ signal }) =>
      apiFetch(`${base(brandId)}/trend${toQuery({ ...filter })}`, {
        schema: trendResponseSchema,
        signal,
      }),
    enabled: Boolean(brandId),
  });
}

export function useCompetitorInsights(brandId: string | undefined, runId?: string) {
  return useQuery({
    queryKey: queryKeys.competitors(brandId ?? '', runId),
    queryFn: ({ signal }) =>
      apiFetch(`${base(brandId)}/competitors${toQuery({ runId })}`, {
        schema: competitorInsightsSchema,
        signal,
      }),
    enabled: Boolean(brandId),
  });
}

export function useSources(brandId: string | undefined, filter: RangeFilter = {}) {
  return useQuery({
    queryKey: queryKeys.sources(brandId ?? '', filter),
    queryFn: ({ signal }) =>
      apiFetch(`${base(brandId)}/sources${toQuery({ ...filter })}`, {
        schema: sourcesResponseSchema,
        signal,
      }),
    enabled: Boolean(brandId),
  });
}

export function usePromptHistory(brandId: string | undefined, filter: RangeFilter = {}) {
  return useQuery({
    queryKey: queryKeys.promptHistory(brandId ?? '', filter),
    queryFn: ({ signal }) =>
      apiFetch(`${base(brandId)}/prompts${toQuery({ from: filter.from, to: filter.to })}`, {
        schema: promptHistoryResponseSchema,
        signal,
      }),
    enabled: Boolean(brandId),
  });
}
