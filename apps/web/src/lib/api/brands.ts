import {
  analyzeBrandResponseSchema,
  brandListResponseSchema,
  brandSchema,
  type AnalyzeBrandBody,
  type CompetitorInput,
  type createBrandBodySchema,
  type PatchBrandBody,
} from '@pv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './client';
import { queryKeys } from './queryKeys';

export function useBrands() {
  return useQuery({
    queryKey: queryKeys.brands,
    queryFn: ({ signal }) => apiFetch('/brands', { schema: brandListResponseSchema, signal }),
  });
}

export function useBrand(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brand(id ?? ''),
    queryFn: ({ signal }) => apiFetch(`/brands/${id}`, { schema: brandSchema, signal }),
    enabled: Boolean(id),
  });
}

/** `POST /brands/analyze`: summary, categories and aliases for the wizard (not saved). */
export function useAnalyzeBrand() {
  return useMutation({
    mutationFn: (body: AnalyzeBrandBody) =>
      apiFetch('/brands/analyze', {
        method: 'POST',
        body,
        schema: analyzeBrandResponseSchema,
      }),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof createBrandBodySchema>) =>
      apiFetch('/brands', { method: 'POST', body, schema: brandSchema }),
    onSuccess: (brand) => {
      qc.setQueryData(queryKeys.brand(brand.id), brand);
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
      void qc.invalidateQueries({ queryKey: queryKeys.me }); // brandsUsed
    },
  });
}

export function useUpdateBrand(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchBrandBody) =>
      apiFetch(`/brands/${id}`, { method: 'PATCH', body, schema: brandSchema }),
    onSuccess: (brand) => {
      qc.setQueryData(queryKeys.brand(id), brand);
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useUpdateCompetitors(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitors: CompetitorInput[]) =>
      apiFetch(`/brands/${id}/competitors`, {
        method: 'PUT',
        body: { competitors },
        schema: brandSchema,
      }),
    onSuccess: (brand) => {
      qc.setQueryData(queryKeys.brand(id), brand);
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
      void qc.invalidateQueries({ queryKey: queryKeys.insights(id) });
    },
  });
}

/** Archives the brand and pauses its schedules; runs are kept (08). */
export function useArchiveBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brands/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.brands });
      void qc.invalidateQueries({ queryKey: queryKeys.brand(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.schedules(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
