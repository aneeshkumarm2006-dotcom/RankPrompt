import { z } from 'zod';
import { checkStatusSchema, platformSchema, runStatusSchema, runTriggerSchema } from '../enums';
import { isoDateSchema, objectIdSchema } from './common';
import {
  avgRankSchema,
  competitorAggregateSchema,
  ratioSchema,
  runAggregatesSchema,
  suggestedCompetitorSchema,
} from './runs';

/** `?from&to` (ISO dates). Defaults: the last 90 days. */
export const dateRangeQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const DEFAULT_INSIGHTS_RANGE_DAYS = 90;

// ---- GET /brands/:id/insights/overview ------------------------------------------------------

export const visibilityDeltaSchema = z.object({
  current: ratioSchema,
  previous: ratioSchema,
  deltaPts: z.number().nullable(),
  sharedPrompts: z.number(),
  sharedPlatforms: z.array(platformSchema),
});

export const insightsOverviewSchema = z.object({
  /** The newest completed or partial run, with its aggregates. */
  latestRun: z
    .object({
      id: z.string(),
      status: runStatusSchema,
      trigger: runTriggerSchema,
      createdAt: isoDateSchema,
      finishedAt: isoDateSchema.nullable(),
      platforms: z.array(platformSchema),
      aggregates: runAggregatesSchema,
    })
    .nullable(),
  previousRunId: z.string().nullable(),
  /** Versus the previous completed/partial run, over the prompts and platforms both share. */
  delta: visibilityDeltaSchema.nullable(),
  counts: z.object({ runs: z.number(), activePrompts: z.number(), activeSchedules: z.number() }),
  nextScheduledRunAt: isoDateSchema.nullable(),
});
export type InsightsOverview = z.infer<typeof insightsOverviewSchema>;

// ---- GET /brands/:id/insights/trend ---------------------------------------------------------

export const trendQuerySchema = dateRangeQuerySchema.extend({
  platform: platformSchema.optional(),
});

export const trendPointSchema = z.object({
  runId: z.string(),
  date: isoDateSchema,
  trigger: runTriggerSchema,
  /** Total visibility, or the `?platform` one. */
  visibility: ratioSchema,
  byPlatform: z.partialRecord(platformSchema, ratioSchema),
  promptSetHash: z.string(),
  platformsHash: z.string(),
  /**
   * False when the prompt set or platform list changed since the previous point: the UI draws a
   * "prompt set changed" marker, because the two points aren't directly comparable.
   */
  comparableWithPrevious: z.boolean(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;
export const trendResponseSchema = z.object({ points: z.array(trendPointSchema) });
export type TrendResponse = z.infer<typeof trendResponseSchema>;

// ---- GET /brands/:id/insights/competitors ---------------------------------------------------

export const competitorsQuerySchema = z.object({ runId: objectIdSchema.optional() });

export const competitorInsightsSchema = z.object({
  /** Null when the brand has no completed or partial run yet. */
  runId: z.string().nullable(),
  brand: z
    .object({
      name: z.string(),
      visibility: ratioSchema,
      avgRank: avgRankSchema,
      shareOfVoice: ratioSchema,
      citationRate: ratioSchema,
    })
    .nullable(),
  competitors: z.array(competitorAggregateSchema),
  suggestedCompetitors: z.array(suggestedCompetitorSchema),
  /** Per prompt and platform: the brand's rank and each tracked competitor's rank. */
  matrix: z.array(
    z.object({
      promptId: z.string(),
      promptText: z.string(),
      category: z.string(),
      cells: z.array(
        z.object({
          platform: platformSchema,
          status: checkStatusSchema,
          brandRank: z.number().nullable(),
          competitorRanks: z.array(
            z.object({ competitorId: z.string(), rank: z.number().nullable() }),
          ),
        }),
      ),
    }),
  ),
});
export type CompetitorInsights = z.infer<typeof competitorInsightsSchema>;

// ---- GET /brands/:id/insights/sources -------------------------------------------------------

export const sourcesQuerySchema = trendQuerySchema;

export const sourcesResponseSchema = z.object({
  totalCitations: z.number(),
  domains: z.array(
    z.object({
      domain: z.string(),
      count: z.number(),
      /** count ÷ every citation in the range. */
      share: z.number(),
      platforms: z.array(platformSchema),
      isBrand: z.boolean(),
      sampleUrls: z.array(z.string()),
      samplePrompts: z.array(z.string()),
    }),
  ),
});
export type SourcesResponse = z.infer<typeof sourcesResponseSchema>;

// ---- GET /brands/:id/insights/prompts -------------------------------------------------------

export const promptHistoryQuerySchema = dateRangeQuerySchema;

export const promptHistoryResponseSchema = z.object({
  prompts: z.array(
    z.object({
      promptId: z.string(),
      text: z.string(),
      category: z.string(),
      archived: z.boolean(),
      history: z.array(
        z.object({
          runId: z.string(),
          date: isoDateSchema,
          trigger: runTriggerSchema,
          perPlatform: z.partialRecord(
            platformSchema,
            z.object({
              status: checkStatusSchema,
              mentioned: z.boolean(),
              rank: z.number().nullable(),
              cited: z.boolean(),
            }),
          ),
        }),
      ),
    }),
  ),
});
export type PromptHistoryResponse = z.infer<typeof promptHistoryResponseSchema>;
