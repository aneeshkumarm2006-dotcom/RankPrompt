import {
  createScheduleBodySchema,
  MAX_PROMPTS_PER_REQUEST,
  SCHEDULE_FREQUENCIES,
  type Brand,
  type CreateScheduleInput,
  type Platform,
  type PromptSelectionMode,
  type Run,
  type Schedule,
  type ScheduleFrequency,
} from '@pv/shared';
import type { LocationValue } from '../runs/LocationFields';

/** What the schedule form edits. Weekday and day of month are kept even when hidden. */
export interface ScheduleFormValues {
  label: string;
  frequency: ScheduleFrequency;
  hour: number;
  timezone: string;
  weekday: number;
  dayOfMonth: number;
  platforms: Platform[];
  mode: PromptSelectionMode;
  promptIds: string[];
  location: LocationValue;
}

export type ScheduleFormErrors = Partial<Record<string, string>>;

/** Weekly if the plan allows it (v1 default), else the first allowed frequency. */
export function defaultFrequency(allowed: readonly ScheduleFrequency[]): ScheduleFrequency {
  if (allowed.includes('weekly')) return 'weekly';
  return allowed[0] ?? 'weekly';
}

/** A new schedule: brand defaults, all active prompts, Monday 09:00 in the browser's zone. */
export function emptyFormValues(
  brand: Pick<Brand, 'defaults'>,
  opts: {
    allowedPlatforms: readonly Platform[];
    frequencies: readonly ScheduleFrequency[];
    timezone: string;
  },
): ScheduleFormValues {
  const defaults = brand.defaults.platforms.filter((p) => opts.allowedPlatforms.includes(p));
  return {
    label: '',
    frequency: defaultFrequency(opts.frequencies),
    hour: 9,
    timezone: opts.timezone,
    weekday: 1,
    dayOfMonth: 1,
    platforms: defaults.length > 0 ? defaults : [...opts.allowedPlatforms],
    mode: 'all_active',
    promptIds: [],
    location: {
      scope: brand.defaults.scope,
      country: brand.defaults.country,
      city: brand.defaults.city,
      language: brand.defaults.language,
    },
  };
}

/** The form for editing an existing schedule. */
export function formValuesFromSchedule(s: Schedule): ScheduleFormValues {
  return {
    label: s.label,
    frequency: s.frequency,
    hour: s.hour,
    timezone: s.timezone,
    weekday: s.weekday ?? 1,
    dayOfMonth: s.dayOfMonth ?? 1,
    platforms: [...s.platforms],
    mode: s.promptSelection.mode,
    promptIds: [...s.promptSelection.promptIds],
    location: { scope: s.scope, country: s.country, city: s.city, language: s.language },
  };
}

/**
 * "Schedule this setup" (`?fromRun=`): the run's platforms, location and prompts on top of
 * `base`. If the run used every active prompt it becomes `all_active`, otherwise a fixed subset
 * of the prompts that are still active. Platforms outside the plan are dropped.
 */
export function formValuesFromRun(
  base: ScheduleFormValues,
  run: Pick<Run, 'config'>,
  runPromptIds: readonly string[],
  activePromptIds: readonly string[],
  allowedPlatforms: readonly Platform[],
): ScheduleFormValues {
  const active = new Set(activePromptIds);
  const kept = [...new Set(runPromptIds)].filter((id) => active.has(id));
  const coversAll = kept.length > 0 && kept.length === active.size;
  const platforms = run.config.platforms.filter((p) => allowedPlatforms.includes(p));
  return {
    ...base,
    platforms: platforms.length > 0 ? platforms : base.platforms,
    mode: kept.length === 0 || coversAll ? 'all_active' : 'fixed',
    promptIds: kept.length === 0 || coversAll ? [] : kept,
    location: {
      scope: run.config.scope,
      country: run.config.country,
      city: run.config.city,
      language: run.config.language,
    },
  };
}

/** The API body (without `brandId`), with timing fields nulled when they don't apply. */
export function toScheduleFields(v: ScheduleFormValues): Omit<CreateScheduleInput, 'brandId'> {
  const city = v.location.scope === 'local' ? (v.location.city?.trim() ?? '') : '';
  return {
    label: v.label.trim(),
    frequency: v.frequency,
    hour: v.hour,
    timezone: v.timezone,
    weekday: v.frequency === 'weekly' ? v.weekday : null,
    dayOfMonth: v.frequency === 'monthly' ? v.dayOfMonth : null,
    platforms: v.platforms,
    promptSelection: { mode: v.mode, promptIds: v.mode === 'fixed' ? v.promptIds : [] },
    country: v.location.country,
    city: city === '' ? null : city,
    language: v.location.language,
    scope: v.location.scope,
  };
}

/** Client-side check with the shared contract; errors keyed by dotted path. */
export function validateScheduleForm(v: ScheduleFormValues, brandId: string): ScheduleFormErrors {
  const parsed = createScheduleBodySchema.safeParse({ brandId, ...toScheduleFields(v) });
  if (parsed.success) return {};
  const out: ScheduleFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.');
    out[key] ??= issue.message;
  }
  return out;
}

/** Prompt ids for the cost preview: the fixed subset, or every active prompt (capped). */
export function estimatePromptIds(v: ScheduleFormValues, activePromptIds: readonly string[]) {
  return v.mode === 'fixed' ? v.promptIds : activePromptIds.slice(0, MAX_PROMPTS_PER_REQUEST);
}

export const ALL_FREQUENCIES: readonly ScheduleFrequency[] = SCHEDULE_FREQUENCIES;
