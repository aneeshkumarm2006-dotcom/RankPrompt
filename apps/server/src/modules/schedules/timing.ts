import type { ScheduleTimingLike } from '@pv/shared';
import { DateTime, IANAZone } from 'luxon';

/**
 * When a schedule runs (10 § Schedule semantics): at `hour`:00 local time in its IANA `timezone`,
 * every day, every week on `weekday` (0 = Sunday) or every month on `dayOfMonth` (1–28).
 *
 * DST: the local slot is built from its calendar fields in the zone, so the UTC instant moves with
 * the clocks and the run stays at the same local hour. A slot inside a spring-forward gap (02:00
 * on the night the clocks skip it) runs at the first valid time after it (03:00). A slot inside the
 * repeated fall-back hour runs once, at its first occurrence.
 */

export const isValidTimezone = (zone: string): boolean => IANAZone.isValidZone(zone);

/** The local slot on one calendar day. */
function slotOn(day: DateTime, hour: number, zone: string): DateTime {
  return DateTime.fromObject({ year: day.year, month: day.month, day: day.day, hour }, { zone });
}

/** Luxon numbers weekdays 1 (Monday) to 7 (Sunday); ours are 0 (Sunday) to 6. */
const luxonWeekday = (weekday: number): number => (weekday === 0 ? 7 : weekday);

/** The first slot strictly after `after`. Throws on an unknown zone (the API checks it first). */
export function nextSlotAfter(t: ScheduleTimingLike, after: Date): Date {
  if (!isValidTimezone(t.timezone)) throw new Error(`unknown time zone ${t.timezone}`);
  const zone = t.timezone;
  const today = DateTime.fromJSDate(after, { zone }).startOf('day');
  const later = (slot: DateTime) => slot.toMillis() > after.getTime();

  if (t.frequency === 'monthly') {
    const day = t.dayOfMonth ?? 1;
    for (let m = 0; m <= 2; m++) {
      const month = today.startOf('month').plus({ months: m });
      const slot = slotOn(month.set({ day }), t.hour, zone);
      if (later(slot)) return slot.toJSDate();
    }
  } else {
    const weekday = t.frequency === 'weekly' ? luxonWeekday(t.weekday ?? 1) : null;
    for (let d = 0; d <= 8; d++) {
      const day = today.plus({ days: d });
      if (weekday !== null && day.weekday !== weekday) continue;
      const slot = slotOn(day, t.hour, zone);
      if (later(slot)) return slot.toJSDate();
    }
  }
  throw new Error('no next slot found');
}

/** The timing fields that move `nextRunAt` when they change. */
export const TIMING_FIELDS = ['frequency', 'hour', 'timezone', 'weekday', 'dayOfMonth'] as const;
