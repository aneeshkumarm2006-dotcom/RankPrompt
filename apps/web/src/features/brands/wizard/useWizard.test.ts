import { describe, expect, it } from 'vitest';
import { makeBrand } from '../testFixtures';
import { draftCategoryOptions, draftErrors, draftsToBody } from './drafts';
import { promptCountChoices } from './StepCategories';
import { clampStep, resumeStep, type Draft } from './useWizard';

const draft = (key: string, text: string, category = 'Anvils'): Draft => ({
  key,
  text,
  category,
  source: 'generated',
});

describe('resumeStep (F-10)', () => {
  it('starts at step 1 without a brand', () => {
    expect(resumeStep(null, 0)).toBe(1);
  });
  it('resumes at step 2 for a brand without prompts', () => {
    expect(resumeStep('b1', 0)).toBe(2);
  });
  it('resumes at step 3 for a brand with saved prompts', () => {
    expect(resumeStep('b1', 4)).toBe(3);
  });
});

describe('clampStep', () => {
  it('never shows step 1 again once the brand exists', () => {
    expect(clampStep(1, 'b1', 0, 0)).toBe(2);
  });
  it('forces step 1 without a brand', () => {
    expect(clampStep(3, null, 0, 0)).toBe(1);
  });
  it('keeps step 4 behind saved prompts', () => {
    expect(clampStep(4, 'b1', 0, 0)).toBe(2);
    expect(clampStep(4, 'b1', 0, 2)).toBe(3);
    expect(clampStep(4, 'b1', 3, 0)).toBe(4);
  });
});

describe('promptCountChoices', () => {
  it('offers v1’s 1/10/25, capped at the plan', () => {
    expect(promptCountChoices(150)).toEqual([1, 10, 25]);
    expect(promptCountChoices(25)).toEqual([1, 10, 25]);
    expect(promptCountChoices(12)).toEqual([1, 10]);
  });
});

describe('drafts', () => {
  it('validates length and repeats', () => {
    expect(
      draftErrors([
        draft('a', 'ok?'),
        draft('b', 'no'),
        draft('c', ' OK? '),
        draft('d', 'x'.repeat(501)),
      ]),
    ).toEqual({
      b: 'Write at least 3 characters',
      c: 'This prompt is listed twice',
      d: 'Keep it under 500 characters',
    });
  });

  it('builds the save body with trimmed text and sources', () => {
    expect(draftsToBody([{ ...draft('a', '  best   anvils? '), source: 'manual' }])).toEqual([
      { text: 'best anvils?', category: 'Anvils', source: 'manual' },
    ]);
  });

  it('offers the brand categories plus any a draft uses', () => {
    expect(draftCategoryOptions(makeBrand(), [draft('a', 'x', 'Extra')])).toEqual([
      'Anvils',
      'Rockets',
      'Extra',
    ]);
    expect(draftCategoryOptions(makeBrand({ categories: [] }), [])).toEqual(['General']);
  });
});
