import {
  generatePromptsResponseSchema,
  promptListResponseSchema,
  promptSchema,
  type generatePromptsBodySchema,
  type PatchPromptBody,
  type PromptSource,
} from '@pv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './client';
import { toQuery } from './query';
import { queryKeys } from './queryKeys';

export function usePrompts(brandId: string | undefined, includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.prompts(brandId ?? '', includeArchived),
    queryFn: ({ signal }) =>
      apiFetch(`/brands/${brandId}/prompts${toQuery({ includeArchived })}`, {
        schema: promptListResponseSchema,
        signal,
      }),
    enabled: Boolean(brandId),
  });
}

/** Drafts only: nothing is saved until `useAddPrompts` (08). */
export function useGeneratePrompts(brandId: string) {
  return useMutation({
    mutationFn: (body: z.input<typeof generatePromptsBodySchema>) =>
      apiFetch(`/brands/${brandId}/prompts/generate`, {
        method: 'POST',
        body,
        schema: generatePromptsResponseSchema,
      }),
  });
}

function useInvalidatePrompts(brandId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.promptsAll(brandId) });
    void qc.invalidateQueries({ queryKey: queryKeys.brands }); // promptCount
    void qc.invalidateQueries({ queryKey: queryKeys.schedules(brandId) }); // creditsPerRun
  };
}

export function useAddPrompts(brandId: string) {
  const invalidate = useInvalidatePrompts(brandId);
  return useMutation({
    mutationFn: (prompts: { text: string; category: string; source?: PromptSource }[]) =>
      apiFetch(`/brands/${brandId}/prompts`, {
        method: 'POST',
        body: { prompts },
        schema: promptListResponseSchema,
      }),
    onSuccess: invalidate,
  });
}

/** A text change returns a new prompt (the old one is archived, D-014). */
export function useEditPrompt(brandId: string) {
  const invalidate = useInvalidatePrompts(brandId);
  return useMutation({
    mutationFn: ({ id, ...body }: PatchPromptBody & { id: string }) =>
      apiFetch(`/prompts/${id}`, { method: 'PATCH', body, schema: promptSchema }),
    onSuccess: invalidate,
  });
}

export function useArchivePrompt(brandId: string) {
  const invalidate = useInvalidatePrompts(brandId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/prompts/${id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: invalidate,
  });
}
