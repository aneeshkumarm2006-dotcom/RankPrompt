import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { scopeSchema } from '../enums';
import { languageCodeSchema } from '../languages';
import { MAX_CATEGORIES } from './brands';
import { isoDateSchema, queryBoolSchema, textSchema } from './common';

/** Hard cap on one generate call or one bulk add; the plan's maxPromptsPerRun is usually lower. */
export const MAX_PROMPTS_PER_REQUEST = 150;

export const PROMPT_SOURCES = ['generated', 'manual'] as const;
export const promptSourceSchema = z.enum(PROMPT_SOURCES);
export type PromptSource = z.infer<typeof promptSourceSchema>;

export const promptTextSchema = textSchema(3, 500);
export const promptCategorySchema = textSchema(1, 100);

export const promptSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  text: z.string(),
  category: z.string(),
  source: promptSourceSchema,
  /** The prompt this one replaced when its text was edited (D-014). */
  replacesId: z.string().nullable(),
  archivedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});
export type Prompt = z.infer<typeof promptSchema>;
export const promptListResponseSchema = z.array(promptSchema);

export const listPromptsQuerySchema = z.object({
  includeArchived: queryBoolSchema.default(false),
});

export const generatePromptsBodySchema = z
  .object({
    categories: z.array(promptCategorySchema).min(1).max(MAX_CATEGORIES),
    count: z.number().int().min(1).max(MAX_PROMPTS_PER_REQUEST),
    scope: scopeSchema,
    country: countryCodeSchema,
    city: textSchema(1, 100).nullable().default(null),
    language: languageCodeSchema,
  })
  .refine((b) => b.scope !== 'local' || b.city !== null, {
    message: 'A local scope needs a city',
    path: ['city'],
  });
export type GeneratePromptsBody = z.output<typeof generatePromptsBodySchema>;

export const generatePromptsResponseSchema = z.object({
  drafts: z.array(z.object({ text: z.string(), category: z.string() })),
});
export type GeneratePromptsResponse = z.infer<typeof generatePromptsResponseSchema>;

export const createPromptsBodySchema = z.object({
  prompts: z
    .array(
      z.object({
        text: promptTextSchema,
        category: promptCategorySchema,
        source: promptSourceSchema.default('manual'),
      }),
    )
    .min(1)
    .max(MAX_PROMPTS_PER_REQUEST),
});
export type CreatePromptsBody = z.output<typeof createPromptsBodySchema>;

export const patchPromptBodySchema = z
  .object({ text: promptTextSchema, category: promptCategorySchema })
  .partial()
  .refine((b) => b.text !== undefined || b.category !== undefined, {
    message: 'Nothing to update',
  });
export type PatchPromptBody = z.output<typeof patchPromptBodySchema>;
