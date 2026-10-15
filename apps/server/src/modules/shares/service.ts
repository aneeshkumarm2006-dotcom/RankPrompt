import { createHash, randomBytes } from 'node:crypto';
import type { CreateShareBody, CreatedShare, PublicReport, RunAggregates, Share } from '@pv/shared';
import { Types } from 'mongoose';
import type { Ctx } from '../../http/context';
import { AppError, notFound } from '../../http/errors';
import { resultsRepo } from '../results/repo';
import { isSettled } from '../runs/mapper';
import { runsRepo } from '../runs/repo';
import { sharesRepo, type ShareDoc } from './repo';

const DAY_MS = 24 * 60 * 60_000;

export const hashShareToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const toShare = (s: ShareDoc): Share => ({
  id: s._id.toHexString(),
  runId: s.runId.toHexString(),
  createdAt: s.createdAt.toISOString(),
  expiresAt: s.expiresAt?.toISOString() ?? null,
  revokedAt: s.revokedAt?.toISOString() ?? null,
  lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
  viewCount: s.viewCount,
});

/** Aggregates without ids (07 § Public shares: the public DTO never carries ids). */
function publicAggregates(agg: RunAggregates | null): PublicReport['aggregates'] {
  if (!agg) return null;
  return {
    total: agg.total,
    byPlatform: agg.byPlatform,
    byCategory: agg.byCategory,
    competitors: agg.competitors.map(({ competitorId: _id, ...rest }) => rest),
    suggestedCompetitors: agg.suggestedCompetitors,
    topCitedDomains: agg.topCitedDomains,
  };
}

export type SharesService = ReturnType<typeof createSharesService>;

/** Revocable public links to one run's report (F-14, F-15, 07 § Public shares). */
export function createSharesService(deps: { appUrl: string }) {
  async function settledRun(ctx: Ctx, runId: string) {
    const run = await runsRepo.findById(ctx, runId);
    if (!run) throw notFound('Run');
    return run;
  }

  return {
    /** The plaintext token is returned here once; only its SHA-256 is stored. */
    async create(ctx: Ctx, runId: string, body: CreateShareBody): Promise<CreatedShare> {
      const run = await settledRun(ctx, runId);
      if (!isSettled(run)) {
        throw new AppError('RUN_NOT_FINAL', 'A run can be shared once it has finished');
      }
      const token = randomBytes(32).toString('base64url');
      const share = await sharesRepo.create(ctx, {
        runId: run._id,
        tokenHash: hashShareToken(token),
        createdBy: new Types.ObjectId(ctx.userId),
        expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * DAY_MS) : null,
      });
      return {
        id: share._id.toHexString(),
        url: `${deps.appUrl}/share/${token}`,
        token,
        expiresAt: share.expiresAt?.toISOString() ?? null,
      };
    },

    async list(ctx: Ctx, runId: string): Promise<Share[]> {
      await settledRun(ctx, runId);
      return (await sharesRepo.listForRun(ctx, runId)).map(toShare);
    },

    async revoke(ctx: Ctx, id: string): Promise<void> {
      if (!(await sharesRepo.revoke(ctx, id))) throw notFound('Share');
    },

    /**
     * `GET /public/shares/:token`: the trimmed report. Unknown, revoked and expired links all
     * look the same (404), so a token can't be probed.
     */
    async publicReport(token: string): Promise<PublicReport> {
      const share = await sharesRepo.findByTokenHash(hashShareToken(token));
      const gone = () => new AppError('NOT_FOUND', 'This link has expired or was revoked');
      if (!share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date())) {
        throw gone();
      }
      const scope = { workspaceId: share.workspaceId };
      const run = await runsRepo.findById(scope, share.runId);
      if (!run || !isSettled(run)) throw gone();
      const results = await resultsRepo.listAll(scope, run._id);
      await sharesRepo.recordView(share);
      return {
        brand: { name: run.brandSnapshot.name, domain: run.brandSnapshot.domain },
        run: {
          date: run.createdAt.toISOString(),
          status: run.status,
          platforms: [...run.config.platforms],
          country: run.config.country,
          city: run.config.city ?? null,
          language: run.config.language,
        },
        aggregates: publicAggregates(run.aggregates),
        checks: results.map((r) => ({
          prompt: r.promptText,
          category: r.category,
          platform: r.platform,
          status: r.status,
          mentioned: r.brand.mentioned,
          rank: r.brand.rank ?? null,
          cited: r.brand.cited,
          citedUrl: r.brand.citedUrl ?? null,
          snippet: r.brand.snippet ?? null,
          answer: r.answer,
          citations: r.citations.map((c) => ({
            url: c.url,
            domain: c.domain,
            title: c.title ?? null,
          })),
          competitors: r.competitors.map((c) => ({
            name: c.name,
            mentioned: c.mentioned,
            rank: c.rank ?? null,
            cited: c.cited,
          })),
        })),
      };
    },
  };
}
