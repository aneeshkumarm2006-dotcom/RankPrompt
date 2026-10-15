import {
  ExtractError,
  PROVIDER_OF,
  ProviderError,
  QUOTA_PAUSE_MS,
  buildMatcher,
  engineVersion,
  matchAll,
  proseOf,
  retryDecision,
  type AnswerRaw,
  type Extraction,
  type Extractor,
  type MatchResult,
  type PlatformAdapter,
  type RetryDecision,
} from '@pv/engine';
import type { Platform } from '@pv/shared';
import { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import { enqueueFinalizeIfDone } from '../../modules/runs/finalize';
import { runsRepo, type RunDoc } from '../../modules/runs/repo';
import {
  OPEN_STATUSES,
  resultsRepo,
  type ResultDoc,
  type ResultOutcome,
} from '../../modules/results/repo';
import { EXTRACTOR_PROVIDER, type ProviderGates } from '../providerGates';
import { jobsRepo, type JobDoc } from '../repo';
import { ABANDONED, DONE, type JobContext, type JobHandler, type JobOutcome } from '../types';

/** What a check needs from the engine. Missing entries mean the provider has no key. */
export interface CheckEngine {
  adapters: Partial<Record<Platform, PlatformAdapter>>;
  extractor: Extractor | undefined;
}

export interface CheckHandlerDeps {
  engine: CheckEngine;
  gates: ProviderGates;
  logger: Logger;
  /** The 04 retry policy; tests shrink its delays. */
  retry?: (kind: ProviderError['kind'], attempt: number, retryAfterMs?: number) => RetryDecision;
}

const scopeOf = (job: JobDoc) => {
  if (!job.workspaceId) throw new Error(`check job ${job._id.toHexString()} has no workspaceId`);
  return { workspaceId: job.workspaceId };
};

const resultIdOf = (job: JobDoc) => new Types.ObjectId(String(job.payload.resultId));

/** Everything a fenced write stores when a check fails for good. */
function failedOutcome(
  code: string,
  message: string,
  attempts: number,
  partial: Partial<ResultOutcome> = {},
): ResultOutcome {
  return {
    status: 'failed',
    answer: '',
    citations: [],
    vendors: [],
    suggested: [],
    brand: { mentioned: false, rank: null, cited: false, citedUrl: null, snippet: null },
    competitors: [],
    model: '',
    latencyMs: 0,
    costMicros: 0,
    engineVersion: null,
    ...partial,
    attempts,
    error: { code, message: message.slice(0, 1000) },
  };
}

function scoredOutcome(
  ans: AnswerRaw,
  ext: Extraction,
  match: MatchResult,
  attempts: number,
  extractModel: string,
): ResultOutcome {
  return {
    status: ans.noAnswer ? 'no_answer' : 'ok',
    answer: ans.answer,
    citations: ans.citations.map((c) => ({
      url: c.url,
      domain: c.domain,
      title: c.title ?? null,
      position: c.position,
    })),
    vendors: ext.vendors,
    suggested: match.suggested,
    brand: match.brand,
    competitors: match.competitors.map((c) => ({
      competitorId: new Types.ObjectId(c.id),
      name: c.name,
      mentioned: c.mentioned,
      rank: c.rank,
      cited: c.cited,
    })),
    model: ans.model,
    latencyMs: ans.latencyMs,
    costMicros: ans.costMicros + ext.costMicros,
    attempts,
    error: null,
    engineVersion: engineVersion(extractModel),
  };
}

/**
 * The `check` job (04 § Check handler): ask the platform, clean, extract vendors, match the brand
 * and its competitors, then store the outcome with a write fenced on this job's lease. The last
 * check of a run enqueues `finalize_run`.
 */
export function createCheckHandler(deps: CheckHandlerDeps): JobHandler {
  const retry = deps.retry ?? retryDecision;

  /** Stores a terminal outcome if this lease still owns the check, then checks for run end. */
  async function finish(
    ctx: JobContext,
    result: ResultDoc,
    outcome: ResultOutcome,
    raw?: { provider: string; response: unknown; extractorResponse: unknown },
  ): Promise<JobOutcome> {
    if (ctx.signal.aborted || !(await jobsRepo.holds(ctx.job._id, ctx.leaseId))) return ABANDONED;
    const scope = scopeOf(ctx.job);
    const written = await resultsRepo.writeOutcome(scope, result._id, ctx.leaseId, outcome);
    if (written && raw) {
      try {
        await resultsRepo.insertRaw({
          workspaceId: result.workspaceId,
          runId: result.runId,
          resultId: result._id,
          ...raw,
        });
      } catch (err) {
        deps.logger.warn({ err, resultId: result._id }, 'could not store the raw provider payload');
      }
    }
    await enqueueFinalizeIfDone(scope, result.runId);
    return DONE;
  }

  async function onProviderError(
    ctx: JobContext,
    result: ResultDoc,
    err: ProviderError,
  ): Promise<JobOutcome> {
    const provider = PROVIDER_OF[result.platform];
    if (err.kind === 'rate_limited') deps.gates.limiter(provider).onRateLimited();
    if (err.kind === 'quota') deps.gates.pause(provider, QUOTA_PAUSE_MS, err.message);

    const { attempts, maxAttempts } = ctx.job;
    const decision = retry(err.kind, attempts, err.retryAfterMs);
    const exhausted = decision.countsAsAttempt && attempts >= maxAttempts;
    deps.logger.warn(
      { resultId: result._id, platform: result.platform, kind: err.kind, attempts, exhausted },
      'check provider error',
    );
    if (decision.retry && !exhausted) {
      if (ctx.signal.aborted) return ABANDONED;
      if (!(await resultsRepo.releaseToPending(scopeOf(ctx.job), result._id, ctx.leaseId))) {
        return ABANDONED;
      }
      return {
        kind: 'retry',
        delayMs: decision.delayMs,
        refundAttempt: !decision.countsAsAttempt,
        error: `${err.kind}: ${err.message}`,
      };
    }
    return finish(ctx, result, failedOutcome(err.kind, err.message, attempts));
  }

  return {
    type: 'check',

    async run(ctx) {
      const scope = scopeOf(ctx.job);
      const result = await resultsRepo.findById(scope, resultIdOf(ctx.job));
      if (!result) return DONE; // the run was deleted
      if (!OPEN_STATUSES.includes(result.status)) {
        await enqueueFinalizeIfDone(scope, result.runId);
        return DONE;
      }
      const run: RunDoc | null = await runsRepo.findById(scope, result.runId);
      if (!run) return DONE;
      if (run.status === 'canceled') {
        await resultsRepo.cancelIfOpen(scope, result._id);
        await enqueueFinalizeIfDone(scope, run._id);
        return DONE;
      }
      await runsRepo.markRunning(scope, run._id);
      if (!(await resultsRepo.markRunning(scope, result._id, ctx.leaseId, ctx.job.attempts))) {
        // Another lease finished it, or it was canceled in between.
        await enqueueFinalizeIfDone(scope, run._id);
        return DONE;
      }
      if (ctx.signal.aborted) return ABANDONED;

      const adapter = deps.engine.adapters[result.platform];
      const extractor = deps.engine.extractor;
      if (!adapter || !extractor) {
        return finish(
          ctx,
          result,
          failedOutcome(
            'not_configured',
            `no ${adapter ? 'extractor' : 'adapter'} for ${result.platform}`,
            ctx.job.attempts,
          ),
        );
      }

      const snapshot = run.brandSnapshot;
      const brand = buildMatcher({
        name: snapshot.name,
        domain: snapshot.domain,
        aliases: snapshot.aliases,
      });
      const competitors = snapshot.competitors.map((c) =>
        buildMatcher({
          id: c._id.toHexString(),
          name: c.name,
          domain: c.domain,
          aliases: c.aliases,
        }),
      );
      const input = {
        prompt: result.promptText,
        country: run.config.country,
        language: run.config.language,
        ...(run.config.city ? { city: run.config.city } : {}),
      };
      const provider = PROVIDER_OF[result.platform];
      const limiter = deps.gates.limiter(provider);

      let ans: AnswerRaw;
      try {
        ans = await limiter.run(() => adapter.ask(input, ctx.signal), ctx.signal);
        limiter.onSuccess();
      } catch (err) {
        if (ctx.signal.aborted) return ABANDONED;
        if (err instanceof ProviderError) return onProviderError(ctx, result, err);
        throw err;
      }
      // The provider was paid whether or not this lease still owns the check.
      await deps.gates.recordSpend(provider, ans.costMicros);
      if (ctx.signal.aborted) return ABANDONED;

      const prose = ans.noAnswer ? '' : proseOf(ans.answer);
      let ext: Extraction;
      try {
        ext = await extractor.extract(prose, ctx.signal);
      } catch (err) {
        if (ctx.signal.aborted) return ABANDONED;
        if (!(err instanceof ExtractError)) throw err;
        // Terminal and refunded, but the answer is kept (03 § Extraction).
        return finish(
          ctx,
          result,
          failedOutcome(err.code, err.message, ctx.job.attempts, {
            answer: ans.answer,
            citations: ans.citations.map((c) => ({
              url: c.url,
              domain: c.domain,
              title: c.title ?? null,
              position: c.position,
            })),
            model: ans.model,
            latencyMs: ans.latencyMs,
            costMicros: ans.costMicros,
          }),
          { provider, response: ans.raw, extractorResponse: null },
        );
      }
      await deps.gates.recordSpend(EXTRACTOR_PROVIDER, ext.costMicros);

      const match = matchAll(prose, ext.vendors, ans.citations, brand, competitors);
      return finish(
        ctx,
        result,
        scoredOutcome(ans, ext, match, ctx.job.attempts, extractor.model),
        {
          provider,
          response: ans.raw,
          extractorResponse: ext.raw,
        },
      );
    },

    /** The queue gave up (unexpected errors, or expired leases on the last attempt). */
    async onGiveUp(job, error) {
      const scope = scopeOf(job);
      const result = await resultsRepo.findById(scope, resultIdOf(job));
      if (!result) return;
      await resultsRepo.failIfOpen(scope, result._id, { code: 'internal', message: error });
      await enqueueFinalizeIfDone(scope, result.runId);
    },
  };
}
