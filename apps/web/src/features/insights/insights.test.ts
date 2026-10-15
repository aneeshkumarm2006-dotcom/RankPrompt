import type { PromptHistoryResponse, TrendPoint } from '@pv/shared';
import { describe, expect, it } from 'vitest';
import { domainError, withAddedCompetitor } from './competitors';
import { rangeFrom } from './range';
import { splitRankedMissed } from './rankedMissed';
import { buildTrendSeries } from './trend';

const ratio = (num: number, den: number) => ({ num, den, rate: den ? num / den : null });

const point = (over: Partial<TrendPoint> & Pick<TrendPoint, 'runId'>): TrendPoint => ({
  date: '2026-10-01T12:00:00.000Z',
  trigger: 'manual',
  visibility: ratio(1, 4),
  byPlatform: {},
  promptSetHash: 'a',
  platformsHash: 'b',
  comparableWithPrevious: true,
  ...over,
});

describe('buildTrendSeries', () => {
  const points = [
    point({ runId: 'r1', comparableWithPrevious: false, byPlatform: { chatgpt: ratio(1, 2) } }),
    point({ runId: 'r2', visibility: ratio(2, 4), byPlatform: { gemini: ratio(1, 3) } }),
    point({ runId: 'r3', comparableWithPrevious: false, visibility: ratio(1, 3) }),
  ];

  it('marks points that are not comparable with the previous one (never the first)', () => {
    const series = buildTrendSeries(points, true);
    expect(series.data.map((d) => d.changed)).toEqual([false, false, true]);
    expect(series.changedRunIds).toEqual(['r3']);
  });

  it('charts server ratios as 0–100 values with their fraction', () => {
    const series = buildTrendSeries(points, true);
    expect(series.data.map((d) => d.total)).toEqual([25, 50, 33.3]);
    expect(series.data[2]?.totalFraction).toBe('1/3');
  });

  it('adds one line per platform present, in platform order, only when not filtered', () => {
    const all = buildTrendSeries(points, true);
    expect(all.platforms).toEqual(['chatgpt', 'gemini']);
    expect(all.data[0]?.p_chatgpt).toBe(50);
    expect(all.data[1]?.p_chatgpt).toBeUndefined();
    expect(buildTrendSeries(points, false).platforms).toEqual([]);
  });
});

describe('rangeFrom', () => {
  it('is the start of the UTC day N days ago, so query keys stay stable', () => {
    const now = new Date('2026-10-14T17:45:12.000Z');
    expect(rangeFrom(30, now)).toBe('2026-09-14T00:00:00.000Z');
    expect(rangeFrom(30, new Date('2026-10-14T01:00:00.000Z'))).toBe(rangeFrom(30, now));
  });
});

describe('withAddedCompetitor', () => {
  it('keeps the existing competitors with their ids and aliases, then adds the new one', () => {
    const body = withAddedCompetitor(
      [
        { id: 'c1', name: 'Acme', domain: 'acme.com', aliases: ['ACME Inc'] },
        { id: 'c2', name: 'Globex', domain: 'globex.com', aliases: [] },
      ],
      { name: ' Initech ', domain: ' initech.com ' },
    );
    expect(body).toEqual([
      { id: 'c1', name: 'Acme', domain: 'acme.com', aliases: ['ACME Inc'] },
      { id: 'c2', name: 'Globex', domain: 'globex.com', aliases: [] },
      { name: 'Initech', domain: 'initech.com', aliases: [] },
    ]);
  });

  it('requires a domain', () => {
    expect(domainError('')).toBeTruthy();
    expect(domainError('ab')).toBeTruthy();
    expect(domainError('initech.com')).toBeUndefined();
  });
});

describe('splitRankedMissed', () => {
  const prompts: PromptHistoryResponse['prompts'] = [
    {
      promptId: 'p1',
      text: 'best crm',
      category: 'CRM',
      archived: false,
      history: [
        {
          runId: 'run1',
          date: '2026-10-01T00:00:00.000Z',
          trigger: 'manual',
          perPlatform: {
            chatgpt: { status: 'ok', mentioned: true, rank: 2, cited: false },
            gemini: { status: 'ok', mentioned: false, rank: null, cited: false },
          },
        },
      ],
    },
    {
      promptId: 'p2',
      text: 'cheap crm',
      category: 'Pricing',
      archived: false,
      history: [
        {
          runId: 'run1',
          date: '2026-10-01T00:00:00.000Z',
          trigger: 'manual',
          perPlatform: {
            chatgpt: { status: 'ok', mentioned: false, rank: null, cited: false },
            gemini: { status: 'failed', mentioned: false, rank: null, cited: false },
          },
        },
      ],
    },
  ];

  it('splits by mention on answered checks', () => {
    const { ranked, missed } = splitRankedMissed(prompts, 'run1', {
      platform: null,
      category: null,
    });
    expect(ranked.map((p) => p.promptId)).toEqual(['p1']);
    expect(missed.map((p) => p.promptId)).toEqual(['p2']);
    expect(missed[0]?.cells.map((c) => c.platform)).toEqual(['chatgpt']);
  });

  it('applies the platform and category filters', () => {
    const gemini = splitRankedMissed(prompts, 'run1', { platform: 'gemini', category: null });
    expect(gemini.ranked).toEqual([]);
    expect(gemini.missed.map((p) => p.promptId)).toEqual(['p1']);
    const pricing = splitRankedMissed(prompts, 'run1', { platform: null, category: 'Pricing' });
    expect(pricing.ranked).toEqual([]);
    expect(pricing.missed.map((p) => p.promptId)).toEqual(['p2']);
  });

  it('ignores other runs', () => {
    expect(splitRankedMissed(prompts, 'other', { platform: null, category: null })).toEqual({
      ranked: [],
      missed: [],
    });
  });
});
