import { siteOf } from '@pv/engine';
import {
  type AnalyzeBrandBody,
  type AnalyzeBrandResponse,
  type Brand,
  type BrandDefaults,
  type BrandListItem,
  type CompetitorInput,
  type CreateBrandBody,
  type PatchBrandBody,
} from '@pv/shared';
import { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import type { Ctx } from '../../http/context';
import { AppError, notFound } from '../../http/errors';
import { callBrandAI } from '../../integrations';
import type { BrandAI } from '@pv/engine';
import { promptsRepo } from '../prompts/repo';
import { isSettled } from '../runs/mapper';
import { runsRepo } from '../runs/repo';
import { schedulesRepo } from '../schedules/repo';
import { assertBrandSlot, assertPlatformsAllowed, planFor } from '../workspaces/limits';
import { workspacesRepo } from '../workspaces/repo';
import { toBrand } from './mapper';
import { brandsRepo, type BrandDoc, type CompetitorDoc, type BrandPatch } from './repo';

/**
 * Turns what the user typed into `https://host/path` plus its registrable domain. Only public
 * domains are accepted (no IPs, no localhost). Nothing is fetched (D-013).
 */
export function normalizeWebsite(input: string): { websiteUrl: string; domain: string } {
  const raw = /^[a-z][a-z\d+.-]*:\/\//i.test(input.trim())
    ? input.trim()
    : `https://${input.trim()}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalidWebsite();
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalidWebsite();
  const domain = siteOf(url.hostname);
  if (!domain) throw invalidWebsite();
  const path = url.pathname.replace(/\/+$/, '');
  return { websiteUrl: `https://${url.hostname.toLowerCase()}${path}`, domain };
}

const invalidWebsite = () =>
  new AppError('VALIDATION_FAILED', 'Enter a public website address, like example.com', [
    { path: 'websiteUrl', message: 'not a public website address' },
  ]);

/** Name first, then the other aliases, deduped case-insensitively (02: aliases include `name`). */
function aliasesWith(name: string, aliases: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [name, ...aliases]) {
    const key = a.normalize('NFKC').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** Validates and normalises the tracked competitors, keeping existing ids where given. */
function buildCompetitors(
  input: readonly CompetitorInput[],
  brandDomain: string,
  existing: readonly CompetitorDoc[] = [],
): CompetitorDoc[] {
  const seen = new Set<string>();
  return input.map((c, i) => {
    let domain: string;
    try {
      domain = normalizeWebsite(c.domain).domain;
    } catch {
      throw new AppError('VALIDATION_FAILED', `Competitor "${c.name}" needs a public website`, [
        { path: `competitors.${i}.domain`, message: 'not a public website address' },
      ]);
    }
    if (domain === brandDomain) {
      throw new AppError('VALIDATION_FAILED', `"${c.name}" has the brand's own domain`, [
        { path: `competitors.${i}.domain`, message: 'same domain as the brand' },
      ]);
    }
    if (seen.has(domain)) {
      throw new AppError('VALIDATION_FAILED', `${domain} is listed twice`, [
        { path: `competitors.${i}.domain`, message: 'duplicate competitor domain' },
      ]);
    }
    seen.add(domain);
    const keep = c.id ? existing.find((e) => e._id.toHexString() === c.id) : undefined;
    return {
      _id: keep?._id ?? new Types.ObjectId(),
      name: c.name,
      domain,
      aliases: aliasesWith(c.name, c.aliases),
    };
  });
}

const brandExists = (domain: string) =>
  new AppError('BRAND_EXISTS', `You already track a brand on ${domain}`, { domain });

export interface BrandsServiceDeps {
  brandAI: BrandAI | null;
  logger: Logger;
}

export type BrandsService = ReturnType<typeof createBrandsService>;

export function createBrandsService(deps: BrandsServiceDeps) {
  async function planOf(ctx: Ctx) {
    const ws = await workspacesRepo.findById(ctx.workspaceId);
    if (!ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
    return { ws, plan: planFor(ws.plan.tier) };
  }

  return {
    /** Summary, ≤10 categories and alias suggestions from one web-search call (F-07, F-08). */
    async analyze(_ctx: Ctx, body: AnalyzeBrandBody): Promise<AnalyzeBrandResponse> {
      const { websiteUrl, domain } = normalizeWebsite(body.websiteUrl);
      const analysis = await callBrandAI(deps.brandAI, deps.logger, (ai, signal) =>
        ai.analyze({ name: body.name, websiteUrl, domain }, signal),
      );
      deps.logger.info(
        { costMicros: analysis.costMicros, model: analysis.model },
        'brand analyzed',
      );
      return {
        domain,
        websiteUrl,
        summary: analysis.summary,
        categories: analysis.categories,
        suggestedAliases: analysis.aliases,
      };
    },

    async list(ctx: Ctx): Promise<BrandListItem[]> {
      const [brands, promptCounts, scheduleCounts, latestRuns] = await Promise.all([
        brandsRepo.listActive(ctx),
        promptsRepo.countActiveByBrand(ctx),
        schedulesRepo.countActiveByBrand(ctx),
        runsRepo.latestPerBrand(ctx),
      ]);
      return brands.map((b) => {
        const id = b._id.toHexString();
        const run = latestRuns.get(id);
        return {
          ...toBrand(b),
          promptCount: promptCounts.get(id) ?? 0,
          activeSchedules: scheduleCounts.get(id) ?? 0,
          latestRun: run
            ? {
                id: run._id.toHexString(),
                status: run.status,
                createdAt: run.createdAt.toISOString(),
                visibility: isSettled(run) ? (run.aggregates?.total.visibility ?? null) : null,
              }
            : null,
        };
      });
    },

    async get(ctx: Ctx, id: string): Promise<Brand> {
      const brand = await brandsRepo.findById(ctx, id);
      if (!brand) throw notFound('Brand');
      return toBrand(brand);
    },

    /**
     * Creates a brand within the plan's brand limit (F-36). The workspace is locked inside the
     * transaction, so two concurrent creates can't both take the last slot.
     */
    async create(ctx: Ctx, body: CreateBrandBody): Promise<Brand> {
      const { websiteUrl, domain } = normalizeWebsite(body.websiteUrl);
      const { ws, plan } = await planOf(ctx);
      const defaults: BrandDefaults = body.defaults ?? {
        country: ws.settings.defaultCountry,
        city: null,
        language: ws.settings.defaultLanguage,
        scope: 'national',
        platforms: [...plan.limits.platforms],
      };
      assertPlatformsAllowed(plan, defaults.platforms);
      const competitors = buildCompetitors(body.competitors, domain);

      try {
        const doc = await withTransaction(async (session) => {
          await workspacesRepo.lock(session, ctx.workspaceId);
          assertBrandSlot(plan, await brandsRepo.countActive(ctx, session));
          if (await brandsRepo.findActiveByDomain(ctx, domain, session)) throw brandExists(domain);
          return brandsRepo.create(
            ctx,
            {
              name: body.name,
              domain,
              websiteUrl,
              aliases: aliasesWith(body.name, body.aliases),
              summary: body.summary,
              categories: body.categories,
              competitors,
              defaults,
            },
            session,
          );
        });
        return toBrand(doc);
      } catch (err) {
        if (isDuplicateKeyError(err, 'domain')) throw brandExists(domain);
        throw err;
      }
    },

    async update(ctx: Ctx, id: string, body: PatchBrandBody): Promise<Brand> {
      const current = await brandsRepo.findActiveById(ctx, id);
      if (!current) throw notFound('Brand');

      const patch: BrandPatch = {};
      if (body.websiteUrl !== undefined) {
        const site = normalizeWebsite(body.websiteUrl);
        if (site.domain !== current.domain) {
          const other = await brandsRepo.findActiveByDomain(ctx, site.domain);
          if (other) throw brandExists(site.domain);
          if (current.competitors.some((c) => c.domain === site.domain)) {
            throw new AppError(
              'VALIDATION_FAILED',
              'A tracked competitor already uses that domain',
            );
          }
        }
        Object.assign(patch, site);
      }
      if (body.name !== undefined) patch.name = body.name;
      if (body.summary !== undefined) patch.summary = body.summary;
      if (body.categories !== undefined) patch.categories = body.categories;
      if (body.name !== undefined || body.aliases !== undefined) {
        patch.aliases = aliasesWith(
          body.name ?? current.name,
          body.aliases ?? current.aliases.filter((a) => a !== current.name),
        );
      }
      if (body.defaults !== undefined) {
        assertPlatformsAllowed((await planOf(ctx)).plan, body.defaults.platforms);
        patch.defaults = body.defaults;
      }

      try {
        const updated = await brandsRepo.update(ctx, id, patch);
        if (!updated) throw notFound('Brand');
        return toBrand(updated);
      } catch (err) {
        if (isDuplicateKeyError(err, 'domain')) throw brandExists(patch.domain ?? current.domain);
        throw err;
      }
    },

    /** Replaces the tracked competitors (D-011: no limit of 3). Existing ids are kept. */
    async setCompetitors(ctx: Ctx, id: string, competitors: CompetitorInput[]): Promise<Brand> {
      const current: BrandDoc | null = await brandsRepo.findActiveById(ctx, id);
      if (!current) throw notFound('Brand');
      const next = buildCompetitors(competitors, current.domain, current.competitors);
      const updated = await brandsRepo.setCompetitors(ctx, id, next);
      if (!updated) throw notFound('Brand');
      return toBrand(updated);
    },

    /** Archives the brand and pauses its schedules, together. Runs are kept (F-18). */
    async archive(ctx: Ctx, id: string): Promise<void> {
      const archived = await withTransaction(async (session) => {
        if (!(await brandsRepo.archive(ctx, id, session))) return false;
        await schedulesRepo.pauseAllForBrand(ctx, id, 'brand_archived', session);
        return true;
      });
      if (!archived) throw notFound('Brand');
    },
  };
}
