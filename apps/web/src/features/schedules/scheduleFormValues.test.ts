import type { Run } from '@pv/shared';
import { describe, expect, it } from 'vitest';
import {
  emptyFormValues,
  estimatePromptIds,
  formValuesFromRun,
  toScheduleFields,
  validateScheduleForm,
} from './scheduleFormValues';

const id = (n: number) => n.toString(16).padStart(24, '0');
const BRAND_ID = id(99);

const brand = {
  defaults: {
    country: 'US',
    city: null,
    language: 'en',
    scope: 'national',
    platforms: ['chatgpt', 'perplexity'],
  },
} as const satisfies Parameters<typeof emptyFormValues>[0];

const base = () =>
  emptyFormValues(
    { defaults: { ...brand.defaults, platforms: [...brand.defaults.platforms] } },
    {
      allowedPlatforms: ['chatgpt', 'perplexity', 'gemini'],
      frequencies: ['weekly', 'monthly'],
      timezone: 'America/Toronto',
    },
  );

const run = (platforms: Run['config']['platforms']): Pick<Run, 'config'> => ({
  config: {
    platforms,
    country: 'CA',
    city: 'Toronto',
    language: 'fr',
    scope: 'local',
    aioLoadAsync: false,
  },
});

describe('emptyFormValues', () => {
  it('starts from the brand defaults, weekly on Monday at 09:00', () => {
    const v = base();
    expect(v).toMatchObject({
      frequency: 'weekly',
      weekday: 1,
      hour: 9,
      timezone: 'America/Toronto',
      platforms: ['chatgpt', 'perplexity'],
      mode: 'all_active',
    });
    expect(v.location).toEqual({ scope: 'national', country: 'US', city: null, language: 'en' });
  });
});

describe('formValuesFromRun (?fromRun prefill)', () => {
  const active = [id(1), id(2), id(3)];

  it('uses all_active when the run covered every active prompt', () => {
    const v = formValuesFromRun(base(), run(['gemini']), [id(3), id(1), id(2), id(1)], active, [
      'chatgpt',
      'gemini',
    ]);
    expect(v.mode).toBe('all_active');
    expect(v.promptIds).toEqual([]);
    expect(v.platforms).toEqual(['gemini']);
    expect(v.location).toEqual({ scope: 'local', country: 'CA', city: 'Toronto', language: 'fr' });
    expect(v.frequency).toBe('weekly');
  });

  it('keeps a fixed subset of still-active prompts and drops platforms outside the plan', () => {
    const v = formValuesFromRun(base(), run(['chatgpt', 'claude']), [id(1), id(7)], active, [
      'chatgpt',
    ]);
    expect(v.mode).toBe('fixed');
    expect(v.promptIds).toEqual([id(1)]);
    expect(v.platforms).toEqual(['chatgpt']);
  });

  it('falls back to all_active and the base platforms when nothing usable is left', () => {
    const v = formValuesFromRun(base(), run(['claude']), [id(9)], active, ['chatgpt']);
    expect(v.mode).toBe('all_active');
    expect(v.platforms).toEqual(['chatgpt', 'perplexity']);
  });
});

describe('toScheduleFields / validateScheduleForm', () => {
  it('nulls the timing fields that do not apply', () => {
    const daily = toScheduleFields({ ...base(), frequency: 'daily', label: '  Daily US  ' });
    expect(daily).toMatchObject({ label: 'Daily US', weekday: null, dayOfMonth: null, city: null });
    const monthly = toScheduleFields({ ...base(), frequency: 'monthly', dayOfMonth: 15 });
    expect(monthly).toMatchObject({ weekday: null, dayOfMonth: 15 });
    expect(monthly.promptSelection).toEqual({ mode: 'all_active', promptIds: [] });
  });

  it('accepts a valid form and reports missing pieces by path', () => {
    expect(validateScheduleForm(base(), BRAND_ID)).toEqual({});
    const errors = validateScheduleForm(
      {
        ...base(),
        platforms: [],
        mode: 'fixed',
        promptIds: [],
        location: { scope: 'local', country: 'US', city: '  ', language: 'en' },
      },
      BRAND_ID,
    );
    expect(errors.platforms).toBeTruthy();
    expect(errors['promptSelection.promptIds']).toBe('Pick at least one prompt');
    expect(errors.city).toBe('A local scope needs a city');
  });

  it('estimates with the fixed subset or every active prompt', () => {
    expect(
      estimatePromptIds({ ...base(), mode: 'fixed', promptIds: [id(2)] }, [id(1), id(2)]),
    ).toEqual([id(2)]);
    expect(estimatePromptIds(base(), [id(1), id(2)])).toEqual([id(1), id(2)]);
  });
});
