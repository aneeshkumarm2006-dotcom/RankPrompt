import type { BrandAI } from '@pv/engine';
import type {
  CreatePromptsBody,
  GeneratePromptsBody,
  GeneratePromptsResponse,
  PatchPromptBody,
  Prompt,
} from '@pv/shared';
import type { Logger } from '../../config/logger';
import { withTransaction } from '../../db/transaction';
import type { Ctx } from '../../http/context';
import { notFound } from '../../http/errors';
import { callBrandAI } from '../../integrations';
import { brandsRepo } from '../brands/repo';
import { assertPromptCount, planFor } from '../workspaces/limits';
import { workspacesRepo } from '../workspaces/repo';
import { toPrompt } from './mapper';
import { promptsRepo } from './repo';

const textKey = (text: string) => text.normalize('NFKC').toLowerCase();

export interface PromptsServiceDeps {
  brandAI: BrandAI | null;
  logger: Logger;
}

export type PromptsService = ReturnType<typeof createPromptsService>;

export function createPromptsService(deps: PromptsServiceDeps) {
  async function activeBrand(ctx: Ctx, brandId: string) {
    const brand = await brandsRepo.findActiveById(ctx, brandId);
    if (!brand) throw notFound('Brand');
    return brand;
  }

  return {
    async list(ctx: Ctx, brandId: string, includeArchived: boolean): Promise<Prompt[]> {
      if (!(await brandsRepo.findById(ctx, brandId))) throw notFound('Brand');
      const prompts = await promptsRepo.listForBrand(ctx, brandId, includeArchived);
      return prompts.map(toPrompt);
    },

    /**
     * Drafts unbranded prompts in one structured call (F-09). Nothing is saved: the user picks
     * which drafts to keep and saves them with `create`.
     */
    async generate(
      ctx: Ctx,
      brandId: string,
      body: GeneratePromptsBody,
    ): Promise<GeneratePromptsResponse> {
      const brand = await activeBrand(ctx, brandId);
      const ws = await workspacesRepo.findById(ctx.workspaceId);
      if (ws) assertPromptCount(planFor(ws.plan.tier), body.count);

      const descriptions = new Map(brand.categories.map((c) => [textKey(c.name), c.description]));
      const result = await callBrandAI(deps.brandAI, deps.logger, (ai, signal) =>
        ai.generatePrompts(
          {
            brand: {
              name: brand.name,
              domain: brand.domain,
              summary: brand.summary,
              aliases: brand.aliases,
            },
            categories: body.categories.map((name) => ({
              name,
              description: descriptions.get(textKey(name)) ?? '',
            })),
            count: body.count,
            scope: body.scope,
            country: body.country,
            city: body.city,
            language: body.language,
          },
          signal,
        ),
      );
      deps.logger.info(
        { costMicros: result.costMicros, model: result.model, drafts: result.drafts.length },
        'prompts generated',
      );
      return { drafts: result.drafts };
    },

    /** Bulk add. Exact repeats of an active prompt (ignoring case) are skipped, not duplicated. */
    async create(ctx: Ctx, brandId: string, body: CreatePromptsBody): Promise<Prompt[]> {
      await activeBrand(ctx, brandId);
      const existing = await promptsRepo.listForBrand(ctx, brandId, false);
      const seen = new Set(existing.map((p) => textKey(p.text)));
      const fresh = body.prompts.filter((p) => {
        const key = textKey(p.text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!fresh.length) return [];
      const created = await promptsRepo.insertMany(ctx, brandId, fresh);
      return created.map(toPrompt);
    },

    /**
     * Editing the text archives the prompt and creates its replacement in one transaction
     * (D-014), so history stays honest. A category-only change is made in place.
     */
    async update(ctx: Ctx, id: string, body: PatchPromptBody): Promise<Prompt> {
      const current = await promptsRepo.findActiveById(ctx, id);
      if (!current) throw notFound('Prompt');
      await activeBrand(ctx, current.brandId.toHexString());

      if (body.text === undefined || body.text === current.text) {
        if (body.category === undefined || body.category === current.category) {
          return toPrompt(current);
        }
        const updated = await promptsRepo.updateCategory(ctx, id, body.category);
        if (!updated) throw notFound('Prompt');
        return toPrompt(updated);
      }

      const text = body.text;
      const replacement = await withTransaction(async (session) => {
        // The atomic archive is the claim: two concurrent edits can't both fork the prompt.
        if (!(await promptsRepo.archive(ctx, current._id, session))) return null;
        const [created] = await promptsRepo.insertMany(
          ctx,
          current.brandId.toHexString(),
          [
            {
              text,
              category: body.category ?? current.category,
              source: 'manual',
              replacesId: current._id,
            },
          ],
          session,
        );
        return created ?? null;
      });
      if (!replacement) throw notFound('Prompt');
      return toPrompt(replacement);
    },

    async archive(ctx: Ctx, id: string): Promise<void> {
      if (!(await promptsRepo.archive(ctx, id))) {
        // Archiving twice is fine; an unknown id (or another workspace's) is not.
        if (!(await promptsRepo.findById(ctx, id))) throw notFound('Prompt');
      }
    },
  };
}
