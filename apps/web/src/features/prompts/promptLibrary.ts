import { MAX_PROMPTS_PER_REQUEST, type Prompt } from '@pv/shared';

export const PROMPT_MIN = 3;
export const PROMPT_MAX = 500;

/** One prompt per non-empty line, trimmed, exact repeats dropped. */
export function parsePromptLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/** The first problem with a batch of new prompt texts, or undefined. */
export function promptLinesError(lines: string[]): string | undefined {
  if (lines.length === 0) return 'Enter at least one prompt';
  if (lines.length > MAX_PROMPTS_PER_REQUEST)
    return `Add at most ${MAX_PROMPTS_PER_REQUEST} prompts at once`;
  const short = lines.findIndex((l) => l.length < PROMPT_MIN);
  if (short >= 0) return `Line ${short + 1} is too short (at least ${PROMPT_MIN} characters)`;
  const long = lines.findIndex((l) => l.length > PROMPT_MAX);
  if (long >= 0) return `Line ${long + 1} is too long (at most ${PROMPT_MAX} characters)`;
  return undefined;
}

/** Brand categories first (in their order), then any other category a prompt uses. */
export function allCategories(brandCategories: string[], prompts: Prompt[]): string[] {
  return [...new Set([...brandCategories, ...prompts.map((p) => p.category)])];
}

/** Prompts grouped by category for display, after the search and category filters. */
export function groupPrompts(
  prompts: Prompt[],
  order: string[],
  filter: { search: string; category: string | null },
): [string, Prompt[]][] {
  const q = filter.search.trim().toLowerCase();
  const groups = new Map<string, Prompt[]>(order.map((c) => [c, []]));
  for (const p of prompts) {
    if (filter.category && p.category !== filter.category) continue;
    if (q && !p.text.toLowerCase().includes(q)) continue;
    const list = groups.get(p.category) ?? [];
    list.push(p);
    groups.set(p.category, list);
  }
  // Active prompts before archived ones inside each category.
  return [...groups.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([c, list]) => [
      c,
      [...list].sort((a, b) => Number(a.archivedAt !== null) - Number(b.archivedAt !== null)),
    ]);
}

/** Old prompt id → the prompt that replaced it when its text was edited (D-014). */
export function replacedByMap(prompts: Prompt[]): Map<string, Prompt> {
  const map = new Map<string, Prompt>();
  for (const p of prompts) if (p.replacesId) map.set(p.replacesId, p);
  return map;
}
