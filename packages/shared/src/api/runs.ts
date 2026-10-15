import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import {
  checkStatusSchema,
  platformSchema,
  runStatusSchema,
  runTriggerSchema,
  scopeSchema,
} from '../enums';
import { languageCodeSchema } from '../languages';
import { platformsSchema } from './brands';
import { isoDateSchema, objectIdSchema, pageSchema, queryBoolSchema, textSchema } from './common';
import { MAX_PROMPTS_PER_REQUEST } from './prompts';

// ---- Metric shapes (05) ---------------------------------------------------------------------

export const ratioSchema = z.object({
  num: z.number(),
  den: z.number(),
  rate: z.number().nullable(),
});
export const avgRankSchema = z.object({ value: z.number().nullable(), count: z.number() });

const platformAggregateSchema = z.object({
  visibility: ratioSchema,
  citationRate: ratioSchema,
  top3Rate: ratioSchema,
  avgRank: avgRankSchema,
  aioPresence: ratioSchema.optional(),
});

export const competitorAggregateSchema = z.object({
  competitorId: z.string(),
  name: z.string(),
  visibility: ratioSchema,
  avgRank: avgRankSchema,
  shareOfVoice: ratioSchema,
  citationRate: ratioSchema,
});

export const suggestedCompetitorSchema = z.object({
  name: z.string(),
  mentions: z.number(),
  bestRank: z.number(),
  avgRank: z.number(),
});

export const citedDomainSchema = z.object({
  domain: z.string(),
  count: z.number(),
  platforms: z.array(platformSchema),
  isBrand: z.boolean(),
});

/** `runs.aggregates` (05 § Run aggregates). Computed by the server at finalize. */
export const runAggregatesSchema = z.object({
  total: z.object({
    visibility: ratioSchema,
    citationRate: ratioSchema,
    promptCoverage: ratioSchema,
    top3Rate: ratioSchema,
    avgRank: avgRankSchema,
    shareOfVoice: ratioSchema,
  }),
  byPlatform: z.partialRecord(platformSchema, platformAggregateSchema),
  byCategory: z.record(
    z.string(),
    z.object({ visibility: ratioSchema, citationRate: ratioSchema }),
  ),
  competitors: z.array(competitorAggregateSchema),
  suggestedCompetitors: z.array(suggestedCompetitorSchema),
  topCitedDomains: z.array(citedDomainSchema),
});

// ---- POST /runs/estimate, POST /runs --------------------------------------------------------

const promptIdsSchema = z
  .array(objectIdSchema)
  .min(1)
  .max(MAX_PROMPTS_PER_REQUEST)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Prompts must be unique' });

export const estimateRunBodySchema = z.object({
  brandId: objectIdSchema,
  promptIds: promptIdsSchema,
  platforms: platformsSchema,
});
export type EstimateRunBody = z.output<typeof estimateRunBodySchema>;

export const runEstimateSchema = z.object({
  /** prompts × platforms; 1 credit per check (D-006). */
  checks: z.number(),
  credits: z.number(),
  balance: z.object({ plan: z.number(), purchased: z.number() }),
  sufficient: z.boolean(),
});
export type RunEstimate = z.infer<typeof runEstimateSchema>;

export const createRunBodySchema = z
  .object({
    brandId: objectIdSchema,
    promptIds: promptIdsSchema,
    platforms: platformsSchema,
    country: countryCodeSchema,
    city: textSchema(1, 100).nullable().default(null),
    language: languageCodeSchema,
    scope: scopeSchema,
  })
  .refine((b) => b.scope !== 'local' || b.city !== null, {
    message: 'A local scope needs a city',
    path: ['city'],
  });
export type CreateRunBody = z.output<typeof createRunBodySchema>;

/** `Idempotency-Key` header on `POST /runs`: a retry with the same key returns the same run. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[\w.:-]{8,128}$/, 'Idempotency-Key must be 8–128 letters, digits or -_.:');

// ---- Run ------------------------------------------------------------------------------------

export const runProgressSchema = z.object({
  total: z.number(),
  ok: z.number(),
  noAnswer: z.number(),
  failed: z.number(),
  canceled: z.number(),
  /** Not finished yet: waiting or running. */
  pending: z.number(),
  running: z.number(),
});
export type RunProgress = z.infer<typeof runProgressSchema>;

export const runConfigSchema = z.object({
  platforms: z.array(platformSchema),
  country: countryCodeSchema,
  city: z.string().nullable(),
  language: languageCodeSchema,
  scope: scopeSchema,
  aioLoadAsync: z.boolean(),
});

export const runSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  brand: z.object({
    name: z.string(),
    domain: z.string(),
    competitors: z.array(z.object({ id: z.string(), name: z.string(), domain: z.string() })),
  }),
  trigger: runTriggerSchema,
  scheduleId: z.string().nullable(),
  status: runStatusSchema,
  config: runConfigSchema,
  promptCount: z.number(),
  progress: runProgressSchema,
  credits: z.object({ reserved: z.number(), charged: z.number(), refunded: z.number() }),
  /** Null until the run is final. */
  aggregates: runAggregatesSchema.nullable(),
  /** The model that actually answered, per platform. */
  models: z.partialRecord(platformSchema, z.string()),
  engineVersion: z.string(),
  metricsVersion: z.string().nullable(),
  createdAt: isoDateSchema,
  startedAt: isoDateSchema.nullable(),
  finishedAt: isoDateSchema.nullable(),
});
export type Run = z.infer<typeof runSchema>;

export const runListItemSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  brandName: z.string(),
  trigger: runTriggerSchema,
  status: runStatusSchema,
  platforms: z.array(platformSchema),
  promptCount: z.number(),
  checks: z.number(),
  /** Live progress while the run isn't final; null once it is. */
  progress: runProgressSchema.nullable(),
  /** Total visibility once final, else null. */
  visibility: ratioSchema.nullable(),
  createdAt: isoDateSchema,
  finishedAt: isoDateSchema.nullable(),
});
export type RunListItem = z.infer<typeof runListItemSchema>;
export const runListResponseSchema = pageSchema(runListItemSchema);
export type RunListResponse = z.infer<typeof runListResponseSchema>;

export const listRunsQuerySchema = z.object({
  brandId: objectIdSchema.optional(),
  status: runStatusSchema.optional(),
  trigger: runTriggerSchema.optional(),
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListRunsQuery = z.output<typeof listRunsQuerySchema>;

// ---- Results --------------------------------------------------------------------------------

export const citationSchema = z.object({
  url: z.string(),
  domain: z.string(),
  title: z.string().nullable(),
  position: z.number(),
});

export const checkResultSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  promptText: z.string(),
  category: z.string(),
  platform: platformSchema,
  status: checkStatusSchema,
  answer: z.string(),
  citations: z.array(citationSchema),
  vendors: z.array(z.string()),
  brand: z.object({
    mentioned: z.boolean(),
    rank: z.number().nullable(),
    cited: z.boolean(),
    citedUrl: z.string().nullable(),
    snippet: z.string().nullable(),
  }),
  competitors: z.array(
    z.object({
      competitorId: z.string(),
      name: z.string(),
      mentioned: z.boolean(),
      rank: z.number().nullable(),
      cited: z.boolean(),
    }),
  ),
  model: z.string(),
  /** A failed check: a stable code plus a message safe to show (never the provider's own text). */
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;
export const checkResultPageSchema = pageSchema(checkResultSchema);
export type CheckResultPage = z.infer<typeof checkResultPageSchema>;

export const listResultsQuerySchema = z.object({
  platform: platformSchema.optional(),
  category: z.string().trim().min(1).max(100).optional(),
  status: checkStatusSchema.optional(),
  mentioned: queryBoolSchema.optional(),
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListResultsQuery = z.output<typeof listResultsQuerySchema>;

/** Safe, user-facing text for each check error code (07: provider messages never reach clients). */
export const CHECK_ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'The platform kept rate-limiting us. This check was refunded.',
  transient: 'The platform was unavailable. This check was refunded.',
  refused: 'The platform declined to answer this prompt. This check was refunded.',
  bad_request: 'The platform rejected this request. This check was refunded.',
  quota: 'The platform quota was exhausted. This check was refunded.',
  extract_failed: 'We could not read the companies in this answer. This check was refunded.',
  not_configured: 'This platform is not configured on the server. This check was refunded.',
  internal: 'Something went wrong running this check. It was refunded.',
};
