import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { PLATFORMS, platformSchema, runStatusSchema, scopeSchema } from '../enums';
import { languageCodeSchema } from '../languages';
import { isoDateSchema, objectIdSchema, textSchema } from './common';

export const MAX_CATEGORIES = 10;
export const MAX_ALIASES = 20;
export const MAX_COMPETITORS = 50;

/** As typed by the user (`canadim.com`, `https://www.canadim.com/en`); the server normalises it. */
export const websiteUrlInputSchema = z.string().trim().min(3).max(2048);

export const CATEGORY_SOURCES = ['generated', 'custom'] as const;
export const categorySchema = z.object({
  name: textSchema(1, 100),
  description: textSchema(0, 500).default(''),
  source: z.enum(CATEGORY_SOURCES).default('custom'),
});
export type Category = z.output<typeof categorySchema>;

const uniqueBy = <T>(items: readonly T[], key: (t: T) => string) =>
  new Set(items.map((i) => key(i).toLowerCase())).size === items.length;

export const categoriesSchema = z
  .array(categorySchema)
  .max(MAX_CATEGORIES)
  .refine((cs) => uniqueBy(cs, (c) => c.name), { message: 'Category names must be unique' });

export const aliasesSchema = z.array(textSchema(1, 100)).max(MAX_ALIASES);

export const platformsSchema = z
  .array(platformSchema)
  .min(1)
  .refine((ps) => new Set(ps).size === ps.length, { message: 'Platforms must be unique' });

export const brandDefaultsSchema = z
  .object({
    country: countryCodeSchema,
    city: textSchema(1, 100).nullable().default(null),
    language: languageCodeSchema,
    scope: scopeSchema,
    platforms: platformsSchema,
  })
  .refine((d) => d.scope !== 'local' || d.city !== null, {
    message: 'A local scope needs a city',
    path: ['city'],
  });
export type BrandDefaults = z.output<typeof brandDefaultsSchema>;

export const competitorInputSchema = z.object({
  /** Keep the id of an existing competitor so past results stay linked to it. */
  id: objectIdSchema.optional(),
  name: textSchema(1, 100),
  /** Bare domain or URL; stored as the registrable domain. */
  domain: z.string().trim().min(3).max(2048),
  aliases: aliasesSchema.default([]),
});
export type CompetitorInput = z.output<typeof competitorInputSchema>;

export const putCompetitorsBodySchema = z.object({
  competitors: z.array(competitorInputSchema).max(MAX_COMPETITORS),
});
export type PutCompetitorsBody = z.output<typeof putCompetitorsBodySchema>;

// ---- POST /brands/analyze -------------------------------------------------------------------

export const analyzeBrandBodySchema = z.object({
  name: textSchema(1, 100),
  websiteUrl: websiteUrlInputSchema,
});
export type AnalyzeBrandBody = z.output<typeof analyzeBrandBodySchema>;

export const analyzeBrandResponseSchema = z.object({
  domain: z.string(),
  websiteUrl: z.string(),
  summary: z.string(),
  categories: z.array(z.object({ name: z.string(), description: z.string() })),
  suggestedAliases: z.array(z.string()),
});
export type AnalyzeBrandResponse = z.infer<typeof analyzeBrandResponseSchema>;

// ---- Brands CRUD ----------------------------------------------------------------------------

export const createBrandBodySchema = z.object({
  name: textSchema(1, 100),
  websiteUrl: websiteUrlInputSchema,
  summary: textSchema(0, 4000).default(''),
  categories: categoriesSchema.default([]),
  aliases: aliasesSchema.default([]),
  competitors: z.array(competitorInputSchema).max(MAX_COMPETITORS).default([]),
  defaults: brandDefaultsSchema.optional(),
});
export type CreateBrandBody = z.output<typeof createBrandBodySchema>;

export const patchBrandBodySchema = z
  .object({
    name: textSchema(1, 100),
    websiteUrl: websiteUrlInputSchema,
    summary: textSchema(0, 4000),
    aliases: aliasesSchema,
    categories: categoriesSchema,
    defaults: brandDefaultsSchema,
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type PatchBrandBody = z.output<typeof patchBrandBodySchema>;

export const competitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  aliases: z.array(z.string()),
});

export const brandSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  websiteUrl: z.string(),
  aliases: z.array(z.string()),
  summary: z.string(),
  categories: z.array(
    z.object({ name: z.string(), description: z.string(), source: z.enum(CATEGORY_SOURCES) }),
  ),
  competitors: z.array(competitorSchema),
  defaults: z.object({
    country: countryCodeSchema,
    city: z.string().nullable(),
    language: languageCodeSchema,
    scope: scopeSchema,
    platforms: z.array(platformSchema),
  }),
  archivedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Brand = z.infer<typeof brandSchema>;

/** `GET /brands` rows: the brand plus what the brands list shows next to it. */
export const brandListItemSchema = brandSchema.extend({
  promptCount: z.number(),
  activeSchedules: z.number(),
  /** The newest run; null until the brand has one. `visibility` is null until it finishes. */
  latestRun: z
    .object({
      id: z.string(),
      status: runStatusSchema,
      createdAt: isoDateSchema,
      visibility: z
        .object({ num: z.number(), den: z.number(), rate: z.number().nullable() })
        .nullable(),
    })
    .nullable(),
});
export type BrandListItem = z.infer<typeof brandListItemSchema>;
export const brandListResponseSchema = z.array(brandListItemSchema);

/** Starting run settings when neither the brand nor the workspace has any. */
export const DEFAULT_BRAND_DEFAULTS: BrandDefaults = {
  country: 'US',
  city: null,
  language: 'en',
  scope: 'national',
  platforms: [...PLATFORMS],
};
