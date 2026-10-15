import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { Platform } from '@pv/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeAdapter, createFakeExtractor } from '../src/adapters/fake';
import { buildWorkbook, exportRun } from '../src/cli/export';
import { loadCompetitors, loadPrompts, parseCsv } from '../src/cli/inputs';
import { RESULTS_FILE, readResults, readRunMeta, runBatch, type RunSpec } from '../src/cli/runner';
import type { Engine } from '../src/config';
import { ProviderError } from '../src/errors';
import type { PlatformAdapter } from '../src/types';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-engine-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (name: string, text: string) => {
  const f = path.join(dir, name);
  fs.writeFileSync(f, text);
  return f;
};

describe('inputs', () => {
  it('parses RFC 4180 CSV with quotes, commas, newlines and a BOM', () => {
    expect(parseCsv('\u{FEFF}a,b\r\n"x, ""y""","multi\nline"\n\n')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'multi\nline'],
    ]);
  });

  it('loads prompts from CSV (luna keyword-sheet columns), JSON and TXT', () => {
    const csv = write(
      'p.csv',
      'Category,Prompt,Keyword,Volume,KD,Intent\nBill C-3,"What is Bill C-3, really?",bill c-3,390,44,Informational\n,,,,,\n',
    );
    expect(loadPrompts(csv)).toEqual([
      {
        category: 'Bill C-3',
        prompt: 'What is Bill C-3, really?',
        keyword: 'bill c-3',
        volume: 390,
        kd: 44,
        intent: 'Informational',
      },
    ]);
    const json = write(
      'p.json',
      JSON.stringify(['one', { prompt: 'two', category: 'C', volume: null }]),
    );
    expect(loadPrompts(json)).toEqual([{ prompt: 'one' }, { prompt: 'two', category: 'C' }]);
    expect(loadPrompts(write('p.txt', 'a\n\nb\n'))).toEqual([{ prompt: 'a' }, { prompt: 'b' }]);
    expect(() => loadPrompts(write('bad.csv', 'question2\nx\n'))).toThrow(/prompt/);
  });

  it('loads competitors with domain or website', () => {
    const f = write(
      'c.json',
      JSON.stringify([
        { name: 'Orion', website: 'https://orion.com/' },
        { name: 'Black Diamond', domain: 'sscblackdiamond.com', aliases: ['SS&C Black Diamond'] },
      ]),
    );
    expect(loadCompetitors(f)).toEqual([
      { name: 'Orion', domain: 'https://orion.com/', aliases: [] },
      { name: 'Black Diamond', domain: 'sscblackdiamond.com', aliases: ['SS&C Black Diamond'] },
    ]);
  });
});

const spec = (platforms: Platform[] = ['chatgpt', 'google_aio']): RunSpec => ({
  brand: { name: 'Globex', domain: 'globex.example', aliases: [] },
  competitors: [{ name: 'Initech', domain: 'initech.example' }],
  prompts: [
    { prompt: 'best crm', category: 'CRM' },
    { prompt: 'best erp', category: 'ERP' },
    { prompt: 'best hr tool' },
  ],
  platforms,
  country: 'US',
  language: 'en',
});

const fakeEngine = (overrides: Partial<Record<Platform, PlatformAdapter>> = {}): Engine => ({
  adapters: {
    chatgpt: createFakeAdapter('chatgpt'),
    google_aio: createFakeAdapter('google_aio'),
    ...overrides,
  },
  extractor: createFakeExtractor(),
  brandAI: undefined,
  missing: {},
});

describe('runBatch', () => {
  it('writes one line per check plus raw files, and a re-run skips finished checks', async () => {
    const out = path.join(dir, 'run');
    const first = await runBatch({
      spec: spec(),
      engine: fakeEngine(),
      outDir: out,
      concurrency: 3,
    });
    expect(first.ran).toBe(6);
    expect(readResults(out).size).toBe(6);
    expect(fs.readdirSync(path.join(out, 'raw', 'chatgpt'))).toHaveLength(3);
    expect(readRunMeta(out).engineVersion).toMatch(/^engine@/);
    const again = await runBatch({
      spec: spec(),
      engine: fakeEngine(),
      outDir: out,
      concurrency: 3,
    });
    expect(again).toMatchObject({ ran: 0, skipped: 6 });
  });

  it('retries transient errors, fails refusals, and re-runs failed checks on resume', async () => {
    const out = path.join(dir, 'run');
    let calls = 0;
    const flaky: PlatformAdapter = {
      ...createFakeAdapter('chatgpt'),
      ask(input, signal) {
        calls++;
        if (input.prompt === 'best erp')
          return Promise.reject(new ProviderError('openai', 'refused', 'nope'));
        if (calls === 1) return Promise.reject(new ProviderError('openai', 'transient', 'blip'));
        return createFakeAdapter('chatgpt').ask(input, signal);
      },
    };
    const sleeps: number[] = [];
    const sleep = (ms: number) => (sleeps.push(ms), Promise.resolve());
    const s = await runBatch({
      spec: spec(['chatgpt']),
      engine: fakeEngine({ chatgpt: flaky }),
      outDir: out,
      concurrency: 1,
      sleep,
    });
    expect(s.byPlatform.chatgpt).toMatchObject({ ok: 2, failed: 1 });
    expect(sleeps).toHaveLength(1);
    const failed = [...readResults(out).values()].find((r) => r.status === 'failed');
    expect(failed?.error).toMatchObject({ code: 'refused', kind: 'refused' });
    // Resume: only the failed check runs again (and now succeeds).
    const healed = await runBatch({
      spec: spec(['chatgpt']),
      engine: fakeEngine(),
      outDir: out,
      concurrency: 1,
      sleep,
    });
    expect(healed).toMatchObject({ ran: 1, skipped: 2 });
    expect([...readResults(out).values()].every((r) => r.status === 'ok')).toBe(true);
    // results.jsonl keeps history; the newest line wins.
    expect(fs.readFileSync(path.join(out, RESULTS_FILE), 'utf8').trim().split('\n')).toHaveLength(
      4,
    );
  });

  it('stops a provider for the run on a quota error', async () => {
    const broke: PlatformAdapter = {
      ...createFakeAdapter('chatgpt'),
      ask: () => Promise.reject(new ProviderError('openai', 'quota', 'insufficient_quota')),
    };
    const s = await runBatch({
      spec: spec(['chatgpt']),
      engine: fakeEngine({ chatgpt: broke }),
      outDir: path.join(dir, 'q'),
      concurrency: 1,
    });
    expect(s.byPlatform.chatgpt?.failed).toBe(3);
    expect([...readResults(path.join(dir, 'q')).values()].map((r) => r.error?.code).sort()).toEqual(
      ['provider_stopped', 'provider_stopped', 'quota'],
    );
  });

  it('refuses to mix runs for different brands in one directory', async () => {
    const out = path.join(dir, 'run');
    await runBatch({ spec: spec(['chatgpt']), engine: fakeEngine(), outDir: out, concurrency: 2 });
    await expect(
      runBatch({
        spec: { ...spec(['chatgpt']), brand: { name: 'Other' } },
        engine: fakeEngine(),
        outDir: out,
        concurrency: 2,
      }),
    ).rejects.toThrow(/holds a run for Globex/);
  });

  it('fails fast when a platform has no adapter', async () => {
    await expect(
      runBatch({
        spec: spec(['claude']),
        engine: { ...fakeEngine(), missing: { claude: 'ANTHROPIC_API_KEY is not set' } },
        outDir: dir,
        concurrency: 1,
      }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('export', () => {
  it('writes the luna sheet layout with a Platform column', async () => {
    const out = path.join(dir, 'run');
    await runBatch({ spec: spec(), engine: fakeEngine(), outDir: out, concurrency: 2 });
    const xlsx = path.join(dir, 'nested', 'Globex (US).xlsx');
    await exportRun(out, xlsx);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsx);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      'Prompt Rankings',
      'Firms Named',
      'Top Cited Domains',
      'AI Answers',
      'Citations',
    ]);
    const pr = wb.getWorksheet('Prompt Rankings');
    expect(pr?.getRow(1).values).toEqual(
      expect.arrayContaining([
        'Platform',
        'Status',
        'Globex Rank',
        'Initech Rank',
        'All Firms Ranked (in order)',
      ]),
    );
    expect(pr?.rowCount).toBe(1 + 6);
    expect(pr?.getRow(2).getCell(8).value).toBe('ChatGPT');
  });

  it('computes summary numbers through @pv/shared metrics (answered checks only)', () => {
    const meta = {
      spec: spec(['chatgpt']),
      engineVersion: 'e',
      pricesVersion: 'p',
      createdAt: '2026-10-14T00:00:00Z',
    };
    const base = {
      prompt: 'p',
      category: null,
      keyword: null,
      platform: 'chatgpt' as const,
      attempts: 1,
      error: null,
      model: 'm',
      answer: 'a',
      citations: [],
      vendors: [],
      usage: {},
      costMicros: 1000,
      answerCostMicros: 1000,
      extractCostMicros: 0,
      latencyMs: 1,
      engineVersion: 'e',
      finishedAt: '',
    };
    const m = (mentioned: boolean, rank: number | null) => ({
      brand: { mentioned, rank, cited: false, citedUrl: null, snippet: null },
      competitors: [],
      suggested: [],
    });
    const wb = buildWorkbook(meta, [
      { ...base, key: 'a', promptIndex: 0, status: 'ok', match: m(true, 1) },
      { ...base, key: 'b', promptIndex: 1, status: 'ok', match: m(false, null) },
      { ...base, key: 'c', promptIndex: 2, status: 'no_answer', match: m(false, null) },
    ]);
    const sum = wb.getWorksheet('Summary');
    const find = (label: string) =>
      sum
        ?.getRows(1, sum.rowCount)
        ?.find((r) => r.getCell(1).value === label)
        ?.getCell(2).value;
    expect(find('Checks answered')).toBe(2);
    expect(find('Visibility %')).toBe(50);
    expect(find('Average rank (when ranked)')).toBe(1);
    expect(find('Total cost (USD)')).toBe(0.003);
  });
});
