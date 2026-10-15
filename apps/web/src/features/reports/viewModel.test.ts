import { publicReportSchema, type CheckResult, type Run } from '@pv/shared';
import { describe, expect, it } from 'vitest';
import { publicReportFixture } from './__fixtures__/publicReport';
import { filterChecks, fromPublicReport, fromRun, groupByPrompt, isBrandDomain } from './viewModel';

describe('fromPublicReport', () => {
  it('accepts the fixture as a valid public report', () => {
    expect(publicReportSchema.safeParse(publicReportFixture()).success).toBe(true);
  });

  it('maps the public payload onto the report view model', () => {
    const vm = fromPublicReport(publicReportFixture());
    expect(vm.brand).toEqual({ name: 'Acme', domain: 'acme.com' });
    expect(vm.status).toBe('partial');
    expect(vm.platforms).toEqual(['chatgpt', 'perplexity']);
    expect(vm.date).toBe('2026-10-01T12:00:00.000Z');
    expect(vm.categories).toEqual(['CRM tools']);
    expect(vm.aggregates?.total.visibility).toEqual({ num: 1, den: 3, rate: 1 / 3 });
    expect(vm.checks).toHaveLength(4);

    const [first, failed] = vm.checks;
    expect(first).toMatchObject({
      key: '0',
      promptKey: 'Best CRM for agencies?',
      mentioned: true,
      rank: null,
      cited: true,
      citedUrl: 'https://acme.com/crm',
      snippet: 'Acme is a CRM.',
      answer: 'Line one\nLine two',
      // Public shares carry no vendor list and no error codes.
      vendors: null,
      errorMessage: null,
    });
    expect(failed?.errorMessage).toMatch(/failed/);
  });

  it('keeps a report without aggregates', () => {
    const vm = fromPublicReport({ ...publicReportFixture(), aggregates: null });
    expect(vm.aggregates).toBeNull();
    expect(vm.categories).toEqual([]);
  });
});

describe('fromRun', () => {
  it('uses result ids and the safe message for an error code', () => {
    const run = {
      brand: { name: 'Acme', domain: 'acme.com', competitors: [] },
      status: 'completed',
      config: { platforms: ['claude'], country: 'US', city: null, language: 'en' },
      aggregates: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      finishedAt: '2026-10-01T00:05:00.000Z',
    } as unknown as Run;
    const result: CheckResult = {
      id: 'r1',
      promptId: 'p1',
      promptText: 'Q?',
      category: 'C',
      platform: 'claude',
      status: 'failed',
      answer: '',
      citations: [{ url: 'https://x.com', domain: 'x.com', title: null, position: 1 }],
      vendors: ['X'],
      brand: { mentioned: false, rank: null, cited: false, citedUrl: null, snippet: null },
      competitors: [],
      model: 'm',
      error: { code: 'refused', message: 'raw provider text' },
    };
    const vm = fromRun(run, [result]);
    expect(vm.date).toBe('2026-10-01T00:05:00.000Z');
    expect(vm.checks[0]).toMatchObject({ key: 'r1', promptKey: 'p1', vendors: ['X'] });
    expect(vm.checks[0]?.errorMessage).toMatch(/declined/);
    expect(vm.checks[0]?.citations[0]).toEqual({
      url: 'https://x.com',
      domain: 'x.com',
      title: null,
    });
  });
});

describe('filterChecks', () => {
  const checks = fromPublicReport(publicReportFixture()).checks;

  it('filters like the server: platform, category, status, mentioned', () => {
    expect(filterChecks(checks, {})).toHaveLength(4);
    expect(filterChecks(checks, { platform: 'perplexity' })).toHaveLength(2);
    expect(filterChecks(checks, { status: 'failed' })).toHaveLength(1);
    expect(filterChecks(checks, { mentioned: true })).toHaveLength(1);
    expect(filterChecks(checks, { category: 'Other' })).toHaveLength(0);
    expect(filterChecks(checks, { platform: 'chatgpt', mentioned: false })).toHaveLength(1);
  });
});

describe('groupByPrompt', () => {
  it('builds prompt rows with one cell per platform', () => {
    const rows = groupByPrompt(fromPublicReport(publicReportFixture()).checks);
    expect(rows.map((r) => r.prompt)).toEqual(['Best CRM for agencies?', 'Cheapest CRM?']);
    expect(Object.keys(rows[0]!.cells)).toEqual(['chatgpt', 'perplexity']);
  });
});

describe('isBrandDomain', () => {
  it('matches the domain and its subdomains only', () => {
    expect(isBrandDomain('www.acme.com', 'acme.com')).toBe(true);
    expect(isBrandDomain('blog.acme.com', 'acme.com')).toBe(true);
    expect(isBrandDomain('notacme.com', 'acme.com')).toBe(false);
  });
});
