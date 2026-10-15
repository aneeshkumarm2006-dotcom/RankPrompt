import type { ScheduleTimingLike } from '@pv/shared';
import { describe, expect, it } from 'vitest';
import { isValidTimezone, nextSlotAfter } from '../src/modules/schedules/timing';

const t = (over: Partial<ScheduleTimingLike>): ScheduleTimingLike => ({
  frequency: 'daily',
  hour: 9,
  timezone: 'UTC',
  weekday: null,
  dayOfMonth: null,
  ...over,
});
const next = (timing: Partial<ScheduleTimingLike>, after: string) =>
  nextSlotAfter(t(timing), new Date(after)).toISOString();

/** Follows a schedule for `n` slots from `start`, the way the scheduler advances it. */
function slots(timing: Partial<ScheduleTimingLike>, start: string, n: number): string[] {
  const out: string[] = [];
  let at = new Date(start);
  for (let i = 0; i < n; i++) {
    at = nextSlotAfter(t(timing), at);
    out.push(at.toISOString());
  }
  return out;
}

describe('nextSlotAfter', () => {
  it('daily: later today, else tomorrow; strictly after', () => {
    expect(next({}, '2026-10-15T08:59:59Z')).toBe('2026-10-15T09:00:00.000Z');
    expect(next({}, '2026-10-15T09:00:00Z')).toBe('2026-10-16T09:00:00.000Z');
    expect(next({}, '2026-10-15T23:00:00Z')).toBe('2026-10-16T09:00:00.000Z');
  });

  it('daily in a zone: the local hour, converted to UTC', () => {
    expect(next({ timezone: 'America/Toronto' }, '2026-10-15T12:00:00Z')).toBe(
      '2026-10-15T13:00:00.000Z',
    );
    // 23:30 UTC is already the next local day in Tokyo.
    expect(next({ timezone: 'Asia/Tokyo', hour: 7 }, '2026-10-15T23:30:00Z')).toBe(
      '2026-10-16T22:00:00.000Z',
    );
  });

  it('weekly on a weekday (0 = Sunday)', () => {
    // 2026-10-15 is a Thursday.
    expect(next({ frequency: 'weekly', weekday: 1 }, '2026-10-15T10:00:00Z')).toBe(
      '2026-10-19T09:00:00.000Z',
    );
    expect(next({ frequency: 'weekly', weekday: 0 }, '2026-10-15T10:00:00Z')).toBe(
      '2026-10-18T09:00:00.000Z',
    );
    // Same weekday: today if the hour is still ahead, else a week later.
    expect(next({ frequency: 'weekly', weekday: 4 }, '2026-10-15T08:00:00Z')).toBe(
      '2026-10-15T09:00:00.000Z',
    );
    expect(next({ frequency: 'weekly', weekday: 4 }, '2026-10-15T09:00:00Z')).toBe(
      '2026-10-22T09:00:00.000Z',
    );
  });

  it('monthly on a day of the month, rolling over the year', () => {
    expect(next({ frequency: 'monthly', dayOfMonth: 28 }, '2026-10-15T00:00:00Z')).toBe(
      '2026-10-28T09:00:00.000Z',
    );
    expect(next({ frequency: 'monthly', dayOfMonth: 1 }, '2026-12-15T00:00:00Z')).toBe(
      '2027-01-01T09:00:00.000Z',
    );
    expect(slots({ frequency: 'monthly', dayOfMonth: 28 }, '2027-01-01T00:00:00Z', 3)).toEqual([
      '2027-01-28T09:00:00.000Z',
      '2027-02-28T09:00:00.000Z',
      '2027-03-28T09:00:00.000Z',
    ]);
  });

  describe('DST', () => {
    it('keeps the local hour across spring forward (New York, 2026-03-08)', () => {
      expect(slots({ timezone: 'America/New_York' }, '2026-03-06T12:00:00Z', 4)).toEqual([
        '2026-03-06T14:00:00.000Z', // EST, UTC−5
        '2026-03-07T14:00:00.000Z',
        '2026-03-08T13:00:00.000Z', // EDT, UTC−4
        '2026-03-09T13:00:00.000Z',
      ]);
    });

    it('keeps the local hour across fall back (London, 2026-10-25)', () => {
      expect(slots({ timezone: 'Europe/London' }, '2026-10-24T00:00:00Z', 3)).toEqual([
        '2026-10-24T08:00:00.000Z', // BST, UTC+1
        '2026-10-25T09:00:00.000Z', // GMT
        '2026-10-26T09:00:00.000Z',
      ]);
    });

    it('a slot inside the skipped hour runs at the first valid time after it, once', () => {
      // 02:00 doesn't exist in New York on 2026-03-08: it runs at 03:00 EDT.
      expect(slots({ timezone: 'America/New_York', hour: 2 }, '2026-03-07T12:00:00Z', 3)).toEqual([
        '2026-03-08T07:00:00.000Z', // 03:00 EDT
        '2026-03-09T06:00:00.000Z', // 02:00 EDT
        '2026-03-10T06:00:00.000Z',
      ]);
    });

    it('a slot inside the repeated hour runs once, at its first occurrence', () => {
      // 01:00 happens twice in New York on 2026-11-01 (EDT, then EST).
      const run = slots({ timezone: 'America/New_York', hour: 1 }, '2026-10-31T12:00:00Z', 3);
      expect(run).toEqual([
        '2026-11-01T05:00:00.000Z', // 01:00 EDT
        '2026-11-02T06:00:00.000Z', // 01:00 EST: the second 01:00 on the 1st is skipped
        '2026-11-03T06:00:00.000Z',
      ]);
    });

    it('southern hemisphere: Sydney springs forward in October', () => {
      // 2026-10-04 02:00 → 03:00 in Sydney (AEST +10 → AEDT +11).
      expect(slots({ timezone: 'Australia/Sydney' }, '2026-10-02T00:00:00Z', 3)).toEqual([
        '2026-10-02T23:00:00.000Z', // 09:00 on the 3rd, AEST
        '2026-10-03T22:00:00.000Z', // 09:00 on the 4th, AEDT
        '2026-10-04T22:00:00.000Z',
      ]);
    });

    it('weekly across a DST change keeps the weekday and the hour', () => {
      expect(
        slots(
          { timezone: 'America/New_York', frequency: 'weekly', weekday: 1 },
          '2026-02-28T00:00:00Z',
          3,
        ),
      ).toEqual([
        '2026-03-02T14:00:00.000Z',
        '2026-03-09T13:00:00.000Z',
        '2026-03-16T13:00:00.000Z',
      ]);
    });
  });

  it('rejects unknown zones', () => {
    expect(isValidTimezone('America/Toronto')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(() => nextSlotAfter(t({ timezone: 'Mars/Olympus_Mons' }), new Date())).toThrow();
  });
});
