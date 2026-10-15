import type { Schedule } from '@pv/shared';
import type { ScheduleDoc } from './repo';

/** `Schedule` (08) from the doc. Never exposes the scheduler's `inFlight` claim. */
export function toSchedule(s: ScheduleDoc, creditsPerRun: number): Schedule {
  return {
    id: s._id.toHexString(),
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
    country: s.country as Schedule['country'],
    city: s.city,
    language: s.language as Schedule['language'],
    scope: s.scope,
    isActive: s.isActive,
    pausedReason: s.pausedReason,
    consecutiveSkips: s.consecutiveSkips,
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    lastRunId: s.lastRunId?.toHexString() ?? null,
    lastSkip: s.lastSkip ? { at: s.lastSkip.at.toISOString(), reason: s.lastSkip.reason } : null,
    creditsPerRun,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
