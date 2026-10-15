import { z } from 'zod';
import { countryCodeSchema } from '../countries';
import { platformSchema, scheduleFrequencySchema, scopeSchema } from '../enums';
import { languageCodeSchema } from '../languages';
import { platformsSchema } from './brands';
import { isoDateSchema, objectIdSchema, textSchema } from './common';
import { MAX_PROMPTS_PER_REQUEST } from './prompts';

/** Schedules (08 § Schedules, 10). */

export const PROMPT_SELECTION_MODES = ['all_active', 'fixed'] as const;
export const promptSelectionModeSchema = z.enum(PROMPT_SELECTION_MODES);
export type PromptSelectionMode = z.infer<typeof promptSelectionModeSchema>;

export const SCHEDULE_PAUSED_REASONS = ['user', 'insufficient_credits', 'brand_archived'] as const;
export const schedulePausedReasonSchema = z.enum(SCHEDULE_PAUSED_REASONS);
export type SchedulePausedReason = z.infer<typeof schedulePausedReasonSchema>;

/** Why the scheduler skipped a slot instead of starting a run (10 § Scheduler tick). */
export const SCHEDULE_SKIP_REASONS = [
  'insufficient_credits',
  'no_prompts',
  'no_platforms',
] as const;
export const scheduleSkipReasonSchema = z.enum(SCHEDULE_SKIP_REASONS);
export type ScheduleSkipReason = z.infer<typeof scheduleSkipReasonSchema>;

/** Scheduled runs a brand may have (each one costs credits on every slot). */
export const MAX_SCHEDULES_PER_BRAND = 10;

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** `9` → `09:00`. Schedules always start on the hour (10 § Schedule semantics). */
export const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** `1` → `1st`, `22` → `22nd`. Days of the month are 1–28. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export interface ScheduleTimingLike {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  timezone: string;
  weekday: number | null;
  dayOfMonth: number | null;
}

/** "Weekly on Monday at 09:00 America/Toronto" (the web app and the emails say it the same way). */
export function frequencySummary(s: ScheduleTimingLike): string {
  const at = `at ${hourLabel(s.hour)} ${s.timezone}`;
  if (s.frequency === 'weekly' && s.weekday !== null) {
    return `Weekly on ${WEEKDAY_NAMES[s.weekday] ?? '?'} ${at}`;
  }
  if (s.frequency === 'monthly' && s.dayOfMonth !== null) {
    return `Monthly on the ${ordinal(s.dayOfMonth)} ${at}`;
  }
  const label = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[s.frequency];
  return `${label} ${at}`;
}

/** An IANA zone name such as `America/Toronto`; the server checks it really exists. */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$|^UTC$/, 'Choose a time zone');

export const promptSelectionSchema = z
  .object({
    mode: promptSelectionModeSchema,
    promptIds: z.array(objectIdSchema).max(MAX_PROMPTS_PER_REQUEST).default([]),
  })
  .refine((s) => s.mode !== 'fixed' || s.promptIds.length > 0, {
    message: 'Pick at least one prompt',
    path: ['promptIds'],
  });

/** The fields with no defaults, so a partial PATCH only carries what the client sent. */
const scheduleFieldShape = {
  label: textSchema(0, 100),
  frequency: scheduleFrequencySchema,
  hour: z.number().int().min(0).max(23),
  timezone: timezoneSchema,
  /** 0 = Sunday. Weekly schedules only. */
  weekday: z.number().int().min(0).max(6).nullable(),
  /** 1–28, so every month has the day. Monthly schedules only. */
  dayOfMonth: z.number().int().min(1).max(28).nullable(),
  platforms: platformsSchema,
  promptSelection: promptSelectionSchema,
  country: countryCodeSchema,
  city: textSchema(1, 100).nullable(),
  language: languageCodeSchema,
  scope: scopeSchema,
};

const scheduleFieldsSchema = z.object({
  ...scheduleFieldShape,
  label: scheduleFieldShape.label.default(''),
  weekday: scheduleFieldShape.weekday.default(null),
  dayOfMonth: scheduleFieldShape.dayOfMonth.default(null),
  city: scheduleFieldShape.city.default(null),
});

interface TimingFields {
  frequency?: string | undefined;
  weekday?: number | null | undefined;
  dayOfMonth?: number | null | undefined;
  scope?: string | undefined;
  city?: string | null | undefined;
}

const timingRules = (s: TimingFields, ctx: z.RefinementCtx) => {
  if (s.frequency === 'weekly' && (s.weekday === null || s.weekday === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Choose a day of the week', path: ['weekday'] });
  }
  if (s.frequency === 'monthly' && (s.dayOfMonth === null || s.dayOfMonth === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Choose a day of the month', path: ['dayOfMonth'] });
  }
  if (s.scope === 'local' && (s.city === null || s.city === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'A local scope needs a city', path: ['city'] });
  }
};

/** A whole schedule config with its cross-field rules; the server checks a PATCH merged with it. */
export const scheduleConfigSchema = scheduleFieldsSchema.superRefine(timingRules);

export const createScheduleBodySchema = scheduleFieldsSchema
  .extend({ brandId: objectIdSchema })
  .superRefine(timingRules);
export type CreateScheduleBody = z.output<typeof createScheduleBodySchema>;
export type CreateScheduleInput = z.input<typeof createScheduleBodySchema>;

/**
 * A partial update. The server merges it with the stored schedule and checks the result with
 * `scheduleConfigSchema`, so the cross-field rules apply to the whole schedule, not the patch.
 */
export const patchScheduleBodySchema = z
  .object(scheduleFieldShape)
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type PatchScheduleBody = z.output<typeof patchScheduleBodySchema>;

export const scheduleSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  label: z.string(),
  frequency: scheduleFrequencySchema,
  hour: z.number(),
  timezone: z.string(),
  weekday: z.number().nullable(),
  dayOfMonth: z.number().nullable(),
  platforms: z.array(platformSchema),
  promptSelection: z.object({ mode: promptSelectionModeSchema, promptIds: z.array(z.string()) }),
  country: countryCodeSchema,
  city: z.string().nullable(),
  language: languageCodeSchema,
  scope: scopeSchema,
  isActive: z.boolean(),
  pausedReason: schedulePausedReasonSchema.nullable(),
  consecutiveSkips: z.number(),
  nextRunAt: isoDateSchema.nullable(),
  lastRunAt: isoDateSchema.nullable(),
  lastRunId: z.string().nullable(),
  /** The last slot the scheduler skipped, until a run starts again. */
  lastSkip: z.object({ at: isoDateSchema, reason: scheduleSkipReasonSchema }).nullable(),
  /**
   * prompts × platforms a run of this schedule costs right now (1 credit per check, D-006): active
   * prompts only, capped at the plan's prompts per run, platforms the plan allows.
   */
  creditsPerRun: z.number(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});
export type Schedule = z.infer<typeof scheduleSchema>;
export const scheduleListResponseSchema = z.array(scheduleSchema);
