import {
  DEFAULT_INSIGHTS_RANGE_DAYS,
  isBrandDomain,
  visibilityDelta,
  type CompetitorInsights,
  type InsightsOverview,
  type Platform,
  type PromptHistoryResponse,
  type SourcesResponse,
  type TrendResponse,
} from '@pv/shared';
import { Types } from 'mongoose';
import type { Ctx } from '../../http/context';
import { AppError, notFound } from '../../http/errors';
import { brandsRepo } from '../brands/repo';
import { promptsRepo } from '../prompts/repo';
import { resultsRepo } from '../results/repo';
import { isSettled } from '../runs/mapper';
import { runsRepo, type RunDoc } from '../runs/repo';
import { schedulesRepo } from '../schedules/repo';

const DAY_MS = 24 * 60 * 60_000;
const SOURCES_LIMIT = 100;

/** `?from&to`, defaulting to the last 90 days. */
function rangeOf(q: { from?: string | undefined; to?: string | undefined }) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from
    ? new Date(q.from)
    : new Date(to.getTime() - DEFAULT_INSIGHTS_RANGE_DAYS * DAY_MS);
  if (from > to) {
    throw new AppError('VALIDATION_FAILED', '`from` must be before `to`', [
      { path: 'from', message: 'after `to`' },
    ]);
  }
  return { from, to };
}

export type InsightsService = ReturnType<typeof createInsightsService>;

/**
 * Brand-level insights (05, 08 § Insights). Every number is either a run's stored aggregates or
 * computed with the shared metric functions; nothing here defines a metric of its own.
 */
export function createInsightsService() {
  async function brandOf(ctx: Ctx, brandId: string) {
    const brand = await brandsRepo.findById(ctx, brandId);
    if (!brand) throw notFound('Brand');
    return brand;
  }

  return {
    async overview(ctx: Ctx, brandId: string): Promise<InsightsOverview> {
      await brandOf(ctx, brandId);
      const [latest, runs, prompts, schedules, nextRunAt] = await Promise.all([
        runsRepo.latestReportable(ctx, brandId, 2),
        runsRepo.countForBrand(ctx, brandId),
        promptsRepo.listForBrand(ctx, brandId, false),
        schedulesRepo.countActiveByBrand(ctx),
        schedulesRepo.nextRunAt(ctx, brandId),
      ]);
      const [current, previous] = latest;
      let delta: InsightsOverview['delta'] = null;
      if (current && previous) {
        const [cur, prev] = await Promise.all([
          resultsRepo.metricChecks(ctx, current._id),
          resultsRepo.metricChecks(ctx, previous._id),
        ]);
        delta = visibilityDelta(prev, cur);
      }
      return {
        latestRun:
          current?.aggregates && isSettled(current)
            ? {
                id: current._id.toHexString(),
                status: current.status,
                trigger: current.trigger,
                createdAt: current.createdAt.toISOString(),
                finishedAt: current.finishedAt?.toISOString() ?? null,
                platforms: [...current.config.platforms],
                aggregates: current.aggregates,
              }
            : null,
        previousRunId: previous?._id.toHexString() ?? null,
        delta,
        counts: {
          runs,
          activePrompts: prompts.length,
          activeSchedules: schedules.get(brandId) ?? 0,
        },
        nextScheduledRunAt: nextRunAt?.toISOString() ?? null,
      };
    },

    /** One point per completed or partial run, with comparability markers (05 § Trends). */
    async trend(
      ctx: Ctx,
      brandId: string,
      q: { from?: string | undefined; to?: string | undefined; platform?: Platform | undefined },
    ): Promise<TrendResponse> {
      await brandOf(ctx, brandId);
      const runs = await runsRepo.listReportable(ctx, brandId, rangeOf(q));
      let prev: RunDoc | undefined;
      const points: TrendResponse['points'] = [];
      for (const run of runs) {
        const agg = run.aggregates;
        if (!agg) continue;
        const byPlatform = Object.fromEntries(
          Object.entries(agg.byPlatform).map(([p, a]) => [p, a.visibility]),
        );
        const visibility = q.platform
          ? agg.byPlatform[q.platform]?.visibility
          : agg.total.visibility;
        if (!visibility) continue; // the run didn't include that platform
        points.push({
          runId: run._id.toHexString(),
          date: run.createdAt.toISOString(),
          trigger: run.trigger,
          visibility,
          byPlatform,
          promptSetHash: run.promptSetHash,
          platformsHash: run.platformsHash,
          comparableWithPrevious:
            prev === undefined ||
            (prev.promptSetHash === run.promptSetHash && prev.platformsHash === run.platformsHash),
        });
        prev = run;
      }
      return { points };
    },

    /** Per-competitor metrics, the per-prompt rank matrix and suggested competitors (F-21, F-42). */
    async competitors(
      ctx: Ctx,
      brandId: string,
      runId: string | undefined,
    ): Promise<CompetitorInsights> {
      await brandOf(ctx, brandId);
      let run: RunDoc | null;
      if (runId) {
        run = await runsRepo.findById(ctx, runId);
        if (!run || !run.brandId.equals(brandId)) throw notFound('Run');
        if (!isSettled(run)) {
          throw new AppError(
            'RUN_NOT_FINAL',
            'Competitor insights are ready once the run finishes',
          );
        }
      } else {
        run = (await runsRepo.latestReportable(ctx, brandId, 1))[0] ?? null;
      }
      const agg = run?.aggregates;
      if (!run || !agg) {
        return { runId: null, brand: null, competitors: [], suggestedCompetitors: [], matrix: [] };
      }

      const results = await resultsRepo.listAll(ctx, run._id);
      const rows = new Map<string, CompetitorInsights['matrix'][number]>();
      for (const r of results) {
        const key = r.promptId.toHexString();
        const row = rows.get(key) ?? {
          promptId: key,
          promptText: r.promptText,
          category: r.category,
          cells: [],
        };
        row.cells.push({
          platform: r.platform,
          status: r.status,
          brandRank: r.brand.rank ?? null,
          competitorRanks: run.brandSnapshot.competitors.map((c) => ({
            competitorId: c._id.toHexString(),
            rank: r.competitors.find((x) => x.competitorId.equals(c._id))?.rank ?? null,
          })),
        });
        rows.set(key, row);
      }

      return {
        runId: run._id.toHexString(),
        brand: {
          name: run.brandSnapshot.name,
          visibility: agg.total.visibility,
          avgRank: agg.total.avgRank,
          shareOfVoice: agg.total.shareOfVoice,
          citationRate: agg.total.citationRate,
        },
        competitors: agg.competitors,
        suggestedCompetitors: agg.suggestedCompetitors,
        matrix: [...rows.values()],
      };
    },

    /** Real citations across answered checks in a range (05 § Sources, F-24). */
    async sources(
      ctx: Ctx,
      brandId: string,
      q: { from?: string | undefined; to?: string | undefined; platform?: Platform | undefined },
    ): Promise<SourcesResponse> {
      const brand = await brandOf(ctx, brandId);
      const { total, domains } = await resultsRepo.sources(
        ctx,
        brandId,
        rangeOf(q),
        q.platform,
        SOURCES_LIMIT,
      );
      return {
        totalCitations: total,
        domains: domains.map((d) => ({
          domain: d.domain,
          count: d.count,
          share: total ? d.count / total : 0,
          platforms: [...d.platforms].sort(),
          isBrand: isBrandDomain(d.domain, brand.domain),
          sampleUrls: d.urls,
          samplePrompts: d.prompts,
        })),
      };
    },

    /** Per prompt: its result on each platform in every completed or partial run (F-22). */
    async promptHistory(
      ctx: Ctx,
      brandId: string,
      q: { from?: string | undefined; to?: string | undefined },
    ): Promise<PromptHistoryResponse> {
      await brandOf(ctx, brandId);
      const range = rangeOf(q);
      const runs = await runsRepo.listReportable(ctx, brandId, range);
      const runById = new Map(runs.map((r) => [r._id.toHexString(), r]));
      const rows = await resultsRepo.history(
        ctx,
        brandId,
        range,
        runs.map((r) => r._id),
      );

      type Entry = PromptHistoryResponse['prompts'][number]['history'][number];
      const byPrompt = new Map<string, Map<string, Entry>>();
      for (const r of rows) {
        const run = runById.get(r.runId.toHexString());
        if (!run) continue;
        const promptKey = r.promptId.toHexString();
        const history = byPrompt.get(promptKey) ?? new Map<string, Entry>();
        const runKey = run._id.toHexString();
        const entry: Entry = history.get(runKey) ?? {
          runId: runKey,
          date: run.createdAt.toISOString(),
          trigger: run.trigger,
          perPlatform: {},
        };
        entry.perPlatform[r.platform] = {
          status: r.status,
          mentioned: r.brand.mentioned,
          rank: r.brand.rank ?? null,
          cited: r.brand.cited,
        };
        history.set(runKey, entry);
        byPrompt.set(promptKey, history);
      }

      const prompts = await promptsRepo.findByIds(
        ctx,
        brandId,
        [...byPrompt.keys()].map((id) => new Types.ObjectId(id)),
      );
      return {
        prompts: prompts
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((p) => ({
            promptId: p._id.toHexString(),
            text: p.text,
            category: p.category,
            archived: p.archivedAt !== null,
            history: [...(byPrompt.get(p._id.toHexString())?.values() ?? [])].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          })),
      };
    },
  };
}
