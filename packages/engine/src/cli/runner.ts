import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Platform } from '@pv/shared';
import { runCheck } from '../check';
import type { Engine } from '../config';
import { ExtractError, ProviderError, type ProviderErrorKind } from '../errors';
import { DEFAULT_PROVIDER_LIMITS, type ProviderLimit, RateLimiter } from '../limiter';
import { buildMatcher } from '../match';
import { PRICES_VERSION } from '../prices';
import { MAX_ATTEMPTS, retryDecision } from '../retry';
import {
  type Citation,
  type EntityInput,
  type MatchResult,
  PROVIDER_OF,
  type ProviderKey,
  type Usage,
} from '../types';
import { engineVersion } from '../version';
import type { PromptRow } from './inputs';

/** What a CLI run checks. Frozen into `run.json`; a resume must match it. */
export interface RunSpec {
  brand: EntityInput;
  competitors: EntityInput[];
  prompts: PromptRow[];
  platforms: Platform[];
  country: string;
  city?: string;
  language: string;
}

/** One line of `results.jsonl`. The newest line for a key wins. */
export interface ResultRecord {
  key: string;
  promptIndex: number;
  prompt: string;
  category: string | null;
  keyword: string | null;
  platform: Platform;
  status: 'ok' | 'no_answer' | 'failed';
  attempts: number;
  error: { code: string; kind?: ProviderErrorKind; message: string } | null;
  model: string | null;
  answer: string;
  citations: Citation[];
  vendors: string[];
  match: MatchResult | null;
  usage: Usage;
  costMicros: number;
  answerCostMicros: number;
  extractCostMicros: number;
  latencyMs: number;
  engineVersion: string;
  finishedAt: string;
}

export interface RunMeta {
  spec: RunSpec;
  engineVersion: string;
  pricesVersion: string;
  createdAt: string;
}

export const RUN_FILE = 'run.json';
export const RESULTS_FILE = 'results.jsonl';

/** Stable across prompt reordering: platform + hash of the prompt text. */
export const checkKey = (platform: Platform, prompt: string): string =>
  `${platform}:${createHash('sha1').update(prompt.trim()).digest('hex').slice(0, 12)}`;

export function readResults(outDir: string): Map<string, ResultRecord> {
  const file = path.join(outDir, RESULTS_FILE);
  const out = new Map<string, ResultRecord>();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as ResultRecord;
      out.set(r.key, r);
    } catch {
      // A line cut short by a crash; the check simply runs again.
    }
  }
  return out;
}

export function readRunMeta(outDir: string): RunMeta {
  const file = path.join(outDir, RUN_FILE);
  if (!fs.existsSync(file)) throw new Error(`${file} not found; is this a run directory?`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RunMeta;
}

const sameTarget = (a: RunSpec, b: RunSpec) =>
  a.brand.name === b.brand.name &&
  a.country === b.country &&
  (a.city ?? '') === (b.city ?? '') &&
  a.language === b.language;

export interface RunOptions {
  spec: RunSpec;
  engine: Engine;
  outDir: string;
  /** Checks in flight across all platforms (per-provider limits apply on top). */
  concurrency: number;
  limits?: Partial<Record<ProviderKey, ProviderLimit>>;
  /** Re-run checks that failed last time (default true). */
  retryFailed?: boolean;
  /** Overwrite a run.json that targets a different brand/location. */
  force?: boolean;
  signal?: AbortSignal;
  log?: (line: string) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface PlatformSummary {
  checks: number;
  ok: number;
  noAnswer: number;
  failed: number;
  costMicros: number;
}

export interface RunSummary {
  ran: number;
  skipped: number;
  byPlatform: Partial<Record<Platform, PlatformSummary>>;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason as Error)), {
      once: true,
    });
  });

/**
 * Runs prompts × platforms with resume: each finished check is appended to results.jsonl at once,
 * and a re-run skips checks already `ok` / `no_answer` (03 § CLI). No DB access.
 */
export async function runBatch(opts: RunOptions): Promise<RunSummary> {
  const { spec, engine, outDir } = opts;
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? defaultSleep;
  const signal = opts.signal ?? new AbortController().signal;
  const extractor = engine.extractor;
  if (!extractor) throw new Error(engine.missing.extractor ?? 'no vendor extractor configured');
  for (const p of spec.platforms) {
    if (!engine.adapters[p]) throw new Error(`${p}: ${engine.missing[p] ?? 'no adapter'}`);
  }

  fs.mkdirSync(path.join(outDir, 'raw'), { recursive: true });
  const runFile = path.join(outDir, RUN_FILE);
  if (fs.existsSync(runFile) && !opts.force) {
    const prev = JSON.parse(fs.readFileSync(runFile, 'utf8')) as RunMeta;
    if (!sameTarget(prev.spec, spec)) {
      throw new Error(
        `${outDir} holds a run for ${prev.spec.brand.name} (${prev.spec.country}); use another --out or --force`,
      );
    }
  }
  const meta: RunMeta = {
    spec,
    engineVersion: engineVersion(extractor.model),
    pricesVersion: PRICES_VERSION,
    createdAt: new Date().toISOString(),
  };
  if (fs.existsSync(runFile))
    meta.createdAt = (JSON.parse(fs.readFileSync(runFile, 'utf8')) as RunMeta).createdAt;
  fs.writeFileSync(runFile, JSON.stringify(meta, null, 2));

  const done = readResults(outDir);
  const brand = buildMatcher(spec.brand);
  const competitors = spec.competitors.map(buildMatcher);
  const limiters = new Map<ProviderKey, RateLimiter>();
  const limiterFor = (k: ProviderKey) => {
    let l = limiters.get(k);
    if (!l) limiters.set(k, (l = new RateLimiter(opts.limits?.[k] ?? DEFAULT_PROVIDER_LIMITS[k])));
    return l;
  };
  const stoppedProviders = new Map<ProviderKey, string>();

  // Prompt-major order, so every provider is busy from the start.
  const tasks: { idx: number; row: PromptRow; platform: Platform; key: string }[] = [];
  let skipped = 0;
  spec.prompts.forEach((row, idx) => {
    for (const platform of spec.platforms) {
      const key = checkKey(platform, row.prompt);
      const prev = done.get(key);
      if (prev && (prev.status !== 'failed' || opts.retryFailed === false)) skipped++;
      else tasks.push({ idx, row, platform, key });
    }
  });
  log(`${tasks.length} checks to run, ${skipped} already done`);

  const summary: RunSummary = { ran: 0, skipped, byPlatform: {} };
  const resultsFile = path.join(outDir, RESULTS_FILE);
  const record = (r: ResultRecord, raw: unknown) => {
    fs.appendFileSync(resultsFile, `${JSON.stringify(r)}\n`);
    if (raw !== undefined) {
      const dir = path.join(outDir, 'raw', r.platform);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${String(r.promptIndex + 1).padStart(3, '0')}-${r.key.split(':')[1]}.json`),
        JSON.stringify(raw, null, 1),
      );
    }
    const s = (summary.byPlatform[r.platform] ??= {
      checks: 0,
      ok: 0,
      noAnswer: 0,
      failed: 0,
      costMicros: 0,
    });
    s.checks++;
    s.costMicros += r.costMicros;
    if (r.status === 'ok') s.ok++;
    else if (r.status === 'no_answer') s.noAnswer++;
    else s.failed++;
    summary.ran++;
  };

  const runOne = async (t: (typeof tasks)[number]) => {
    const adapter = engine.adapters[t.platform];
    if (!adapter) return;
    const provider = PROVIDER_OF[t.platform];
    const limiter = limiterFor(provider);
    const base = {
      key: t.key,
      promptIndex: t.idx,
      prompt: t.row.prompt,
      category: t.row.category ?? null,
      keyword: t.row.keyword ?? null,
      platform: t.platform,
      engineVersion: meta.engineVersion,
    };
    let attempts = 0;
    let counted = 0;
    for (;;) {
      const stopped = stoppedProviders.get(provider);
      if (stopped) {
        record(
          {
            ...base,
            ...emptyResult(),
            status: 'failed',
            attempts,
            error: { code: 'provider_stopped', kind: 'quota', message: stopped },
            finishedAt: new Date().toISOString(),
          },
          undefined,
        );
        return;
      }
      attempts++;
      counted++;
      try {
        const input = {
          prompt: t.row.prompt,
          country: spec.country,
          language: spec.language,
          ...(spec.city ? { city: spec.city } : {}),
        };
        const res = await limiter.run(
          () => runCheck({ adapter, extractor, input, brand, competitors, signal }),
          signal,
        );
        limiter.onSuccess();
        record(
          {
            ...base,
            status: res.status,
            attempts,
            error: null,
            model: res.model,
            answer: res.answer,
            citations: res.citations,
            vendors: res.vendors,
            match: res.match,
            usage: res.usage,
            costMicros: res.costMicros,
            answerCostMicros: res.answerCostMicros,
            extractCostMicros: res.extractCostMicros,
            latencyMs: res.latencyMs,
            finishedAt: new Date().toISOString(),
          },
          { input, answer: res.raw, extractor: res.extractorRaw },
        );
        log(
          `${res.status === 'ok' ? 'ok  ' : 'none'} ${t.platform.padEnd(10)} #${t.idx + 1} ${res.match.brand.mentioned ? `mentioned${res.match.brand.rank ? ` rank ${res.match.brand.rank}` : ''}` : '-'}`,
        );
        return;
      } catch (e) {
        if (signal.aborted) throw e;
        const fail = (code: string, message: string, kind?: ProviderErrorKind) => {
          record(
            {
              ...base,
              ...emptyResult(),
              status: 'failed',
              attempts,
              error: { code, message, ...(kind ? { kind } : {}) },
              finishedAt: new Date().toISOString(),
            },
            undefined,
          );
          log(`FAIL ${t.platform.padEnd(10)} #${t.idx + 1} ${code}: ${message}`);
        };
        if (e instanceof ExtractError) return fail(e.code, e.message);
        if (!(e instanceof ProviderError))
          return fail('internal', e instanceof Error ? e.message : String(e));
        if (e.kind === 'rate_limited') limiter.onRateLimited();
        if (e.kind === 'quota') {
          // The CLI doesn't wait out a 15-minute quota pause: stop this provider for the run.
          stoppedProviders.set(provider, `${provider} quota/billing: ${e.message}`);
          return fail('quota', e.message, e.kind);
        }
        const d = retryDecision(e.kind, counted, e.retryAfterMs);
        if (!d.countsAsAttempt) counted--;
        if (!d.retry || attempts >= MAX_ATTEMPTS * 2) return fail(e.kind, e.message, e.kind);
        log(
          `retry ${t.platform} #${t.idx + 1} in ${Math.round(d.delayMs / 1000)}s (${e.kind}: ${e.message})`,
        );
        await sleep(d.delayMs, signal);
      }
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < tasks.length && !signal.aborted) {
      const t = tasks[next++];
      if (t) await runOne(t);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  return summary;
}

const emptyResult = () => ({
  model: null,
  answer: '',
  citations: [],
  vendors: [],
  match: null,
  usage: {},
  costMicros: 0,
  answerCostMicros: 0,
  extractCostMicros: 0,
  latencyMs: 0,
});
