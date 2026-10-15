// @vitest-environment jsdom
import type { Prompt } from '@pv/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { promptPatch } from './EditPromptModal';
import { PromptHistory, type HistoryEntry } from './PromptHistory';
import {
  allCategories,
  groupPrompts,
  parsePromptLines,
  promptLinesError,
  replacedByMap,
} from './promptLibrary';

const prompt = (over: Partial<Prompt> & Pick<Prompt, 'id' | 'text'>): Prompt => ({
  brandId: 'b1',
  category: 'CRM',
  source: 'manual',
  replacesId: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('PromptHistory', () => {
  const history: HistoryEntry[] = [
    {
      runId: 'run-old',
      date: '2026-09-01T00:00:00.000Z',
      trigger: 'manual',
      perPlatform: { chatgpt: { status: 'ok', mentioned: true, rank: 3, cited: true } },
    },
    {
      runId: 'run-new',
      date: '2026-10-01T00:00:00.000Z',
      trigger: 'scheduled',
      perPlatform: {
        chatgpt: { status: 'ok', mentioned: true, rank: null, cited: false },
        gemini: { status: 'no_answer', mentioned: false, rank: null, cited: false },
      },
    },
  ];

  it('lists runs newest first with the real trigger, AI rank and "—" for a missing rank', () => {
    renderWithProviders(<PromptHistory history={history} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);

    const newest = within(rows[0]!);
    expect(newest.getByText('Scheduled')).toBeTruthy();
    expect(newest.getByText('—')).toBeTruthy(); // mentioned, but no rank: never "#undefined"
    expect(newest.getByText('No answer')).toBeTruthy();
    expect(newest.getByRole('link').getAttribute('href')).toBe('/app/runs/run-new');

    const oldest = within(rows[1]!);
    expect(oldest.getByText('Manual')).toBeTruthy();
    expect(oldest.getByText('#3')).toBeTruthy();
    expect(oldest.getByText('Cited')).toBeTruthy();
  });

  it('says when a prompt has no history', () => {
    renderWithProviders(<PromptHistory history={[]} />);
    expect(screen.getByText(/Not in any finished report/)).toBeTruthy();
  });
});

describe('prompt library helpers', () => {
  it('parses one prompt per line, trimmed and de-duplicated', () => {
    expect(parsePromptLines('  best crm \n\nbest crm\r\ncheap   crm\n')).toEqual([
      'best crm',
      'cheap crm',
    ]);
    expect(promptLinesError([])).toBeTruthy();
    expect(promptLinesError(['ok?', 'no'])).toMatch(/Line 2/);
    expect(promptLinesError(['best crm'])).toBeUndefined();
  });

  it('groups by category in brand order, filters by search and category, archived last', () => {
    const prompts = [
      prompt({
        id: '1',
        text: 'Old pricing',
        category: 'Pricing',
        archivedAt: '2026-10-02T00:00:00.000Z',
      }),
      prompt({ id: '2', text: 'New pricing', category: 'Pricing', replacesId: '1' }),
      prompt({ id: '3', text: 'Best CRM', category: 'CRM' }),
      prompt({ id: '4', text: 'Other thing', category: 'Misc' }),
    ];
    const order = allCategories(['CRM', 'Pricing'], prompts);
    expect(order).toEqual(['CRM', 'Pricing', 'Misc']);

    const all = groupPrompts(prompts, order, { search: '', category: null });
    expect(all.map(([c]) => c)).toEqual(['CRM', 'Pricing', 'Misc']);
    expect(all[1]?.[1].map((p) => p.id)).toEqual(['2', '1']);

    expect(
      groupPrompts(prompts, order, { search: 'pricing', category: null }).map(([c]) => c),
    ).toEqual(['Pricing']);
    expect(groupPrompts(prompts, order, { search: '', category: 'Misc' })).toEqual([
      ['Misc', [prompts[3]]],
    ]);
    expect(replacedByMap(prompts).get('1')?.id).toBe('2');
  });

  it('only patches what changed', () => {
    const p = { text: 'best crm', category: 'CRM' };
    expect(promptPatch(p, ' best crm ', 'CRM')).toBeNull();
    expect(promptPatch(p, 'best crm', 'Sales')).toEqual({ category: 'Sales' });
    expect(promptPatch(p, 'top crm', 'CRM')).toEqual({ text: 'top crm' });
  });
});
