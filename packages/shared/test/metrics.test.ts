import { describe, expect, it } from 'vitest';
import {
  aioPresence,
  avgRank,
  computeRunAggregates,
  isBrandDomain,
  promptCoverage,
  ratio,
  runAggregatesSchema,
  shareOfVoice,
  suggestedCompetitors,
  top3Rate,
  topCitedDomains,
  visibility,
  visibilityDelta,
  type CheckStatus,
  type MetricCheck,
  type Platform,
} from '../src';

/** A check with sensible defaults; override what the case is about. */
function check(
  over: Partial<MetricCheck> & { mentioned?: boolean; rank?: number | null } = {},
): MetricCheck {
  const { mentioned = false, rank = null, ...rest } = over;
  return {
    promptId: 'p1',
    category: 'Tools',
    platform: 'chatgpt',
    status: 'ok',
    brand: { mentioned, rank, cited: false },
    competitors: [],
    vendors: [],
    suggested: [],
    citations: [],
    ...rest,
  };
}

const many = (n: number, over: Parameters<typeof check>[0]) =>
  Array.from({ length: n }, () => check(over));

const COMPETITORS = [
  { id: 'c1', name: 'Globex' },
  { id: 'c2', name: 'Initech' },
];

describe('metrics (05)', () => {
  it('ratio: rate is null, never 0, when there is no denominator', () => {
    expect(ratio(0, 0)).toEqual({ num: 0, den: 0, rate: null });
    expect(ratio(1, 4)).toEqual({ num: 1, den: 4, rate: 0.25 });
  });

  it('visibility counts answered checks only', () => {
    const statuses: CheckStatus[] = ['ok', 'no_answer', 'failed', 'canceled', 'pending'];
    const checks = statuses.map((status) => check({ status, mentioned: true }));
    expect(visibility(checks.map((c) => ({ status: c.status, ...c.brand })))).toEqual(ratio(1, 1));
  });

  it('pools totals across platforms instead of averaging platform rates', () => {
    // ChatGPT 10/20 and Claude 1/4 → 11/24, not the mean of 50% and 25%.
    const checks = [
      ...many(10, { platform: 'chatgpt', mentioned: true }),
      ...many(10, { platform: 'chatgpt' }),
      ...many(1, { platform: 'claude', mentioned: true }),
      ...many(3, { platform: 'claude' }),
    ];
    const agg = computeRunAggregates(checks, { brandDomain: 'acme.com', competitors: [] });
    expect(agg.byPlatform.chatgpt?.visibility).toEqual(ratio(10, 20));
    expect(agg.byPlatform.claude?.visibility).toEqual(ratio(1, 4));
    expect(agg.total.visibility).toEqual(ratio(11, 24));
    expect(agg.total.visibility.rate).not.toBeCloseTo((0.5 + 0.25) / 2);
  });

  it('average rank ignores unranked answers and reports how many it averaged', () => {
    const scores = [1, 3, null, null].map((rank) => ({
      status: 'ok' as const,
      mentioned: rank !== null,
      cited: false,
      rank,
    }));
    expect(avgRank(scores)).toEqual({ value: 2, count: 2 });
    expect(avgRank([])).toEqual({ value: null, count: 0 });
    expect(top3Rate([...scores, { status: 'ok', mentioned: true, cited: false, rank: 4 }])).toEqual(
      ratio(2, 5),
    );
  });

  it('prompt coverage: prompts mentioned anywhere ÷ prompts answered anywhere', () => {
    const checks = [
      check({ promptId: 'a', mentioned: true }),
      check({ promptId: 'a', platform: 'claude' }),
      check({ promptId: 'b' }),
      check({ promptId: 'c', status: 'failed', mentioned: true }),
    ];
    expect(promptCoverage(checks)).toEqual(ratio(1, 2));
  });

  it('share of voice counts each company at most once per answered check', () => {
    const comp = (id: string, mentioned: boolean) => ({
      competitorId: id,
      mentioned,
      rank: null,
      cited: false,
    });
    const checks = [
      check({ mentioned: true, competitors: [comp('c1', true), comp('c2', false)] }),
      check({ mentioned: true, competitors: [comp('c1', true), comp('c2', true)] }),
      check({ mentioned: false, competitors: [comp('c1', false), comp('c2', true)] }),
      check({ status: 'failed', mentioned: true, competitors: [comp('c1', true)] }),
    ];
    // brand 2, Globex 2, Initech 2 → 6 mentions in total.
    expect(shareOfVoice(checks, COMPETITORS)).toEqual(ratio(2, 6));
    const agg = computeRunAggregates(checks, { brandDomain: 'acme.com', competitors: COMPETITORS });
    expect(agg.competitors.map((c) => c.shareOfVoice)).toEqual([ratio(2, 6), ratio(2, 6)]);
    expect(agg.competitors[0]?.visibility).toEqual(ratio(2, 3));
    expect(shareOfVoice([], COMPETITORS)).toEqual(ratio(0, 0));
  });

  it('AI Overview presence: ok ÷ (ok + no_answer) on google_aio only', () => {
    const aio = (status: CheckStatus) => check({ platform: 'google_aio', status });
    const checks = [aio('ok'), aio('no_answer'), aio('no_answer'), aio('failed'), check()];
    expect(aioPresence(checks)).toEqual(ratio(1, 3));
    const agg = computeRunAggregates(checks, { brandDomain: 'acme.com', competitors: [] });
    expect(agg.byPlatform.google_aio?.aioPresence).toEqual(ratio(1, 3));
    expect(agg.byPlatform.chatgpt?.aioPresence).toBeUndefined();
    // no_answer never counts towards visibility.
    expect(agg.byPlatform.google_aio?.visibility.den).toBe(1);
  });

  it('suggested competitors: answered checks only, ranked by mentions', () => {
    const checks = [
      check({ vendors: ['Hooli', 'Acme'], suggested: ['Hooli'] }),
      check({ vendors: ['Pied Piper', 'hooli'], suggested: ['Pied Piper', 'hooli'] }),
      check({ status: 'failed', vendors: ['Hooli'], suggested: ['Hooli'] }),
    ];
    expect(suggestedCompetitors(checks)).toEqual([
      { name: 'Hooli', mentions: 2, bestRank: 1, avgRank: 1.5 },
      { name: 'Pied Piper', mentions: 1, bestRank: 1, avgRank: 1 },
    ]);
  });

  it('top cited domains flag the brand, subdomains included', () => {
    const cite = (domain: string) => ({ domain, url: `https://${domain}/x` });
    const checks = [
      check({
        platform: 'chatgpt',
        citations: [cite('docs.acme.com'), cite('g2.com'), cite('g2.com')],
      }),
      check({ platform: 'gemini', citations: [cite('g2.com'), cite('')] }),
      check({ status: 'failed', citations: [cite('ignored.com')] }),
    ];
    expect(topCitedDomains(checks, 'acme.com')).toEqual([
      { domain: 'g2.com', count: 2, platforms: ['chatgpt', 'gemini'], isBrand: false },
      { domain: 'docs.acme.com', count: 1, platforms: ['chatgpt'], isBrand: true },
    ]);
    expect(isBrandDomain('acme.com.evil.io', 'acme.com')).toBe(false);
    expect(isBrandDomain('notacme.com', 'acme.com')).toBe(false);
  });

  it('by-category breakdowns and a schema-valid aggregate', () => {
    const checks = [
      check({ category: 'Tools', mentioned: true }),
      check({ category: 'Pricing' }),
      check({ category: 'Pricing', status: 'no_answer' }),
    ];
    const agg = computeRunAggregates(checks, { brandDomain: 'acme.com', competitors: COMPETITORS });
    expect(agg.byCategory).toEqual({
      Tools: { visibility: ratio(1, 1), citationRate: ratio(0, 1) },
      Pricing: { visibility: ratio(0, 1), citationRate: ratio(0, 1) },
    });
    expect(() => runAggregatesSchema.parse(agg)).not.toThrow();
  });

  it('an empty run has null rates everywhere, not zeros', () => {
    const agg = computeRunAggregates([], { brandDomain: 'acme.com', competitors: COMPETITORS });
    expect(agg.total.visibility.rate).toBeNull();
    expect(agg.total.avgRank).toEqual({ value: null, count: 0 });
    expect(agg.competitors[0]?.shareOfVoice.rate).toBeNull();
  });

  it('run-over-run delta uses only the prompts and platforms both runs share', () => {
    const at = (promptId: string, platform: Platform, mentioned: boolean) =>
      check({ promptId, platform, mentioned });
    const previous = [at('a', 'chatgpt', false), at('b', 'chatgpt', true), at('a', 'claude', true)];
    const current = [
      at('a', 'chatgpt', true),
      at('b', 'chatgpt', true),
      at('c', 'chatgpt', true), // new prompt: ignored
      at('a', 'gemini', true), // new platform: ignored
    ];
    expect(visibilityDelta(previous, current)).toEqual({
      current: ratio(2, 2),
      previous: ratio(1, 2),
      deltaPts: 50,
      sharedPrompts: 2,
      sharedPlatforms: ['chatgpt'],
    });
    expect(visibilityDelta([], current).deltaPts).toBeNull();
  });
});
