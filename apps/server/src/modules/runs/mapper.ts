import {
  CHECK_ERROR_MESSAGES,
  isFinalRunStatus,
  type CheckResult,
  type Run,
  type RunListItem,
  type RunProgress,
} from '@pv/shared';
import type { ResultDoc, StatusCounts } from '../results/repo';
import type { RunDoc } from './repo';

/** Final and finalized: its counts and aggregates won't change any more. */
export const isSettled = (run: Pick<RunDoc, 'status' | 'finalizedGen' | 'generation'>) =>
  isFinalRunStatus(run.status) && run.finalizedGen >= run.generation;

export function progressOf(counts: StatusCounts): RunProgress {
  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    ok: counts.ok,
    noAnswer: counts.no_answer,
    failed: counts.failed,
    canceled: counts.canceled,
    pending: counts.pending + counts.running,
    running: counts.running,
  };
}

/** The settled counts written at finalize, in progress form. */
export const progressFromRun = (run: RunDoc): RunProgress => ({
  total: run.counts.total,
  ok: run.counts.ok,
  noAnswer: run.counts.noAnswer,
  failed: run.counts.failed,
  canceled: run.counts.canceled,
  pending: 0,
  running: 0,
});

/** Mongoose documents never leave the server: this is the API shape (01). */
export function toRun(run: RunDoc, progress: RunProgress): Run {
  return {
    id: run._id.toHexString(),
    brandId: run.brandId.toHexString(),
    brand: {
      name: run.brandSnapshot.name,
      domain: run.brandSnapshot.domain,
      competitors: run.brandSnapshot.competitors.map((c) => ({
        id: c._id.toHexString(),
        name: c.name,
        domain: c.domain,
      })),
    },
    trigger: run.trigger,
    scheduleId: run.scheduleId?.toHexString() ?? null,
    status: run.status,
    config: {
      platforms: [...run.config.platforms],
      country: run.config.country,
      city: run.config.city ?? null,
      language: run.config.language,
      scope: run.config.scope,
      aioLoadAsync: run.config.aioLoadAsync,
    },
    promptCount: run.promptIds.length,
    progress,
    credits: {
      reserved: run.credits.reserved,
      charged: run.credits.charged,
      refunded: run.credits.refunded,
    },
    aggregates: isSettled(run) ? run.aggregates : null,
    models: { ...run.models },
    engineVersion: run.engineVersion,
    metricsVersion: run.metricsVersion,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export function toRunListItem(run: RunDoc, progress: RunProgress | null): RunListItem {
  return {
    id: run._id.toHexString(),
    brandId: run.brandId.toHexString(),
    brandName: run.brandSnapshot.name,
    trigger: run.trigger,
    status: run.status,
    platforms: [...run.config.platforms],
    promptCount: run.promptIds.length,
    checks: run.promptIds.length * run.config.platforms.length,
    progress,
    visibility: isSettled(run) ? (run.aggregates?.total.visibility ?? null) : null,
    createdAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

/** The provider's own error text stays internal (07); clients get a safe message per code. */
export const safeError = (error: ResultDoc['error']): CheckResult['error'] =>
  error
    ? {
        code: error.code,
        message: CHECK_ERROR_MESSAGES[error.code] ?? CHECK_ERROR_MESSAGES.internal ?? 'Failed',
      }
    : null;

export function toCheckResult(r: ResultDoc): CheckResult {
  return {
    id: r._id.toHexString(),
    promptId: r.promptId.toHexString(),
    promptText: r.promptText,
    category: r.category,
    platform: r.platform,
    status: r.status,
    answer: r.answer,
    citations: r.citations.map((c) => ({
      url: c.url,
      domain: c.domain,
      title: c.title ?? null,
      position: c.position,
    })),
    vendors: [...r.vendors],
    brand: {
      mentioned: r.brand.mentioned,
      rank: r.brand.rank ?? null,
      cited: r.brand.cited,
      citedUrl: r.brand.citedUrl ?? null,
      snippet: r.brand.snippet ?? null,
    },
    competitors: r.competitors.map((c) => ({
      competitorId: c.competitorId.toHexString(),
      name: c.name,
      mentioned: c.mentioned,
      rank: c.rank ?? null,
      cited: c.cited,
    })),
    model: r.model,
    error: safeError(r.error),
  };
}
