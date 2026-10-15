import ExcelJS from 'exceljs';
import {
  PLATFORM_LABELS,
  countryName,
  languageName,
  type Platform,
  type Ratio,
  type RunAggregates,
} from '@pv/shared';
import type { ResultDoc } from '../results/repo';
import type { RunDoc } from './repo';

/**
 * The run export (F-39, 08): Summary, Prompt Rankings, AI Answers, Citations, Competitors. Every
 * number comes from the run's stored aggregates (05), so the file matches the report on screen.
 * Costs and models stay out: the file is meant to be sent to clients.
 */

const pct = (r: Ratio | undefined) => (r?.rate == null ? '—' : `${Math.round(r.rate * 100)}%`);
const frac = (r: Ratio | undefined) => (r ? `${r.num} / ${r.den}` : '—');
const rank = (v: number | null) => (v === null ? '—' : Math.round(v * 10) / 10);
const label = (p: Platform) => PLATFORM_LABELS[p];
// Excel caps a cell at 32,767 characters.
const cell = (s: string) => (s.length > 32_000 ? `${s.slice(0, 32_000)}…` : s);

function header(ws: ExcelJS.Worksheet): void {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function buildRunWorkbook(run: RunDoc, results: ResultDoc[]): Promise<Buffer> {
  const agg: RunAggregates | null = run.aggregates;
  const brandName = run.brandSnapshot.name;
  const competitors = run.brandSnapshot.competitors;
  const platforms = run.config.platforms;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PromptVerse';
  wb.created = run.createdAt;

  // ---- Summary
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { width: 30 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
  ];
  const location = `${countryName(run.config.country)}${run.config.city ? `, ${run.config.city}` : ' (national)'}`;
  const rows: (string | number)[][] = [
    ['Brand', brandName],
    ['Website', run.brandSnapshot.domain],
    ['Location', location],
    ['Language', languageName(run.config.language)],
    ['Platforms', platforms.map(label).join(', ')],
    ['Run date', run.createdAt.toISOString().slice(0, 10)],
    ['Status', run.status],
    ['Prompts', run.promptIds.length],
    ['Checks', run.counts.total],
    ['Answered', run.counts.ok],
    ['No answer', run.counts.noAnswer],
    ['Failed (refunded)', run.counts.failed],
    ['Canceled (refunded)', run.counts.canceled],
    [],
    ['Visibility', pct(agg?.total.visibility), frac(agg?.total.visibility)],
    ['Citation rate', pct(agg?.total.citationRate), frac(agg?.total.citationRate)],
    ['Prompt coverage', pct(agg?.total.promptCoverage), frac(agg?.total.promptCoverage)],
    ['Top-3 rate', pct(agg?.total.top3Rate), frac(agg?.total.top3Rate)],
    [
      'Average rank',
      rank(agg?.total.avgRank.value ?? null),
      `across ${agg?.total.avgRank.count ?? 0} answers`,
    ],
    ['Share of voice', pct(agg?.total.shareOfVoice), frac(agg?.total.shareOfVoice)],
    [],
    ['Platform', 'Visibility', 'Citation rate', 'Top-3 rate', 'Average rank', 'AI Overview shown'],
    ...platforms.map((p) => {
      const a = agg?.byPlatform[p];
      return [
        label(p),
        pct(a?.visibility),
        pct(a?.citationRate),
        pct(a?.top3Rate),
        rank(a?.avgRank.value ?? null),
        p === 'google_aio' ? pct(a?.aioPresence) : '',
      ];
    }),
    [],
    ['Category', 'Visibility', 'Citation rate'],
    ...Object.entries(agg?.byCategory ?? {}).map(([category, a]) => [
      category,
      pct(a.visibility),
      pct(a.citationRate),
    ]),
  ];
  rows.forEach((r) => sum.addRow(r));
  sum.getColumn(1).font = { bold: true };

  // ---- Prompt Rankings (one row per check)
  const pr = wb.addWorksheet('Prompt Rankings');
  pr.columns = [
    { header: 'Category', width: 26 },
    { header: 'Prompt', width: 60 },
    { header: 'Platform', width: 20 },
    { header: 'Status', width: 11 },
    { header: `${brandName} rank`, width: 14 },
    { header: 'Mentioned', width: 11 },
    { header: 'Website cited', width: 13 },
    ...competitors.map((c) => ({ header: `${c.name} rank`, width: 16 })),
    { header: 'All companies named (in order)', width: 80 },
    { header: `${brandName} cited URL`, width: 50 },
    { header: 'Snippet', width: 80 },
  ];
  for (const r of results) {
    pr.addRow([
      r.category,
      r.promptText,
      label(r.platform),
      r.status,
      r.brand.rank ?? '—',
      r.brand.mentioned ? 'Yes' : 'No',
      r.brand.cited ? 'Yes' : 'No',
      ...competitors.map(
        (c) => r.competitors.find((x) => x.competitorId.equals(c._id))?.rank ?? '—',
      ),
      r.vendors.map((v, i) => `${i + 1}. ${v}`).join(' | '),
      r.brand.citedUrl ?? '',
      cell(r.brand.snippet ?? ''),
    ]);
  }
  header(pr);

  // ---- AI Answers
  const answers = wb.addWorksheet('AI Answers');
  answers.columns = [
    { header: 'Prompt', width: 50 },
    { header: 'Platform', width: 20 },
    { header: 'Status', width: 11 },
    { header: 'Answer', width: 120 },
  ];
  for (const r of results) {
    answers.addRow([r.promptText, label(r.platform), r.status, cell(r.answer)]);
  }
  header(answers);
  answers.getColumn(4).alignment = { wrapText: true, vertical: 'top' };

  // ---- Citations
  const cites = wb.addWorksheet('Citations');
  cites.columns = [
    { header: 'Prompt', width: 50 },
    { header: 'Platform', width: 20 },
    { header: '#', width: 5 },
    { header: 'Domain', width: 30 },
    { header: 'Title', width: 50 },
    { header: 'URL', width: 80 },
  ];
  for (const r of results) {
    for (const c of r.citations) {
      cites.addRow([r.promptText, label(r.platform), c.position, c.domain, c.title ?? '', c.url]);
    }
  }
  header(cites);

  // ---- Competitors
  const comp = wb.addWorksheet('Competitors');
  comp.columns = [
    { header: 'Company', width: 30 },
    { header: 'Tracked', width: 10 },
    { header: 'Visibility', width: 12 },
    { header: 'Mentions', width: 12 },
    { header: 'Average rank', width: 14 },
    { header: 'Share of voice', width: 15 },
    { header: 'Citation rate', width: 14 },
  ];
  if (agg) {
    comp.addRow([
      `${brandName} (you)`,
      'Yes',
      pct(agg.total.visibility),
      agg.total.visibility.num,
      rank(agg.total.avgRank.value),
      pct(agg.total.shareOfVoice),
      pct(agg.total.citationRate),
    ]);
    for (const c of agg.competitors) {
      comp.addRow([
        c.name,
        'Yes',
        pct(c.visibility),
        c.visibility.num,
        rank(c.avgRank.value),
        pct(c.shareOfVoice),
        pct(c.citationRate),
      ]);
    }
    for (const s of agg.suggestedCompetitors) {
      comp.addRow([s.name, 'Suggested', '', s.mentions, rank(s.avgRank), '', '']);
    }
  }
  header(comp);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
