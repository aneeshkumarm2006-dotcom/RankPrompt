import {
  MAX_SCHEDULES_PER_BRAND,
  PLATFORM_LABELS,
  frequencySummary,
  scheduleConfigSchema,
  type CreateScheduleBody,
  type PatchScheduleBody,
  type Plan,
  type Platform,
  type Run,
  type Schedule,
  type ScheduleSkipReason,
} from '@pv/shared';
import { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import type { EmailOutbox } from '../../emails/outbox';
import type { EmailTemplates } from '../../emails/templates';
import type { Ctx } from '../../http/context';
import { AppError, notFound } from '../../http/errors';
import { brandsRepo, type BrandDoc } from '../brands/repo';
import { promptsRepo, type PromptDoc } from '../prompts/repo';
import { runsRepo } from '../runs/repo';
import type { RunsService } from '../runs/service';
import { usersRepo } from '../users/repo';
import { assertPlatformsAllowed, assertPromptCount, planFor } from '../workspaces/limits';
import { workspacesRepo } from '../workspaces/repo';
import { toSchedule } from './mapper';
import { schedulesRepo, type NewSchedule, type ScheduleDoc, type SchedulePatch } from './repo';
import { TIMING_FIELDS, isValidTimezone, nextSlotAfter } from './timing';

type Scope = Pick<Ctx, 'workspaceId'>;
type Config = CreateScheduleBody;

/** Credit skips in a row that pause a schedule (10 § Scheduler tick). */
export const AUTO_PAUSE_AFTER_SKIPS = 3;

/** The idempotency key of a scheduled slot's run (10): `schedule:<id>:<slotISO>`. */
export const slotRunKey = (scheduleId: Types.ObjectId, slot: Date): string =>
  `schedule:${scheduleId.toHexString()}:${slot.toISOString()}`;

/** What a schedule would run right now, after the plan and the prompt library have had a say. */
interface Resolved {
  prompts: PromptDoc[];
  platforms: Platform[];
  /** In the schedule but not in the plan (10: dropped, the user is emailed once). */
  dropped: Platform[];
}

/** What the scheduler did with one slot. */
export type SlotOutcome =
  | { kind: 'run'; runId: Types.ObjectId; created: boolean }
  | { kind: 'skipped'; reason: ScheduleSkipReason; paused: boolean }
  | { kind: 'paused_brand_gone' }
  /** Another instance finished this slot first. */
  | { kind: 'already' };

const sortIds = (ids: readonly string[]) => [...new Set(ids)].sort();

/** The parts of a config that are the same whatever the frequency (unused day fields cleared). */
function normalize(c: Config): Config {
  return {
    ...c,
    weekday: c.frequency === 'weekly' ? c.weekday : null,
    dayOfMonth: c.frequency === 'monthly' ? c.dayOfMonth : null,
    city: c.scope === 'local' ? c.city : null,
    promptSelection: {
      mode: c.promptSelection.mode,
      promptIds: c.promptSelection.mode === 'fixed' ? sortIds(c.promptSelection.promptIds) : [],
    },
  };
}

/** The doc as an API-shaped config, so a PATCH can be merged and checked as a whole. */
function configOf(s: ScheduleDoc): Config {
  return {
    brandId: s.brandId.toHexString(),
    label: s.label,
    frequency: s.frequency,
    hour: s.hour,
    timezone: s.timezone,
    weekday: s.weekday,
    dayOfMonth: s.dayOfMonth,
    platforms: [...s.platforms],
    promptSelection: {
      mode: s.promptSelection.mode,
      promptIds: s.promptSelection.promptIds.map((id) => id.toHexString()),
    },
    country: s.country as Config['country'],
    city: s.city,
    language: s.language as Config['language'],
    scope: s.scope,
  };
}

const fieldError = (path: string, message: string) =>
  new AppError('VALIDATION_FAILED', message, [{ path, message }]);

export function createSchedulesService(deps: {
  runs: RunsService;
  emails: EmailOutbox;
  appUrl: string;
  logger: Logger;
  reporter: ErrorReporter;
  now?: () => Date;
}) {
  const now = () => deps.now?.() ?? new Date();
  const scheduleLink = (brandId: Types.ObjectId | string) =>
    `${deps.appUrl}/app/brands/${String(brandId)}/schedules`;
  const billingLink = `${deps.appUrl}/app/billing`;

  async function planOf(scope: Scope): Promise<Plan> {
    const ws = await workspacesRepo.findById(scope.workspaceId);
    if (!ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
    return planFor(ws.plan.tier);
  }

  async function activeBrand(scope: Scope, id: string | Types.ObjectId): Promise<BrandDoc> {
    const brand = await brandsRepo.findActiveById(scope, String(id));
    if (!brand) throw notFound('Brand');
    return brand;
  }

  async function findSchedule(scope: Scope, id: string): Promise<ScheduleDoc> {
    const s = await schedulesRepo.findById(scope, id);
    if (!s) throw notFound('Schedule');
    return s;
  }

  /** A schedule whose brand is archived is read-only (D-022): changes are a 404. */
  async function findEditable(scope: Scope, id: string) {
    const s = await findSchedule(scope, id);
    const brand = await brandsRepo.findActiveById(scope, s.brandId.toHexString());
    if (!brand) throw notFound('Schedule');
    return { s, brand };
  }

  /** Checks a whole config against the plan and the brand's prompts (create and PATCH alike). */
  async function check(scope: Scope, c: Config, plan: Plan): Promise<void> {
    if (!isValidTimezone(c.timezone)) throw fieldError('timezone', 'Choose a valid time zone');
    if (!plan.limits.scheduleFrequencies.includes(c.frequency)) {
      throw fieldError(
        'frequency',
        `Your ${plan.name} plan allows ${plan.limits.scheduleFrequencies.join(' and ')} schedules`,
      );
    }
    assertPlatformsAllowed(plan, c.platforms);
    if (c.promptSelection.mode === 'fixed') {
      const ids = c.promptSelection.promptIds;
      assertPromptCount(plan, ids.length);
      const found = await promptsRepo.findActiveByIds(scope, c.brandId, ids);
      if (found.length !== ids.length) {
        throw fieldError(
          'promptSelection.promptIds',
          "Some prompts are archived or don't belong to this brand",
        );
      }
    }
  }

  /**
   * The prompts and platforms a run would use now (10): `all_active` takes the brand's active
   * prompts at this moment, `fixed` its ids minus archived ones; both are capped at the plan's
   * prompts per run (oldest first). Platforms outside the plan are dropped.
   */
  async function resolve(scope: Scope, s: ScheduleDoc, plan: Plan, active?: PromptDoc[]) {
    const brandId = s.brandId.toHexString();
    let prompts: PromptDoc[];
    if (s.promptSelection.mode === 'all_active') {
      prompts = active ?? (await promptsRepo.listForBrand(scope, brandId, false));
    } else {
      const ids = s.promptSelection.promptIds.map((id) => id.toHexString());
      prompts = active
        ? active.filter((p) => ids.includes(p._id.toHexString()))
        : await promptsRepo.findActiveByIds(scope, brandId, ids);
      prompts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    const platforms = s.platforms.filter((p) => plan.limits.platforms.includes(p));
    return {
      prompts: prompts.slice(0, plan.limits.maxPromptsPerRun),
      platforms,
      dropped: s.platforms.filter((p) => !platforms.includes(p)),
    } satisfies Resolved;
  }

  const creditsOf = (r: Resolved) => r.prompts.length * r.platforms.length;

  async function view(scope: Scope, s: ScheduleDoc, plan?: Plan): Promise<Schedule> {
    return toSchedule(s, creditsOf(await resolve(scope, s, plan ?? (await planOf(scope)))));
  }

  /** Data for `schedule_created` / `schedule_updated`, for one recipient. */
  function scheduleEmail(
    s: ScheduleDoc,
    brand: BrandDoc,
    name: string,
    creditsPerRun: number,
  ): EmailTemplates['schedule_created'] {
    return {
      name,
      brandName: brand.name,
      scheduleLabel: s.label,
      timing: frequencySummary(s),
      timezone: s.timezone,
      platforms: s.platforms.map((p) => PLATFORM_LABELS[p]),
      prompts:
        s.promptSelection.mode === 'all_active'
          ? 'All active prompts'
          : `${s.promptSelection.promptIds.length} fixed prompt${s.promptSelection.promptIds.length === 1 ? '' : 's'}`,
      creditsPerRun,
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
      scheduleLink: scheduleLink(brand._id),
    };
  }

  /** `schedule_created` / `schedule_updated` go to the user who made the change. */
  async function emailActor<T extends 'schedule_created' | 'schedule_updated'>(
    ctx: Ctx,
    template: T,
    idempotencyKey: string,
    data: (name: string) => EmailTemplates[T],
  ): Promise<void> {
    const user = await usersRepo.findById(ctx.userId);
    if (!user) return;
    await deps.emails.sendQuietly({
      template,
      to: user.email,
      data: data(user.name),
      idempotencyKey,
      userId: user._id,
      workspaceId: new Types.ObjectId(ctx.workspaceId),
    });
  }

  // ---- Scheduler -----------------------------------------------------------------------------

  /** Emails go to the workspace owners; the schedule, brand and links are the same for each. */
  function ownersEmail<T extends keyof EmailTemplates>(
    s: ScheduleDoc,
    template: T,
    key: string,
    data: (name: string) => EmailTemplates[T],
  ): Promise<number> {
    return deps.emails.toOwners(s.workspaceId, template, key, (user) => data(user.name));
  }

  async function skipSlot(
    s: ScheduleDoc,
    slot: Date,
    reason: ScheduleSkipReason,
  ): Promise<SlotOutcome> {
    const done = await schedulesRepo.finishWithSkip(s._id, slot, reason, false);
    if (!done) return { kind: 'already' };
    deps.logger.warn({ scheduleId: s._id, slot, reason }, 'scheduled run skipped');
    return { kind: 'skipped', reason, paused: false };
  }

  /**
   * Not enough credits (10): the owners hear about the skip (`skip:<id>:<slot>`), and on the third
   * skip in a row the schedule pauses itself (`paused:<id>:<date>`). The emails are queued before
   * the slot is marked done; their keys make a retried slot queue nothing new.
   */
  async function creditSkip(
    s: ScheduleDoc,
    brand: BrandDoc,
    slot: Date,
    needed: number,
  ): Promise<SlotOutcome> {
    const ws = await workspacesRepo.findById(s.workspaceId);
    const balance = ws ? ws.credits.plan + ws.credits.purchased : 0;
    const skips = s.consecutiveSkips + 1;
    const pauses = skips >= AUTO_PAUSE_AFTER_SKIPS;
    const slotIso = slot.toISOString();
    await ownersEmail(
      s,
      'run_skipped_low_credits',
      `skip:${s._id.toHexString()}:${slotIso}`,
      (name) => ({
        name,
        brandName: brand.name,
        scheduleLabel: s.label,
        needed,
        balance,
        skipsInARow: skips,
        billingLink,
        scheduleLink: scheduleLink(brand._id),
      }),
    );
    if (pauses) {
      await ownersEmail(
        s,
        'schedule_paused',
        `paused:${s._id.toHexString()}:${slotIso.slice(0, 10)}`,
        (name) => ({
          name,
          brandName: brand.name,
          scheduleLabel: s.label,
          billingLink,
          scheduleLink: scheduleLink(brand._id),
        }),
      );
    }
    const done = await schedulesRepo.finishWithSkip(s._id, slot, 'insufficient_credits', true);
    if (!done) return { kind: 'already' };
    const paused =
      done.consecutiveSkips >= AUTO_PAUSE_AFTER_SKIPS &&
      (await schedulesRepo.autoPause(s._id, 'insufficient_credits'));
    deps.logger.warn(
      { scheduleId: s._id, slot, needed, balance, skips: done.consecutiveSkips, paused },
      'scheduled run skipped: not enough credits',
    );
    return { kind: 'skipped', reason: 'insufficient_credits', paused };
  }

  return {
    async list(ctx: Ctx, brandId: string): Promise<Schedule[]> {
      const brand = await brandsRepo.findById(ctx, brandId);
      if (!brand) throw notFound('Brand');
      const [plan, schedules, active] = await Promise.all([
        planOf(ctx),
        schedulesRepo.listForBrand(ctx, brandId),
        promptsRepo.listForBrand(ctx, brandId, false),
      ]);
      return Promise.all(
        schedules.map(async (s) => toSchedule(s, creditsOf(await resolve(ctx, s, plan, active)))),
      );
    },

    /** `POST /schedules` (08). The first slot is the next one after now. */
    async create(ctx: Ctx, body: CreateScheduleBody): Promise<Schedule> {
      const brand = await activeBrand(ctx, body.brandId);
      const plan = await planOf(ctx);
      const c = normalize(body);
      await check(ctx, c, plan);
      if ((await schedulesRepo.countForBrand(ctx, body.brandId)) >= MAX_SCHEDULES_PER_BRAND) {
        throw new AppError(
          'CONFLICT',
          `A brand can have up to ${MAX_SCHEDULES_PER_BRAND} schedules. Delete one to add another.`,
        );
      }
      const doc: NewSchedule = {
        workspaceId: new Types.ObjectId(ctx.workspaceId),
        brandId: brand._id,
        label: c.label,
        frequency: c.frequency,
        hour: c.hour,
        timezone: c.timezone,
        weekday: c.weekday,
        dayOfMonth: c.dayOfMonth,
        platforms: [...c.platforms],
        promptSelection: {
          mode: c.promptSelection.mode,
          promptIds: c.promptSelection.promptIds.map((id) => new Types.ObjectId(id)),
        },
        country: c.country,
        city: c.city,
        language: c.language,
        scope: c.scope,
        nextRunAt: nextSlotAfter(c, now()),
      };
      const s = await schedulesRepo.insert(doc);
      const dto = await view(ctx, s, plan);
      await emailActor(ctx, 'schedule_created', `schedule_created:${s._id.toHexString()}`, (name) =>
        scheduleEmail(s, brand, name, dto.creditsPerRun),
      );
      deps.logger.info({ scheduleId: s._id, nextRunAt: s.nextRunAt }, 'schedule created');
      return dto;
    },

    /**
     * `PATCH /schedules/:id` (08): the patch is merged with the stored config and checked as a
     * whole. A timing change recomputes `nextRunAt` (if active); a change to what runs or when
     * emails `schedule_updated`.
     */
    async update(ctx: Ctx, id: string, patch: PatchScheduleBody): Promise<Schedule> {
      const { s, brand } = await findEditable(ctx, id);
      const before = configOf(s);
      const merged = normalize({
        ...before,
        ...scheduleConfigSchema.parse({ ...before, ...patch }),
        brandId: before.brandId,
      });
      const plan = await planOf(ctx);
      await check(ctx, merged, plan);

      const changed = (k: keyof Config) => JSON.stringify(before[k]) !== JSON.stringify(merged[k]);
      const timingChanged = TIMING_FIELDS.some(changed);
      const set: SchedulePatch = {
        label: merged.label,
        frequency: merged.frequency,
        hour: merged.hour,
        timezone: merged.timezone,
        weekday: merged.weekday,
        dayOfMonth: merged.dayOfMonth,
        platforms: [...merged.platforms],
        promptSelection: {
          mode: merged.promptSelection.mode,
          promptIds: merged.promptSelection.promptIds.map((p) => new Types.ObjectId(p)),
        },
        country: merged.country,
        city: merged.city,
        language: merged.language,
        scope: merged.scope,
        ...(timingChanged && s.isActive ? { nextRunAt: nextSlotAfter(merged, now()) } : {}),
      };
      const updated = await schedulesRepo.update(ctx, id, set);
      if (!updated) throw notFound('Schedule');
      const dto = await view(ctx, updated, plan);

      const changes = [
        ...(timingChanged ? ['timing'] : []),
        ...(changed('platforms') ? ['platforms'] : []),
        ...(changed('promptSelection') ? ['prompts'] : []),
      ];
      if (changes.length) {
        await emailActor(
          ctx,
          'schedule_updated',
          `schedule_updated:${id}:${updated.updatedAt.toISOString()}`,
          (name) => ({ ...scheduleEmail(updated, brand, name, dto.creditsPerRun), changes }),
        );
      }
      return dto;
    },

    async pause(ctx: Ctx, id: string): Promise<Schedule> {
      await findEditable(ctx, id);
      const s = await schedulesRepo.pause(ctx, id);
      if (!s) throw notFound('Schedule');
      return view(ctx, s);
    },

    /** Resumes from now (never replays missed slots) and clears the skip streak (08). */
    async resume(ctx: Ctx, id: string): Promise<Schedule> {
      const { s: current } = await findEditable(ctx, id);
      const plan = await planOf(ctx);
      if (!plan.limits.scheduleFrequencies.includes(current.frequency)) {
        throw fieldError(
          'frequency',
          `Your ${plan.name} plan allows ${plan.limits.scheduleFrequencies.join(' and ')} schedules. Edit the schedule first.`,
        );
      }
      const s = await schedulesRepo.resume(ctx, id, nextSlotAfter(current, now()));
      if (!s) throw notFound('Schedule');
      return view(ctx, s, plan);
    },

    async remove(ctx: Ctx, id: string): Promise<void> {
      if (!(await schedulesRepo.remove(ctx, id))) throw notFound('Schedule');
    },

    /**
     * `POST /schedules/:id/run-now` (08): `POST /runs` with the schedule's config. A manual run
     * (it isn't a slot), linked to the schedule, and its last run from now on.
     */
    async runNow(
      ctx: Ctx,
      id: string,
      idempotencyKey: string,
    ): Promise<{ run: Run; created: boolean }> {
      const existing = await runsRepo.findByIdempotencyKey(ctx, idempotencyKey);
      if (existing) return { run: await deps.runs.view(ctx, existing), created: false };
      const { s, brand } = await findEditable(ctx, id);
      const plan = await planOf(ctx);
      const r = await resolve(ctx, s, plan);
      if (r.prompts.length === 0) {
        throw fieldError('promptSelection', 'This schedule has no active prompts to run');
      }
      if (r.platforms.length === 0) assertPlatformsAllowed(plan, s.platforms);
      deps.runs.assertAvailable(r.platforms);
      const started = await deps.runs.startRun({
        workspaceId: s.workspaceId,
        brand,
        prompts: r.prompts,
        platforms: r.platforms,
        location: {
          country: s.country as Config['country'],
          city: s.city,
          language: s.language as Config['language'],
          scope: s.scope,
        },
        trigger: 'manual',
        scheduleId: s._id,
        createdBy: new Types.ObjectId(ctx.userId),
        idempotencyKey,
      });
      if (started.created) await schedulesRepo.recordRun(ctx, s._id, started.run._id);
      return { run: await deps.runs.view(ctx, started.run), created: started.created };
    },

    /**
     * One claimed slot (10 § Scheduler tick), safe to run again for the same slot: its run's
     * idempotency key is `schedule:<id>:<slot>`, its emails have slot keys, and every state change
     * is fenced on the slot still being in flight.
     */
    async runSlot(s: ScheduleDoc, slot: Date): Promise<SlotOutcome> {
      const scope = { workspaceId: s.workspaceId.toHexString() };
      const key = slotRunKey(s._id, slot);

      const existing = await runsRepo.findByIdempotencyKey(scope, key);
      if (existing) {
        await schedulesRepo.finishWithRun(s._id, slot, existing._id);
        return { kind: 'run', runId: existing._id, created: false };
      }

      const brand = await brandsRepo.findActiveById(scope, s.brandId.toHexString());
      if (!brand) {
        // Archiving pauses schedules in the same transaction; this covers one claimed meanwhile.
        await schedulesRepo.autoPause(s._id, 'brand_archived');
        await schedulesRepo.release(s._id, slot);
        return { kind: 'paused_brand_gone' };
      }

      const plan = await planOf(scope);
      const r = await resolve(scope, s, plan);
      if (r.dropped.length) {
        await ownersEmail(
          s,
          'schedule_platforms_dropped',
          `dropped:${s._id.toHexString()}:${[...r.dropped].sort().join(',')}`,
          (name) => ({
            name,
            brandName: brand.name,
            scheduleLabel: s.label,
            dropped: r.dropped.map((p) => PLATFORM_LABELS[p]),
            kept: r.platforms.map((p) => PLATFORM_LABELS[p]),
            billingLink,
            scheduleLink: scheduleLink(brand._id),
          }),
        );
      }
      // A platform this server has no key for: an operator problem, not the user's. Run the rest.
      const available = r.platforms.filter((p) => {
        try {
          deps.runs.assertAvailable([p]);
          return true;
        } catch {
          return false;
        }
      });
      if (available.length < r.platforms.length) {
        const missing = r.platforms.filter((p) => !available.includes(p));
        deps.logger.error({ scheduleId: s._id, missing }, 'scheduled run: platforms unavailable');
        deps.reporter.capture(new Error('scheduled run: platforms unavailable on this server'), {
          scheduleId: s._id.toHexString(),
          missing: missing.join(','),
        });
      }
      if (r.prompts.length === 0) return skipSlot(s, slot, 'no_prompts');
      if (available.length === 0) return skipSlot(s, slot, 'no_platforms');

      try {
        const started = await deps.runs.startRun({
          workspaceId: s.workspaceId,
          brand,
          prompts: r.prompts,
          platforms: available,
          location: {
            country: s.country as Config['country'],
            city: s.city,
            language: s.language as Config['language'],
            scope: s.scope,
          },
          trigger: 'scheduled',
          scheduleId: s._id,
          createdBy: null,
          idempotencyKey: key,
        });
        if (!(await schedulesRepo.finishWithRun(s._id, slot, started.run._id))) {
          return { kind: 'already' };
        }
        return { kind: 'run', runId: started.run._id, created: started.created };
      } catch (err) {
        if (err instanceof AppError && err.code === 'INSUFFICIENT_CREDITS') {
          return creditSkip(s, brand, slot, r.prompts.length * available.length);
        }
        throw err;
      }
    },
  };
}

export type SchedulesService = ReturnType<typeof createSchedulesService>;
