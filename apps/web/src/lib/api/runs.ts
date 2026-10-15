import {
  checkResultPageSchema,
  isFinalRunStatus,
  runEstimateSchema,
  runListResponseSchema,
  runSchema,
  type CreateRunBody,
  type EstimateRunBody,
  type Run,
} from '@pv/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { emit } from '../events';
import { apiFetch } from './client';
import { newIdempotencyKey, toQuery } from './query';
import { queryKeys, type ResultsFilter, type RunsFilter } from './queryKeys';

/** How often a run that isn't final is re-fetched (09: `refetchInterval: 2000`). */
export const LIVE_POLL_MS = 2000;

export function useRunEstimate(body: EstimateRunBody | null) {
  return useQuery({
    queryKey: ['runEstimate', body] as const,
    queryFn: ({ signal }) =>
      apiFetch('/runs/estimate', { method: 'POST', body, schema: runEstimateSchema, signal }),
    enabled: body !== null && body.promptIds.length > 0 && body.platforms.length > 0,
    staleTime: 5_000,
  });
}

export type CreateRunInput = Omit<CreateRunBody, 'city'> & { city?: string | null };

/**
 * `POST /runs` with a fresh `Idempotency-Key` per call. Creating a run spends credits, so `me`
 * and the run lists are invalidated, and `runCreated` fires for the promo popup (F-33).
 */
export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRunInput) =>
      apiFetch('/runs', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        schema: runSchema,
      }),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.run(run.id), run);
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
      emit('runCreated', { runId: run.id });
    },
  });
}

/** Cursor-paginated run list; refreshes while any listed run is still going. */
export function useRuns(filter: RunsFilter = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.runList(filter),
    queryFn: ({ signal, pageParam }) =>
      apiFetch(`/runs${toQuery({ ...filter, cursor: pageParam })}`, {
        schema: runListResponseSchema,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some((r) => !isFinalRunStatus(r.status)))
        ? LIVE_POLL_MS * 2
        : false,
  });
}

/** One run; polls every 2 s until it reaches a final status (09). */
export function useRun(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.run(id ?? ''),
    queryFn: async ({ signal }) => {
      const prev = qc.getQueryData<Run>(queryKeys.run(id ?? ''));
      const run = await apiFetch(`/runs/${id}`, { schema: runSchema, signal });
      if (prev && !isFinalRunStatus(prev.status) && isFinalRunStatus(run.status)) {
        // Refunds land at finalize; the brand's insights change too, and the result rows cached
        // during the live view are stale.
        void qc.invalidateQueries({ queryKey: queryKeys.runResultsAll(run.id) });
        void qc.invalidateQueries({ queryKey: queryKeys.me });
        void qc.invalidateQueries({ queryKey: queryKeys.runs });
        void qc.invalidateQueries({ queryKey: queryKeys.insights(run.brandId) });
        void qc.invalidateQueries({ queryKey: queryKeys.brands });
      }
      return run;
    },
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && !isFinalRunStatus(query.state.data.status) ? LIVE_POLL_MS : false,
  });
}

/** Results with server-side filters (09: filters are `/runs/:id/results` query params). */
export function useRunResults(id: string | undefined, filter: ResultsFilter = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.runResults(id ?? '', filter),
    queryFn: ({ signal, pageParam }) =>
      apiFetch(`/runs/${id}/results${toQuery({ ...filter, cursor: pageParam, limit: 200 })}`, {
        schema: checkResultPageSchema,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(id) && enabled,
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/runs/${id}/cancel`, { method: 'POST', schema: runSchema }),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.run(run.id), run);
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/runs/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.run(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
      void qc.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

/** Same-origin download URL for the XLSX export (the browser sends the cookies). */
export const runExportUrl = (id: string): string => `/api/runs/${id}/export.xlsx`;
