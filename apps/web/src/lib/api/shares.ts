import { createdShareSchema, publicReportSchema, shareListResponseSchema } from '@pv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './client';
import { queryKeys } from './queryKeys';

export function useShares(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shares(runId ?? ''),
    queryFn: ({ signal }) =>
      apiFetch(`/runs/${runId}/shares`, { schema: shareListResponseSchema, signal }),
    enabled: Boolean(runId) && enabled,
  });
}

/** The response holds the only copy of the link's token (08). */
export function useCreateShare(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expiresInDays?: number) =>
      apiFetch(`/runs/${runId}/shares`, {
        method: 'POST',
        body: expiresInDays ? { expiresInDays } : {},
        schema: createdShareSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shares(runId) }),
  });
}

export function useRevokeShare(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) =>
      apiFetch(`/shares/${shareId}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shares(runId) }),
  });
}

/** Public, no session: `GET /public/shares/:token`. */
export function usePublicReport(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicShare(token ?? ''),
    queryFn: ({ signal }) =>
      apiFetch(`/public/shares/${token}`, { schema: publicReportSchema, signal }),
    enabled: Boolean(token),
  });
}
