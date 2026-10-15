import { metaResponseSchema, plansResponseSchema } from '@pv/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { queryKeys } from './queryKeys';

/** Plans, top-ups and grants (`GET /plans`). The app never hardcodes prices (06). */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: ({ signal }) => apiFetch('/plans', { schema: plansResponseSchema, signal }),
    staleTime: Infinity,
  });
}

/** Countries, languages and platform labels for forms (`GET /meta`). */
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: ({ signal }) => apiFetch('/meta', { schema: metaResponseSchema, signal }),
    staleTime: Infinity,
  });
}
