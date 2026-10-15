import type { jsPDF } from 'jspdf';
import { runStatusLabel } from '../../../components/ui/Badge';
import { PLATFORM_COLORS, PLATFORM_SHORT } from '../../../components/ui/PlatformIcon';
import {
  formatDateTime,
  languageLabel,
  locationLabel,
  pluralize,
  rank,
  ratioChartValue,
  ratioFraction,
  ratioPct,
  type RatioLike,
} from '../../../lib/format';
import type { ReportViewModel } from '../viewModel';
import {
  barRows,
  COLORS,
  Cursor,
  fill,
  fit,
  footers,
  heading,
  hexToRgb,
  MARGIN,
  pdfText,
  setColor,
  type BarRow,
  type Rgb,
} from './pdfKit';
import { results } from './pdfResults';

const ratioText = (r: RatioLike | null | undefined) => `${ratioPct(r)} (${ratioFraction(r)})`;

function title(pdf: jsPDF, cur: Cursor, report: ReportViewModel): void {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  setColor(pdf, COLORS.primary);
  pdf.text(fit(pdf, report.brand.name, cur.contentWidth), MARGIN, cur.y + 4);
  pdf.setFont('helvetica', 'normal');
  cur.y += 12;
  pdf.setFontSize(14);
  setColor(pdf, COLORS.muted);
  pdf.text('AI Visibility Report', MARGIN, cur.y);
  cur.y += 7;
  pdf.setFontSize(9);
  const meta = [
    report.brand.domain,
    formatDateTime(report.date),
    locationLabel(report.country, report.city),
    languageLabel(report.language),
    report.platforms.map((p) => PLATFORM_SHORT[p]).join(', '),
    runStatusLabel(report.status),
  ].join('  |  ');
  pdf.text(fit(pdf, meta, cur.contentWidth), MARGIN, cur.y);
  cur.y += 10;
}

interface Tile {
  label: string;
  value: string;
  sub: string;
  color: Rgb;
}

function tiles(pdf: jsPDF, cur: Cursor, report: ReportViewModel): void {
  const t = report.aggregates?.total;
  const aio = report.aggregates?.byPlatform.google_aio?.aioPresence;
  const list: Tile[] = [
    {
      label: 'Visibility',
      value: ratioPct(t?.visibility),
      sub: ratioFraction(t?.visibility),
      color: COLORS.primary,
    },
    {
      label: 'Citation rate',
      value: ratioPct(t?.citationRate),
      sub: ratioFraction(t?.citationRate),
      color: COLORS.blue,
    },
    {
      label: 'Prompt coverage',
      value: ratioPct(t?.promptCoverage),
      sub: ratioFraction(t?.promptCoverage),
      color: COLORS.green,
    },
    {
      label: 'Top-3 rate',
      value: ratioPct(t?.top3Rate),
      sub: ratioFraction(t?.top3Rate),
      color: COLORS.primary,
    },
    {
      label: 'Average rank',
      value: rank(t?.avgRank.value),
      sub: `${pluralize(t?.avgRank.count ?? 0, 'answer')} ranked`,
      color: COLORS.blue,
    },
    {
      label: 'Share of voice',
      value: ratioPct(t?.shareOfVoice),
      sub: ratioFraction(t?.shareOfVoice),
      color: COLORS.green,
    },
  ];
  if (aio)
    list.push({
      label: 'AI Overviews presence',
      value: ratioPct(aio),
      sub: ratioFraction(aio),
      color: COLORS.red,
    });

  const perRow = 4;
  const gap = 3;
  const w = (cur.contentWidth - gap * (perRow - 1)) / perRow;
  const h = 22;
  list.forEach((tile, i) => {
    if (i % perRow === 0) {
      if (i > 0) cur.y += h + gap;
      cur.ensure(h + 2);
    }
    const x = MARGIN + (i % perRow) * (w + gap);
    fill(pdf, COLORS.card);
    pdf.roundedRect(x, cur.y, w, h, 2, 2, 'F');
    pdf.setFontSize(8);
    setColor(pdf, COLORS.muted);
    pdf.text(fit(pdf, tile.label, w - 6), x + 3, cur.y + 6);
    pdf.setFontSize(15);
    setColor(pdf, tile.color);
    pdf.text(pdfText(tile.value), x + 3, cur.y + 14);
    pdf.setFontSize(7);
    setColor(pdf, COLORS.faint);
    pdf.text(fit(pdf, tile.sub, w - 6), x + 3, cur.y + 19);
  });
  cur.y += h + 12;
}

function breakdowns(pdf: jsPDF, cur: Cursor, report: ReportViewModel): void {
  const agg = report.aggregates;
  if (!agg) return;

  heading(pdf, cur, 'Visibility by platform');
  const platformRows: BarRow[] = report.platforms.flatMap((p) => {
    const row = agg.byPlatform[p];
    return row
      ? [
          {
            label: PLATFORM_SHORT[p],
            value: ratioChartValue(row.visibility),
            text: ratioText(row.visibility),
            color: hexToRgb(PLATFORM_COLORS[p]),
          },
        ]
      : [];
  });
  barRows(pdf, cur, platformRows);
  pdf.setFontSize(10);
  setColor(pdf, COLORS.muted);
  pdf.text(`Overall visibility: ${pdfText(ratioText(agg.total.visibility))}`, MARGIN, cur.y);
  cur.y += 12;

  const categories = Object.entries(agg.byCategory).sort(
    ([, a], [, b]) => ratioChartValue(b.visibility) - ratioChartValue(a.visibility),
  );
  if (categories.length > 0) {
    heading(pdf, cur, 'Visibility by category');
    barRows(
      pdf,
      cur,
      categories.map(([name, row]) => ({
        label: name,
        value: ratioChartValue(row.visibility),
        text: ratioText(row.visibility),
        color: COLORS.green,
      })),
    );
    cur.y += 4;
  }

  if (agg.competitors.length > 0) {
    heading(pdf, cur, 'Share of voice');
    barRows(pdf, cur, [
      {
        label: report.brand.name,
        value: ratioChartValue(agg.total.shareOfVoice),
        text: ratioText(agg.total.shareOfVoice),
        color: COLORS.primary,
      },
      ...agg.competitors.map((c) => ({
        label: c.name,
        value: ratioChartValue(c.shareOfVoice),
        text: ratioText(c.shareOfVoice),
        color: COLORS.muted,
      })),
    ]);
    cur.y += 4;
  }
}

/**
 * The report as a PDF (F-16), ported from v1 `pdfGenerator.js` with jsPDF only. jsPDF is loaded
 * on demand so it stays out of the main bundle. `report.checks` are the rows currently shown.
 */
export async function generateReportPdf(report: ReportViewModel): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const cur = new Cursor(pdf);
  title(pdf, cur, report);
  tiles(pdf, cur, report);
  breakdowns(pdf, cur, report);
  results(pdf, cur, report.checks);
  footers(pdf);
  const safeName = report.brand.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Brand';
  pdf.save(`${safeName}_Visibility_Report.pdf`);
}
