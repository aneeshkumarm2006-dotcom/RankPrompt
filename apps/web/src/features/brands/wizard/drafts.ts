import type { Brand } from '@pv/shared';
import { normText } from '../brandForm';
import type { Draft } from './useWizard';

export const FALLBACK_CATEGORY = 'General';

/** Category choices for drafts: the brand's categories plus any a draft already uses. */
export function draftCategoryOptions(brand: Pick<Brand, 'categories'>, drafts: readonly Draft[]) {
  const out: string[] = [];
  const add = (name: string) => {
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  brand.categories.forEach((c) => add(c.name));
  drafts.forEach((d) => add(d.category));
  if (out.length === 0) add(FALLBACK_CATEGORY);
  return out;
}

/** Per-draft errors, by key (prompt text is 3–500 characters, 08 § Prompts). */
export function draftErrors(drafts: readonly Draft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const d of drafts) {
    const text = normText(d.text);
    if (text.length < 3) errors[d.key] = 'Write at least 3 characters';
    else if (text.length > 500) errors[d.key] = 'Keep it under 500 characters';
    else if (seen.has(text.toLowerCase())) errors[d.key] = 'This prompt is listed twice';
    seen.add(text.toLowerCase());
  }
  return errors;
}

/** The body for `POST /brands/:id/prompts`. */
export const draftsToBody = (drafts: readonly Draft[]) =>
  drafts.map((d) => ({ text: normText(d.text), category: d.category, source: d.source }));
