import type { Brand, PromptSource } from '@pv/shared';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useBrand } from '../../../lib/api/brands';
import { usePrompts } from '../../../lib/api/prompts';

export type WizardStep = 1 | 2 | 3 | 4;

export const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: 'Brand details' },
  { step: 2, label: 'Categories' },
  { step: 3, label: 'Prompts' },
  { step: 4, label: 'Run analysis' },
];

/** A prompt being reviewed in step 3; nothing is saved until the user saves the list. */
export interface Draft {
  key: string;
  text: string;
  category: string;
  source: PromptSource;
}

let draftSeq = 0;
export const draftKey = (): string => `draft-${++draftSeq}`;

/**
 * Where `/app/brands/new` opens (F-10): no brand → step 1; a brand without prompts → step 2
 * (generate); a brand with prompts → step 3 (review, then "Continue to run setup").
 */
export function resumeStep(brandId: string | null, activePromptCount: number): WizardStep {
  if (!brandId) return 1;
  return activePromptCount > 0 ? 3 : 2;
}

/** Keeps a requested step within what the brand's state allows. */
export function clampStep(
  requested: WizardStep,
  brandId: string | null,
  activePromptCount: number,
  draftCount: number,
): WizardStep {
  if (!brandId) return 1;
  if (requested === 1) return 2; // The brand exists; it's edited in settings now.
  if (requested === 4 && activePromptCount === 0) return draftCount > 0 ? 3 : 2;
  return requested;
}

/**
 * Wizard state (09 § Wizard). The brand id lives in the URL (`?brandId=`), so a reload resumes;
 * the brand and its prompts are loaded from the server, so leaving midway loses nothing saved.
 */
export function useWizard() {
  const [params, setParams] = useSearchParams();
  const brandId = params.get('brandId');
  const brandQuery = useBrand(brandId ?? undefined);
  const promptsQuery = usePrompts(brandId ?? undefined);

  const [requested, setRequested] = useState<WizardStep | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const prompts = promptsQuery.data ?? [];
  const isLoading = Boolean(brandId) && (brandQuery.isPending || promptsQuery.isPending);
  const error = brandQuery.error ?? promptsQuery.error;

  const step: WizardStep = isLoading
    ? resumeStep(brandId, 0)
    : requested === null
      ? resumeStep(brandId, prompts.length)
      : clampStep(requested, brandId, prompts.length, drafts.length);

  const goTo = useCallback((next: WizardStep) => {
    setRequested(next);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, []);

  /** Step 1 done: put the id in the URL (replace) so a reload resumes at step 2. */
  const onBrandCreated = useCallback(
    (brand: Brand) => {
      setParams({ brandId: brand.id }, { replace: true });
      setDrafts([]);
      goTo(2);
    },
    [setParams, goTo],
  );

  return {
    brandId,
    brand: brandQuery.data,
    prompts,
    step,
    isLoading,
    error,
    drafts,
    setDrafts,
    goTo,
    onBrandCreated,
    refetchPrompts: promptsQuery.refetch,
  };
}

export type Wizard = ReturnType<typeof useWizard>;
