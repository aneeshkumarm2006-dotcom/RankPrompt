import type { ScheduleFrequency, SchedulePausedReason, ScheduleSkipReason } from '@pv/shared';

export { frequencySummary, hourLabel, ordinal } from '@pv/shared';

export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Why the scheduler skipped a slot, in words. */
export function skipReasonText(reason: ScheduleSkipReason): string {
  switch (reason) {
    case 'insufficient_credits':
      return 'Not enough credits.';
    case 'no_prompts':
      return 'None of the selected prompts is active any more.';
    case 'no_platforms':
      return 'None of its platforms can run right now.';
  }
}

/** Why a schedule is paused, in words. */
export function pausedReasonText(reason: SchedulePausedReason | null): string {
  switch (reason) {
    case 'insufficient_credits':
      return 'Paused after 3 skipped runs (not enough credits)';
    case 'brand_archived':
      return 'Paused because the brand was archived';
    default:
      return 'Paused';
  }
}

/** Zones offered when the browser can't list them all. */
const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/** The browser's zone, e.g. `America/Toronto`; `UTC` when it can't tell. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA zone the browser knows (or a common list), always including `extra` zones. */
export function timezoneOptions(...extra: string[]): string[] {
  let zones: string[] = COMMON_TIMEZONES;
  try {
    const all = Intl.supportedValuesOf('timeZone');
    if (all.length > 0) zones = ['UTC', ...all];
  } catch {
    // Older browsers: keep the common list.
  }
  const out = new Set(zones);
  const missing = extra.filter((z) => z && !out.has(z));
  return [...missing, ...out];
}
