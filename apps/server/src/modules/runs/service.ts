import { createHash } from 'node:crypto';
import { PROVIDER_OF } from '@pv/engine';
import {
  type CheckResultPage,
  type CountryCode,
  type CreateRunBody,
  type LanguageCode,
  type RunTrigger,
  type Scope,
  type EstimateRunBody,
  type ListResultsQuery,
  type ListRunsQuery,
  type Platform,
  type Run,
  type RunEstimate,
  type RunListResponse,
} from '@pv/shared';
import { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import type { Ctx } from '../../http/context';
import { AppError, notFound } from '../../http/errors';
import { jobsRepo } from '../../jobs/repo';
import { brandsRepo, type BrandDoc } from '../brands/repo';
import { reserveForRun } from '../credits/service';
import { promptsRepo, type PromptDoc } from '../prompts/repo';
import { RESULT_SCHEMA_VERSION, resultsRepo, type NewResult } from '../results/repo';
import { sharesRepo } from '../shares/repo';
import { assertPlatformsAllowed, assertPromptCount, planFor } from '../workspaces/limits';
import { workspacesRepo } from '../workspaces/repo';
import { buildRunWorkbook } from './exportXlsx';
import { creditRefId, enqueueFinalize } from './finalize';
import {
  isSettled,
  progressFromRun,
  progressOf,
  toCheckResult,
  toRun,
  toRunListItem,
} from './mapper';
import { runsRepo, type RunDoc } from './repo';

const sha1 = (parts: readonly string[]) =>
  createHash('sha1')
    .update([...parts].sort().join('\n'))
    .digest('hex')
    .slice(0, 16);

export interface RunsServiceDeps {
  logger: Logger;
  /** Platforms the server can run (an API key, or FAKE_PROVIDERS). */
  availablePlatforms: () => readonly Platform[];
  /** `engine@…` stamped on new runs. */
  engineVersion: string;
  aioLoadAsync: boolean;
  /** Tells this instance's worker that jobs were enqueued. */
  onEnqueued?: () => void;
  /** After a run reserved credits: the low-credit warning (10). Failures are only logged. */
  onCreditsReserved?: (workspaceId: Types.ObjectId) => Promise<void>;
}

/** Everything a run needs once the caller has checked it (manual, run-now, scheduled). */
export interface StartRunInput {
  workspaceId: Types.ObjectId;
  brand: BrandDoc;
  prompts: readonly PromptDoc[];
  platforms: readonly Platform[];
  location: { country: CountryCode; city: string | null; language: LanguageCode; scope: Scope };
  trigger: RunTrigger;
  scheduleId: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  idempotencyKey: string;
}

export type RunsService = ReturnType<typeof createRunsService>;

export function createRunsService(deps: RunsServiceDeps) {
  async function planOf(ctx: Ctx) {
    const ws = await workspacesRepo.findById(ctx.workspaceId);
    if (!ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
    return { ws, plan: planFor(ws.plan.tier) };
  }

  async function findRun(ctx: Ctx, id: string): Promise<RunDoc> {
    const run = await runsRepo.findById(ctx, id);
    if (!run) throw notFound('Run');
    return run;
  }

  async function view(ctx: Ctx, run: RunDoc): Promise<Run> {
    const progress = isSettled(run)
      ? progressFromRun(run)
      : progressOf(await resultsRepo.statusCounts(ctx, run._id));
    return toRun(run, progress);
  }

  /** Validates brand, plan limits and prompts the same way for estimate and create. */
  async function checkInput(
    ctx: Ctx,
    body: Pick<CreateRunBody, 'brandId' | 'promptIds' | 'platforms'>,
  ) {
    const brand = await brandsRepo.findActiveById(ctx, body.brandId);
    if (!brand) throw notFound('Brand');
    const { ws, plan } = await planOf(ctx);
    assertPlatformsAllowed(plan, body.platforms);
    assertPromptCount(plan, body.promptIds.length);
    return { brand, ws };
  }

  /** A platform the server has no key for is refused before any credit is reserved (D-023). */
  function assertAvailable(platforms: readonly Platform[]): void {
    const available = deps.availablePlatforms();
    const missing = platforms.filter((p) => !available.includes(p));
    if (missing.length) {
      throw new AppError(
        'UPSTREAM_UNAVAILABLE',
        `Not available on this server right now: ${missing.join(', ')}`,
        { platforms: missing },
      );
    }
  }

  /**
   * Starts a run (04 § Creating a run), in one transaction: reserve credits (plan first), insert
   * the run with a frozen brand snapshot, one pending result per check and one `check` job per
   * result. The idempotency key is unique per workspace, so a replay (or a scheduler tick on a
   * second instance) returns the existing run with `created: false`. The caller has already
   * checked the brand, plan limits and prompts. Throws `INSUFFICIENT_CREDITS` (402).
   */
  async function startRun(input: StartRunInput): Promise<{ run: RunDoc; created: boolean }> {
    const scope = { workspaceId: input.workspaceId.toHexString() };
    const existing = await runsRepo.findByIdempotencyKey(scope, input.idempotencyKey);
    if (existing) return { run: existing, created: false };

    const { brand, prompts, platforms, workspaceId } = input;
    const runId = new Types.ObjectId();
    const cost = prompts.length * platforms.length;
    const what = input.trigger === 'scheduled' ? 'Scheduled run' : 'Run';
    try {
      await withTransaction(async (session) => {
        const split = await reserveForRun(session, {
          workspaceId,
          refId: creditRefId(runId, 1),
          cost,
          note: `${what}: ${prompts.length} prompt${prompts.length === 1 ? '' : 's'} × ${platforms.length} platform${platforms.length === 1 ? '' : 's'}`,
          actorUserId: input.createdBy,
        });
        await runsRepo.insert(session, {
          _id: runId,
          workspaceId,
          brandId: brand._id,
          trigger: input.trigger,
          scheduleId: input.scheduleId,
          createdBy: input.createdBy,
          idempotencyKey: input.idempotencyKey,
          config: {
            platforms: [...platforms],
            country: input.location.country,
            city: input.location.city,
            language: input.location.language,
            scope: input.location.scope,
            aioLoadAsync: deps.aioLoadAsync,
          },
          brandSnapshot: {
            name: brand.name,
            domain: brand.domain,
            aliases: [...brand.aliases],
            competitors: brand.competitors.map((c) => ({
              _id: c._id,
              name: c.name,
              domain: c.domain,
              aliases: [...c.aliases],
            })),
          },
          promptIds: prompts.map((p) => p._id),
          promptSetHash: sha1(prompts.map((p) => p._id.toHexString())),
          platformsHash: sha1(platforms),
          status: 'queued',
          counts: { total: cost, ok: 0, noAnswer: 0, failed: 0, canceled: 0 },
          credits: {
            reserved: cost,
            charged: 0,
            refunded: 0,
            split,
            refundedSplit: { plan: 0, purchased: 0 },
          },
          aggregates: null,
          engineVersion: deps.engineVersion,
          metricsVersion: null,
          models: {},
          costMicros: 0,
          generation: 1,
          finalizedGen: 0,
          startedAt: null,
          finishedAt: null,
          canceledAt: null,
          error: null,
        });
        const results: NewResult[] = prompts.flatMap((p) =>
          platforms.map((platform) => ({
            _id: new Types.ObjectId(),
            workspaceId,
            runId,
            brandId: brand._id,
            promptId: p._id,
            promptText: p.text,
            category: p.category,
            platform,
            status: 'pending' as const,
            answer: '',
            citations: [],
            vendors: [],
            suggested: [],
            brand: { mentioned: false, rank: null, cited: false, citedUrl: null, snippet: null },
            competitors: [],
            model: '',
            latencyMs: 0,
            costMicros: 0,
            attempts: 0,
            error: null,
            leaseId: null,
            engineVersion: null,
            schemaVersion: RESULT_SCHEMA_VERSION,
            finishedAt: null,
          })),
        );
        await resultsRepo.insertMany(session, results);
        await jobsRepo.insertMany(
          session,
          results.map((r) => ({
            type: 'check' as const,
            payload: { resultId: r._id.toHexString() },
            workspaceId,
            runId,
            providerKey: PROVIDER_OF[r.platform],
          })),
        );
      });
    } catch (err) {
      if (isDuplicateKeyError(err, 'idempotencyKey')) {
        const winner = await runsRepo.findByIdempotencyKey(scope, input.idempotencyKey);
        if (winner) return { run: winner, created: false };
      }
      throw err;
    }
    deps.logger.info({ runId, checks: cost, trigger: input.trigger }, 'run created');
    deps.onEnqueued?.();
    if (deps.onCreditsReserved) {
      await deps.onCreditsReserved(workspaceId).catch((err: unknown) => {
        deps.logger.error({ err, workspaceId }, 'low-credit check failed');
      });
    }
    const run = await runsRepo.findById(scope, runId);
    if (!run) throw new Error(`run ${runId.toHexString()} vanished after creation`);
    return { run, created: true };
  }

  return {
    /** `POST /runs/estimate`: what a run would cost and whether the balance covers it. */
    async estimate(ctx: Ctx, body: EstimateRunBody): Promise<RunEstimate> {
      const { ws } = await checkInput(ctx, body);
      const credits = body.promptIds.length * body.platforms.length;
      return {
        checks: credits,
        credits,
        balance: { plan: ws.credits.plan, purchased: ws.credits.purchased },
        sufficient: ws.credits.plan + ws.credits.purchased >= credits,
      };
    },

    /**
     * `POST /runs` (04 § Creating a run): checks the brand, plan limits, prompts and platforms,
     * then starts the run. A retry with the same Idempotency-Key returns the same run.
     */
    async create(
      ctx: Ctx,
      body: CreateRunBody,
      idempotencyKey: string,
    ): Promise<{ run: Run; created: boolean }> {
      const existing = await runsRepo.findByIdempotencyKey(ctx, idempotencyKey);
      if (existing) return { run: await view(ctx, existing), created: false };

      const { brand } = await checkInput(ctx, body);
      assertAvailable(body.platforms);
      const found = await promptsRepo.findActiveByIds(ctx, body.brandId, body.promptIds);
      const byId = new Map(found.map((p) => [p._id.toHexString(), p]));
      const prompts = body.promptIds
        .map((id) => byId.get(id))
        .filter((p): p is PromptDoc => p !== undefined);
      if (prompts.length !== body.promptIds.length) {
        throw new AppError(
          'VALIDATION_FAILED',
          "Some prompts are archived or don't belong to this brand",
          [{ path: 'promptIds', message: 'unknown or archived prompt' }],
        );
      }
      const started = await startRun({
        workspaceId: new Types.ObjectId(ctx.workspaceId),
        brand,
        prompts,
        platforms: body.platforms,
        location: {
          country: body.country,
          city: body.city,
          language: body.language,
          scope: body.scope,
        },
        trigger: 'manual',
        scheduleId: null,
        createdBy: new Types.ObjectId(ctx.userId),
        idempotencyKey,
      });
      return { run: await view(ctx, started.run), created: started.created };
    },

    startRun,
    view,
    assertAvailable,

    async get(ctx: Ctx, id: string): Promise<Run> {
      return view(ctx, await findRun(ctx, id));
    },

    async list(ctx: Ctx, query: ListRunsQuery): Promise<RunListResponse> {
      const runs = await runsRepo.list(ctx, { ...query }, query.cursor, query.limit + 1);
      const page = runs.slice(0, query.limit);
      const live = page.filter((r) => !isSettled(r));
      const counts = await resultsRepo.statusCountsMany(
        ctx,
        live.map((r) => r._id),
      );
      return {
        items: page.map((r) => {
          const c = counts.get(r._id.toHexString());
          return toRunListItem(r, c ? progressOf(c) : null);
        }),
        nextCursor: runs.length > query.limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
      };
    },

    async results(ctx: Ctx, id: string, query: ListResultsQuery): Promise<CheckResultPage> {
      await findRun(ctx, id);
      const rows = await resultsRepo.list(ctx, id, query, query.cursor, query.limit + 1);
      const page = rows.slice(0, query.limit);
      return {
        items: page.map(toCheckResult),
        nextCursor: rows.length > query.limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
      };
    },

    /**
     * `POST /runs/:id/cancel` (04 § Cancel, F-41): queued checks are canceled, running ones
     * finish normally, and finalize refunds what didn't run. Canceling twice is a no-op.
     */
    async cancel(ctx: Ctx, id: string): Promise<Run> {
      const run = await findRun(ctx, id);
      if (run.status === 'canceled' && isSettled(run)) return view(ctx, run);
      if (run.status !== 'canceled' && !(await runsRepo.cancel(ctx, id))) {
        const now = await findRun(ctx, id);
        if (now.status !== 'canceled') {
          throw new AppError('CONFLICT', 'This run has already finished', { status: now.status });
        }
      }
      const resultIds = await jobsRepo.cancelQueuedChecks(run._id);
      await resultsRepo.cancelOpen(ctx, id, resultIds);
      await enqueueFinalize(ctx, run._id);
      deps.onEnqueued?.();
      deps.logger.info({ runId: id }, 'run canceled');
      return view(ctx, await findRun(ctx, id));
    },

    /** `DELETE /runs/:id`: final runs only. Ledger rows stay: they are history (04). */
    async remove(ctx: Ctx, id: string): Promise<void> {
      const run = await findRun(ctx, id);
      if (!isSettled(run)) {
        throw new AppError('RUN_NOT_FINAL', 'Wait for the run to finish, or cancel it first');
      }
      await withTransaction(async (session) => {
        if (!(await runsRepo.deleteFinal(session, ctx, id))) throw notFound('Run');
        await resultsRepo.deleteForRun(session, ctx, run._id);
        await sharesRepo.deleteForRun(session, ctx, run._id);
        await jobsRepo.deleteForRun(session, run._id);
      });
    },

    /** `GET /runs/:id/export.xlsx` (F-39). */
    async exportXlsx(ctx: Ctx, id: string): Promise<{ filename: string; body: Buffer }> {
      const run = await findRun(ctx, id);
      if (!isSettled(run)) {
        throw new AppError('RUN_NOT_FINAL', 'The export is ready once the run has finished');
      }
      const results = await resultsRepo.listAll(ctx, run._id);
      const body = await buildRunWorkbook(run, results);
      const date = run.createdAt.toISOString().slice(0, 10);
      const safeName = run.brandSnapshot.name.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'brand';
      return { filename: `${safeName}-${date}-promptverse.xlsx`, body };
    },
  };
}
