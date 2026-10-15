import type { PublicReport } from '@pv/shared';

const r = (num: number, den: number) => ({ num, den, rate: den === 0 ? null : num / den });

/** A small public report: 2 prompts × 2 platforms, one failed check, no ranked answers. */
export function publicReportFixture(): PublicReport {
  return {
    brand: { name: 'Acme', domain: 'acme.com' },
    run: {
      date: '2026-10-01T12:00:00.000Z',
      status: 'partial',
      platforms: ['chatgpt', 'perplexity'],
      country: 'US',
      city: null,
      language: 'en',
    },
    aggregates: {
      total: {
        visibility: r(1, 3),
        citationRate: r(1, 3),
        promptCoverage: r(1, 2),
        top3Rate: r(0, 3),
        avgRank: { value: null, count: 0 },
        shareOfVoice: r(1, 4),
      },
      byPlatform: {
        chatgpt: {
          visibility: r(1, 2),
          citationRate: r(1, 2),
          top3Rate: r(0, 2),
          avgRank: { value: null, count: 0 },
        },
        perplexity: {
          visibility: r(0, 1),
          citationRate: r(0, 1),
          top3Rate: r(0, 1),
          avgRank: { value: null, count: 0 },
        },
      },
      byCategory: { 'CRM tools': { visibility: r(1, 3), citationRate: r(1, 3) } },
      competitors: [
        {
          name: 'Globex',
          visibility: r(3, 3),
          avgRank: { value: 1, count: 3 },
          shareOfVoice: r(3, 4),
          citationRate: r(0, 3),
        },
      ],
      suggestedCompetitors: [{ name: 'Initech', mentions: 2, bestRank: 2, avgRank: 2.5 }],
      topCitedDomains: [
        { domain: 'acme.com', count: 1, platforms: ['chatgpt'], isBrand: true },
        { domain: 'g2.com', count: 2, platforms: ['chatgpt', 'perplexity'], isBrand: false },
      ],
    },
    checks: [
      {
        prompt: 'Best CRM for agencies?',
        category: 'CRM tools',
        platform: 'chatgpt',
        status: 'ok',
        mentioned: true,
        rank: null,
        cited: true,
        citedUrl: 'https://acme.com/crm',
        snippet: 'Acme is a CRM.',
        answer: 'Line one\nLine two',
        citations: [{ url: 'https://acme.com/crm', domain: 'acme.com', title: 'Acme CRM' }],
        competitors: [{ name: 'Globex', mentioned: true, rank: 1, cited: false }],
      },
      {
        prompt: 'Best CRM for agencies?',
        category: 'CRM tools',
        platform: 'perplexity',
        status: 'failed',
        mentioned: false,
        rank: null,
        cited: false,
        citedUrl: null,
        snippet: null,
        answer: '',
        citations: [],
        competitors: [],
      },
      {
        prompt: 'Cheapest CRM?',
        category: 'CRM tools',
        platform: 'chatgpt',
        status: 'ok',
        mentioned: false,
        rank: null,
        cited: false,
        citedUrl: null,
        snippet: null,
        answer: 'Globex.',
        citations: [{ url: 'https://g2.com/x', domain: 'g2.com', title: null }],
        competitors: [{ name: 'Globex', mentioned: true, rank: 1, cited: false }],
      },
      {
        prompt: 'Cheapest CRM?',
        category: 'CRM tools',
        platform: 'perplexity',
        status: 'ok',
        mentioned: false,
        rank: null,
        cited: false,
        citedUrl: null,
        snippet: null,
        answer: 'Globex again.',
        citations: [{ url: 'https://g2.com/y', domain: 'g2.com', title: 'G2' }],
        competitors: [{ name: 'Globex', mentioned: true, rank: 1, cited: false }],
      },
    ],
  };
}
