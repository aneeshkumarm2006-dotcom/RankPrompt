import { describe, expect, it } from 'vitest';
import {
  frequencySummary,
  hourLabel,
  ordinal,
  pausedReasonText,
  timezoneOptions,
} from './scheduleText';

describe('frequencySummary', () => {
  const base = { hour: 9, timezone: 'America/Toronto', weekday: null, dayOfMonth: null };

  it('describes daily, weekly and monthly schedules', () => {
    expect(frequencySummary({ ...base, frequency: 'daily' })).toBe(
      'Daily at 09:00 America/Toronto',
    );
    expect(frequencySummary({ ...base, frequency: 'weekly', weekday: 1 })).toBe(
      'Weekly on Monday at 09:00 America/Toronto',
    );
    expect(frequencySummary({ ...base, frequency: 'monthly', dayOfMonth: 22, hour: 17 })).toBe(
      'Monthly on the 22nd at 17:00 America/Toronto',
    );
  });

  it('falls back to the frequency when the day is missing', () => {
    expect(frequencySummary({ ...base, frequency: 'weekly', timezone: 'UTC', hour: 0 })).toBe(
      'Weekly at 00:00 UTC',
    );
  });
});

describe('helpers', () => {
  it('formats hours and ordinals', () => {
    expect(hourLabel(7)).toBe('07:00');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '28th',
    ]);
  });

  it('explains paused reasons', () => {
    expect(pausedReasonText('user')).toBe('Paused');
    expect(pausedReasonText('insufficient_credits')).toMatch(/after 3 skipped runs/);
    expect(pausedReasonText('brand_archived')).toMatch(/archived/);
  });

  it('always offers UTC and the requested zones', () => {
    const zones = timezoneOptions('Mars/Olympus_Mons');
    expect(zones).toContain('UTC');
    expect(zones).toContain('Mars/Olympus_Mons');
    expect(new Set(zones).size).toBe(zones.length);
  });
});
