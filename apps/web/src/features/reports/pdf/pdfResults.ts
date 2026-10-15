import type { jsPDF } from 'jspdf';
import { checkStatusLabel } from '../../../components/ui/Badge';
import { PLATFORM_SHORT } from '../../../components/ui/PlatformIcon';
import { pluralize, rank } from '../../../lib/format';
import type { ReportCheck } from '../viewModel';
import type { Cursor } from './pdfKit';
import { COLORS, fill, fit, heading, MARGIN, pdfText, setColor } from './pdfKit';

/** Results rows in the PDF; the XLSX export has every row. */
export const PDF_MAX_ROWS = 150;

const COLS = {
  prompt: 0,
  category: 78,
  platform: 113,
  mentioned: 135,
  rank: 155,
  cited: 170,
} as const;

function tableHeader(pdf: jsPDF, cur: Cursor): void {
  fill(pdf, COLORS.card);
  pdf.rect(MARGIN, cur.y - 5, cur.contentWidth, 8, 'F');
  pdf.setFontSize(8);
  setColor(pdf, COLORS.muted);
  const labels: Record<keyof typeof COLS, string> = {
    prompt: 'Prompt',
    category: 'Category',
    platform: 'Platform',
    mentioned: 'Mentioned',
    rank: 'Rank',
    cited: 'Cited',
  };
  for (const key of Object.keys(COLS) as (keyof typeof COLS)[]) {
    pdf.text(labels[key], MARGIN + 2 + COLS[key], cur.y);
  }
  cur.y += 8;
}

function tableRow(pdf: jsPDF, cur: Cursor, check: ReportCheck, showPrompt: boolean): void {
  if (cur.ensure(7)) tableHeader(pdf, cur);
  const x = MARGIN + 2;
  pdf.setFontSize(8);
  setColor(pdf, COLORS.text);
  if (showPrompt) {
    pdf.text(fit(pdf, check.prompt, COLS.category - 4), x, cur.y);
    pdf.text(fit(pdf, check.category, COLS.platform - COLS.category - 3), x + COLS.category, cur.y);
  }
  pdf.text(PLATFORM_SHORT[check.platform], x + COLS.platform, cur.y);
  if (check.status !== 'ok') {
    setColor(pdf, COLORS.faint);
    pdf.text(checkStatusLabel(check.status), x + COLS.mentioned, cur.y);
  } else {
    setColor(pdf, check.mentioned ? COLORS.green : COLORS.red);
    pdf.text(check.mentioned ? 'Yes' : 'No', x + COLS.mentioned, cur.y);
    setColor(pdf, COLORS.text);
    pdf.text(pdfText(rank(check.rank)), x + COLS.rank, cur.y);
    setColor(pdf, check.cited ? COLORS.green : COLORS.faint);
    pdf.text(check.cited ? 'Yes' : 'No', x + COLS.cited, cur.y);
  }
  cur.y += 6;
}

export function results(pdf: jsPDF, cur: Cursor, checks: ReportCheck[]): void {
  heading(pdf, cur, 'Detailed results');
  if (checks.length === 0) {
    pdf.setFontSize(9);
    setColor(pdf, COLORS.muted);
    pdf.text('No results match the current filters.', MARGIN, cur.y);
    return;
  }
  // Rows grouped by prompt, as on screen: the prompt is printed on its first row only.
  const order = new Map<string, number>();
  for (const c of checks) if (!order.has(c.promptKey)) order.set(c.promptKey, order.size);
  const sorted = [...checks].sort(
    (a, b) => (order.get(a.promptKey) ?? 0) - (order.get(b.promptKey) ?? 0),
  );
  const included = sorted.slice(0, PDF_MAX_ROWS);

  tableHeader(pdf, cur);
  let previous: string | null = null;
  for (const check of included) {
    tableRow(pdf, cur, check, check.promptKey !== previous);
    previous = check.promptKey;
  }

  cur.ensure(10);
  cur.y += 4;
  pdf.setFontSize(9);
  setColor(pdf, COLORS.muted);
  const note =
    included.length < checks.length
      ? `Showing ${included.length} of ${checks.length} results. Export XLSX for every result.`
      : `All ${pluralize(checks.length, 'result')} included.`;
  pdf.text(note, MARGIN, cur.y);
}
