import type { Platform, PromptHistoryResponse } from '@pv/shared';
import { orderedPlatforms } from './range';

type PromptEntry = PromptHistoryResponse['prompts'][number];

export interface PromptOutcomeCell {
  platform: Platform;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
}

export interface PromptOutcome {
  promptId: string;
  text: string;
  category: string;
  /** Answered checks only, in platform order. */
  cells: PromptOutcomeCell[];
}

/**
 * Sorts one run's prompts into "ranked" (the brand was mentioned on at least one answered
 * platform in scope) and "missed" (answered, never mentioned). Display grouping only: no metric
 * is computed here (05). Prompts with no answered check in scope are left out.
 */
export function splitRankedMissed(
  prompts: PromptEntry[],
  runId: string,
  filter: { platform: Platform | null; category: string | null },
): { ranked: PromptOutcome[]; missed: PromptOutcome[] } {
  const ranked: PromptOutcome[] = [];
  const missed: PromptOutcome[] = [];
  for (const prompt of prompts) {
    if (filter.category && prompt.category !== filter.category) continue;
    const entry = prompt.history.find((h) => h.runId === runId);
    if (!entry) continue;
    const cells: PromptOutcomeCell[] = [];
    for (const platform of orderedPlatforms(Object.keys(entry.perPlatform))) {
      if (filter.platform && platform !== filter.platform) continue;
      const check = entry.perPlatform[platform];
      if (!check || check.status !== 'ok') continue;
      cells.push({ platform, mentioned: check.mentioned, rank: check.rank, cited: check.cited });
    }
    if (cells.length === 0) continue;
    const outcome = {
      promptId: prompt.promptId,
      text: prompt.text,
      category: prompt.category,
      cells,
    };
    (cells.some((c) => c.mentioned) ? ranked : missed).push(outcome);
  }
  return { ranked, missed };
}
