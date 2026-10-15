import type { Platform } from '@pv/shared';
import { proseOf } from './clean';
import type { Extractor } from './extract';
import { type Matcher, matchAll } from './match';
import type { AskInput, Citation, MatchResult, PlatformAdapter, Usage } from './types';
import { engineVersion } from './version';

export interface CheckInput {
  adapter: PlatformAdapter;
  extractor: Extractor;
  input: AskInput;
  brand: Matcher;
  competitors: readonly Matcher[];
  signal: AbortSignal;
}

/** One scored check. Failures throw `ProviderError` (ask) or `ExtractError` (extract). */
export interface CheckResult {
  status: 'ok' | 'no_answer';
  platform: Platform;
  model: string;
  answer: string;
  prose: string;
  citations: Citation[];
  vendors: string[];
  match: MatchResult;
  usage: Usage;
  /** answerCostMicros + extractCostMicros. */
  costMicros: number;
  answerCostMicros: number;
  extractCostMicros: number;
  latencyMs: number;
  raw: unknown;
  extractorRaw: unknown;
  engineVersion: string;
}

/** ask → clean → extract → match (03 § Pipeline for one check). */
export async function runCheck({
  adapter,
  extractor,
  input,
  brand,
  competitors,
  signal,
}: CheckInput): Promise<CheckResult> {
  const ans = await adapter.ask(input, signal);
  const prose = ans.noAnswer ? '' : proseOf(ans.answer);
  // Empty prose (noAnswer) skips the extractor.
  const ext = await extractor.extract(prose, signal);
  return {
    status: ans.noAnswer ? 'no_answer' : 'ok',
    platform: adapter.platform,
    model: ans.model,
    answer: ans.answer,
    prose,
    citations: ans.citations,
    vendors: ext.vendors,
    match: matchAll(prose, ext.vendors, ans.citations, brand, competitors),
    usage: ans.usage,
    costMicros: ans.costMicros + ext.costMicros,
    answerCostMicros: ans.costMicros,
    extractCostMicros: ext.costMicros,
    latencyMs: ans.latencyMs,
    raw: ans.raw,
    extractorRaw: ext.raw,
    engineVersion: engineVersion(extractor.model),
  };
}
