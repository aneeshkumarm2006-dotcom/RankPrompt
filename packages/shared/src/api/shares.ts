import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { checkStatusSchema, platformSchema, runStatusSchema } from '../enums';
import { languageCodeSchema } from '../languages';
import { isoDateSchema } from './common';
import { avgRankSchema, citedDomainSchema, ratioSchema, suggestedCompetitorSchema } from './runs';

export const MAX_SHARE_DAYS = 365;

export const createShareBodySchema = z.object({
  /** Omitted: the link never expires (it can still be revoked). */
  expiresInDays: z.number().int().min(1).max(MAX_SHARE_DAYS).optional(),
});
export type CreateShareBody = z.output<typeof createShareBodySchema>;

/** `POST /runs/:id/shares`: the plaintext token is in this response only, never again. */
export const createdShareSchema = z.object({
  id: z.string(),
  url: z.string(),
  token: z.string(),
  expiresAt: isoDateSchema.nullable(),
});
export type CreatedShare = z.infer<typeof createdShareSchema>;

export const shareSchema = z.object({
  id: z.string(),
  runId: z.string(),
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema.nullable(),
  revokedAt: isoDateSchema.nullable(),
  lastViewedAt: isoDateSchema.nullable(),
  viewCount: z.number(),
});
export type Share = z.infer<typeof shareSchema>;
export const shareListResponseSchema = z.array(shareSchema);

/** Share tokens: 32 random bytes, base64url. */
export const shareTokenParamsSchema = z.object({
  token: z.string().regex(/^[\w-]{20,128}$/, 'not a share link'),
});

const ratio = ratioSchema;

/**
 * `GET /public/shares/:token` (07 § Public shares): a trimmed report. It never contains ids,
 * workspace data, costs, raw payloads, models or emails.
 */
export const publicReportSchema = z.object({
  brand: z.object({ name: z.string(), domain: z.string() }),
  run: z.object({
    date: isoDateSchema,
    status: runStatusSchema,
    platforms: z.array(platformSchema),
    country: countryCodeSchema,
    city: z.string().nullable(),
    language: languageCodeSchema,
  }),
  aggregates: z
    .object({
      total: z.object({
        visibility: ratio,
        citationRate: ratio,
        promptCoverage: ratio,
        top3Rate: ratio,
        avgRank: avgRankSchema,
        shareOfVoice: ratio,
      }),
      byPlatform: z.partialRecord(
        platformSchema,
        z.object({
          visibility: ratio,
          citationRate: ratio,
          top3Rate: ratio,
          avgRank: avgRankSchema,
          aioPresence: ratio.optional(),
        }),
      ),
      byCategory: z.record(z.string(), z.object({ visibility: ratio, citationRate: ratio })),
      competitors: z.array(
        z.object({
          name: z.string(),
          visibility: ratio,
          avgRank: avgRankSchema,
          shareOfVoice: ratio,
          citationRate: ratio,
        }),
      ),
      suggestedCompetitors: z.array(suggestedCompetitorSchema),
      topCitedDomains: z.array(citedDomainSchema),
    })
    .nullable(),
  checks: z.array(
    z.object({
      prompt: z.string(),
      category: z.string(),
      platform: platformSchema,
      status: checkStatusSchema,
      mentioned: z.boolean(),
      rank: z.number().nullable(),
      cited: z.boolean(),
      citedUrl: z.string().nullable(),
      snippet: z.string().nullable(),
      answer: z.string(),
      citations: z.array(
        z.object({ url: z.string(), domain: z.string(), title: z.string().nullable() }),
      ),
      competitors: z.array(
        z.object({
          name: z.string(),
          mentioned: z.boolean(),
          rank: z.number().nullable(),
          cited: z.boolean(),
        }),
      ),
    }),
  ),
});
export type PublicReport = z.infer<typeof publicReportSchema>;
