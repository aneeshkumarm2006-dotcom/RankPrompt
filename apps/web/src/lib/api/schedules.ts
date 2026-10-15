import {
  runSchema,
  scheduleListResponseSchema,
  scheduleSchema,
  type createScheduleBodySchema,
  type patchScheduleBodySchema,
} from '@pv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { emit } from '../events';
import { apiFetch } from './client';
import { newIdempotencyKey } from './query';
import { queryKeys } from './queryKeys';

/** Schedules (08 § Schedules). */
export function useSchedules(brandId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.schedules(brandId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch(`/brands/${brandId}/schedules`, { schema: scheduleListResponseSchema, signal }),
    enabled: Boolean(brandId),
  });
}

function useScheduleMutation<V>(brandId: string, call: (vars: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedules(brandId) });
      void qc.invalidateQueries({ queryKey: queryKeys.overview(brandId) });
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useCreateSchedule(brandId: string) {
  return useScheduleMutation(brandId, (body: z.input<typeof createScheduleBodySchema>) =>
    apiFetch('/schedules', { method: 'POST', body, schema: scheduleSchema }),
  );
}

export function useUpdateSchedule(brandId: string) {
  return useScheduleMutation(
    brandId,
    ({ id, ...body }: z.input<typeof patchScheduleBodySchema> & { id: string }) =>
      apiFetch(`/schedules/${id}`, { method: 'PATCH', body, schema: scheduleSchema }),
  );
}

export function usePauseSchedule(brandId: string) {
  return useScheduleMutation(brandId, (id: string) =>
    apiFetch(`/schedules/${id}/pause`, { method: 'POST', schema: scheduleSchema }),
  );
}

export function useResumeSchedule(brandId: string) {
  return useScheduleMutation(brandId, (id: string) =>
    apiFetch(`/schedules/${id}/resume`, { method: 'POST', schema: scheduleSchema }),
  );
}

export function useDeleteSchedule(brandId: string) {
  return useScheduleMutation(brandId, (id: string) =>
    apiFetch(`/schedules/${id}`, { method: 'DELETE', schema: z.undefined() }),
  );
}

/** Runs the schedule now; same as `POST /runs` with the schedule's config. */
export function useRunScheduleNow(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/schedules/${id}/run-now`, {
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        schema: runSchema,
      }),
    onSuccess: (run) => {
      qc.setQueryData(queryKeys.run(run.id), run);
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: queryKeys.runs });
      void qc.invalidateQueries({ queryKey: queryKeys.schedules(brandId) });
      emit('runCreated', { runId: run.id });
    },
  });
}
