import { healthResponseSchema, readyResponseSchema } from '@pv/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import { queryKeys } from './queryKeys';

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiFetch('/health', { schema: healthResponseSchema, signal }),
  });
}

export function useReady() {
  return useQuery({
    queryKey: queryKeys.ready,
    queryFn: ({ signal }) => apiFetch('/ready', { schema: readyResponseSchema, signal }),
  });
}
