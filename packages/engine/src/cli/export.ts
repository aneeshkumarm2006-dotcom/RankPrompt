import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  PLATFORM_LABELS,
  type Platform,
  averageRank,
  citedRate,
  countryName,
  type CountryCode,
  visibility,
} from '@pv/shared';
import { hostOf } from '../domain';
import { type ResultRecord, type RunMeta, readResults, readRunMeta } from './runner';

/**
 * XLSX in the luna export layout (F-40): Summary, Prompt Rankings, Firms Named, Top Cited Domains,
 * AI Answers, Citations. Luna runs were one platform per file; here every sheet carries a
 * Platform column so one file covers the whole run.
 */

const pct = (rate: number | null) => (rate === null ? '-' : Math.round(rate * 100));
const round1 = (n: number | null) => (n === null ? '-' : Math.round(n * 10) / 10);
const usd = (micros: number) => Math.round(micros / 100) / 10_000;
const bold = (ws: ExcelJS.Worksheet) => {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
};

type Scored = {
  status: ResultRecord['status'];
  mentioned: boolean;
  cited: boolean;
  rank: number | null;
};
const brandScore = (r: ResultRecord): Scored => ({
  status: r.status,
  mentioned: r.match?.brand.mentioned ?? false,
  cited: r.match?.brand.cited ?? false,
  rank: r.match?.brand.rank ?? null,
});
const competitorScore = (r: ResultRecord, name: string): Scored => {
  const c = r.match?.competitors.find((x) => x.name === name);
  return {
    status: r.status,
    mentioned: c?.mentioned ?? false,
    cited: c?.cited ?? false,
    rank: c?.rank ?? null,
  };
};

export function buildWorkbook(meta: RunMeta, results: ResultRecord[]): ExcelJS.Workbook {
  const { spec } = meta;
  const platforms = spec.platforms.filter((p) => results.some((r) => r.platform === p));
  const order = (r: ResultRecord) => r.promptIndex * 10 + spec.platforms.indexOf(r.platform);
  const rows = [...results].sort((a, b) => order(a) - order(b));
  const answered = rows.filter((r) => r.status === 'ok');
  const comps = spec.competitors.map((c) => c.name);
  const label = (p: Platform) => PLATFORM_LABELS[p];
  const models = (p: Platform) =>
    [...new Set(rows.filter((r) => r.platform === p && r.model).map((r) => r.model))].join(', ');
  const wb = new ExcelJS.Workbook();

  // ---- Summary
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { width: 30 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];
  const location = `${countryName(spec.country as CountryCode)}${spec.city ? `, ${spec.city}` : ' (national)'}`;
  const all = rows.map(brandScore);
  const cost = rows.reduce((s, r) => s + r.costMicros, 0);
  [
    ['Brand', spec.brand.name],
    ['Website', spec.brand.domain ?? ''],
    ['Aliases', (spec.brand.aliases ?? []).join(', ')],
    ['Location', location],
    ['Language', spec.language],
    ['Platforms', platforms.map((p) => `${label(p)} (${models(p)})`).join('; ')],
    ['Run date', meta.createdAt.slice(0, 10)],
    ['Engine', meta.engineVersion],
    ['Prompts', spec.prompts.length],
    ['Checks answered', answered.length],
    ['Brand mentioned', visibility(all).num],
    ['Website cited', citedRate(all).num],
    ['Visibility %', pct(visibility(all).rate)],
    ['Average rank (when ranked)', round1(averageRank(all))],
    ['Total cost (USD)', usd(cost)],
    [],
    [
      'Platform',
      'Checks',
      'Answered',
      'No answer',
      'Failed',
      'Mentioned',
      'Cited',
      'Visibility %',
      'Avg rank',
      'Cost (USD)',
      'Cost/check (USD)',
    ],
    ...platforms.map((p) => {
      const rs = rows.filter((r) => r.platform === p);
      const sc = rs.map(brandScore);
      const c = rs.reduce((s, r) => s + r.costMicros, 0);
      return [
        label(p),
        rs.length,
        rs.filter((r) => r.status === 'ok').length,
        rs.filter((r) => r.status === 'no_answer').length,
        rs.filter((r) => r.status === 'failed').length,
        visibility(sc).num,
        citedRate(sc).num,
        pct(visibility(sc).rate),
        round1(averageRank(sc)),
        usd(c),
        rs.length ? usd(c / rs.length) : 0,
      ];
    }),
    [],
    ['Competitor', ...platforms.map((p) => `${label(p)}: mentions / avg rank`)],
    [
      spec.brand.name,
      ...platforms.map((p) => {
        const sc = rows.filter((r) => r.platform === p).map(brandScore);
        return `${visibility(sc).num} / ${round1(averageRank(sc))}`;
      }),
    ],
    ...comps.map((name) => [
      name,
      ...platforms.map((p) => {
        const sc = rows.filter((r) => r.platform === p).map((r) => competitorScore(r, name));
        return `${visibility(sc).num} / ${round1(averageRank(sc))}`;
      }),
    ]),
    [],
    ['Category', 'Prompts', 'Answered', `${spec.brand.name} mentioned`, 'Answers naming a firm'],
    ...[...new Set(spec.prompts.map((p) => p.category ?? '(none)'))].map((cat) => {
      const rs = rows.filter((r) => (r.category ?? '(none)') === cat);
      return [
        cat,
        spec.prompts.filter((p) => (p.category ?? '(none)') === cat).length,
        rs.filter((r) => r.status === 'ok').length,
        visibility(rs.map(brandScore)).num,
        rs.filter((r) => r.vendors.length).length,
      ];
    }),
  ].forEach((r) => sum.addRow(r));
  sum.getColumn(1).font = { bold: true };

  // ---- Prompt Rankings (one row per prompt × platform)
  const pr = wb.addWorksheet('Prompt Rankings');
  pr.columns = [
    { header: '#', width: 5 },
    { header: 'Category', width: 26 },
    { header: 'Keyword', width: 30 },
    { header: 'Volume', width: 9 },
    { header: 'KD', width: 6 },
    { header: 'Intent', width: 18 },
    { header: 'Prompt', width: 60 },
    { header: 'Platform', width: 20 },
    { header: 'Status', width: 10 },
    { header: `${spec.brand.name} Rank`, width: 13 },
    { header: 'Mentioned', width: 11 },
    { header: 'Website Cited', width: 13 },
    ...comps.map((k) => ({ header: `${k} Rank`, width: 16 })),
    { header: 'All Firms Ranked (in order)', width: 80 },
    { header: `${spec.brand.name} Cited URL`, width: 50 },
    { header: 'Snippet', width: 80 },
    { header: 'Error', width: 40 },
  ];
  for (const r of rows) {
    const p = spec.prompts[r.promptIndex];
    const b = r.match?.brand;
    pr.addRow([
      r.promptIndex + 1,
      r.category ?? '',
      r.keyword ?? '',
      p?.volume ?? '',
      p?.kd ?? '',
      p?.intent ?? '',
      r.prompt,
      label(r.platform),
      r.status,
      b?.rank ?? '-',
      b?.mentioned ? 'Yes' : 'No',
      b?.cited ? 'Yes' : 'No',
      ...comps.map((k) => r.match?.competitors.find((c) => c.name === k)?.rank ?? '-'),
      r.vendors.map((v, j) => `${j + 1}. ${v}`).join(' | '),
      b?.citedUrl ?? '',
      b?.snippet ?? '',
      r.error ? `${r.error.code}: ${r.error.message}` : '',
    ]);
  }
  bold(pr);

  // ---- Firms Named
  const firms = new Map<
    string,
    { name: string; ranks: number[]; platforms: Set<Platform>; prompts: Set<string> }
  >();
  for (const r of answered) {
    r.vendors.forEach((v, j) => {
      const k = v.toLowerCase();
      const f = firms.get(k) ?? { name: v, ranks: [], platforms: new Set(), prompts: new Set() };
      f.ranks.push(j + 1);
      f.platforms.add(r.platform);
      f.prompts.add(r.keyword ?? r.prompt);
      firms.set(k, f);
    });
  }
  const fn = wb.addWorksheet('Firms Named');
  fn.columns = [
    { header: 'Firm', width: 44 },
    { header: 'Answers named in', width: 17 },
    { header: 'Avg position', width: 13 },
    { header: 'Times #1', width: 10 },
    { header: 'Platforms', width: 40 },
    { header: 'Prompts / keywords', width: 90 },
  ];
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  [...firms.values()]
    .sort((a, b) => b.ranks.length - a.ranks.length || avg(a.ranks) - avg(b.ranks))
    .forEach((f) =>
      fn.addRow([
        f.name,
        f.ranks.length,
        round1(avg(f.ranks)),
        f.ranks.filter((x) => x === 1).length,
        [...f.platforms].map(label).join(', '),
        [...f.prompts].join(' | '),
      ]),
    );
  bold(fn);

  // ---- Top Cited Domains
  const doms = new Map<string, number>();
  for (const r of answered) {
    for (const h of new Set(r.citations.map((c) => c.domain || hostOf(c.url)).filter(Boolean)))
      doms.set(h, (doms.get(h) ?? 0) + 1);
  }
  const cd = wb.addWorksheet('Top Cited Domains');
  cd.columns = [
    { header: 'Domain', width: 40 },
    { header: 'Answers citing it', width: 18 },
    { header: '% of answers', width: 13 },
  ];
  [...doms.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([h, c]) =>
      cd.addRow([h, c, answered.length ? Math.round((c / answered.length) * 100) : 0]),
    );
  bold(cd);

  // ---- AI Answers
  const ans = wb.addWorksheet('AI Answers');
  ans.columns = [
    { header: '#', width: 5 },
    { header: 'Platform', width: 20 },
    { header: 'Keyword', width: 30 },
    { header: 'Prompt', width: 50 },
    { header: 'Answer', width: 120 },
  ];
  for (const r of rows) {
    if (r.status === 'failed') continue;
    const row = ans.addRow([
      r.promptIndex + 1,
      label(r.platform),
      r.keyword ?? '',
      r.prompt,
      r.status === 'no_answer' ? '(no answer shown)' : r.answer,
    ]);
    row.alignment = { wrapText: true, vertical: 'top' };
  }
  bold(ans);

  // ---- Citations
  const cit = wb.addWorksheet('Citations');
  cit.columns = [
    { header: '#', width: 5 },
    { header: 'Platform', width: 20 },
    { header: 'Keyword', width: 30 },
    { header: 'Prompt', width: 50 },
    { header: 'Source Title', width: 50 },
    { header: 'Domain', width: 28 },
    { header: 'URL', width: 90 },
  ];
  for (const r of rows)
    for (const c of r.citations)
      cit.addRow([
        r.promptIndex + 1,
        label(r.platform),
        r.keyword ?? '',
        r.prompt,
        c.title ?? '',
        c.domain,
        c.url,
      ]);
  bold(cit);

  return wb;
}

export async function exportRun(inDir: string, xlsxPath: string): Promise<{ rows: number }> {
  const meta = readRunMeta(inDir);
  const results = [...readResults(inDir).values()];
  const wb = buildWorkbook(meta, results);
  fs.mkdirSync(path.dirname(path.resolve(xlsxPath)), { recursive: true });
  await wb.xlsx.writeFile(xlsxPath);
  return { rows: results.length };
}
