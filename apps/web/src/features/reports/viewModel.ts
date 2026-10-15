import {
  CHECK_ERROR_MESSAGES,
  type CheckResult,
  type CheckStatus,
  type CountryCode,
  type LanguageCode,
  type Platform,
  type PublicReport,
  type Run,
  type RunStatus,
} from '@pv/shared';
import type { ResultsFilter } from '../../lib/api/queryKeys';

/**
 * One shape for both report views (F-13, F-15): the owner view (a `Run` plus its results pages)
 * and the public share (a `PublicReport` with every check inline). Every number in here was
 * computed by the server (05); the adapters only rename and reshape.
 */

/** Server aggregates in the shape both sources share (the public one has no ids). */
export type ReportAggregates = NonNullable<PublicReport['aggregates']>;

export interface ReportCitation {
  url: string;
  domain: string;
  title: string | null;
}

export interface ReportCompetitorResult {
  name: string;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
}

export interface ReportCheck {
  /** Stable React key: the result id (owner) or the position in the payload (public). */
  key: string;
  /** Groups checks into result-table rows: the prompt id (owner) or the prompt text (public). */
  promptKey: string;
  prompt: string;
  category: string;
  platform: Platform;
  status: CheckStatus;
  answer: string;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
  citedUrl: string | null;
  snippet: string | null;
  citations: ReportCitation[];
  /** Vendors in answer order; null when the source doesn't include them (public shares). */
  vendors: string[] | null;
  competitors: ReportCompetitorResult[];
  /** Safe text for a failed check (never the provider's own message), else null. */
  errorMessage: string | null;
}

export interface ReportViewModel {
  brand: { name: string; domain: string };
  date: string;
  status: RunStatus;
  platforms: Platform[];
  country: CountryCode;
  city: string | null;
  language: LanguageCode;
  aggregates: ReportAggregates | null;
  /** Categories to filter by, from the server aggregates. */
  categories: string[];
  checks: ReportCheck[];
}

/** The results filters (server-side query params for the owner view, local for shares). */
export type ReportFilter = ResultsFilter;

const FAILED_FALLBACK = 'This check failed and was refunded.';

function checkErrorMessage(result: CheckResult): string | null {
  if (result.status !== 'failed') return null;
  if (result.error) return CHECK_ERROR_MESSAGES[result.error.code] ?? result.error.message;
  return FAILED_FALLBACK;
}

function categoriesOf(aggregates: ReportAggregates | null): string[] {
  return aggregates ? Object.keys(aggregates.byCategory) : [];
}

export function checkFromResult(result: CheckResult): ReportCheck {
  return {
    key: result.id,
    promptKey: result.promptId,
    prompt: result.promptText,
    category: result.category,
    platform: result.platform,
    status: result.status,
    answer: result.answer,
    mentioned: result.brand.mentioned,
    rank: result.brand.rank,
    cited: result.brand.cited,
    citedUrl: result.brand.citedUrl,
    snippet: result.brand.snippet,
    citations: result.citations.map(({ url, domain, title }) => ({ url, domain, title })),
    vendors: result.vendors,
    competitors: result.competitors.map(({ name, mentioned, rank, cited }) => ({
      name,
      mentioned,
      rank,
      cited,
    })),
    errorMessage: checkErrorMessage(result),
  };
}

/** Owner view: the run plus the result pages loaded so far (already server-filtered). */
export function fromRun(run: Run, results: CheckResult[]): ReportViewModel {
  const aggregates: ReportAggregates | null = run.aggregates;
  return {
    brand: { name: run.brand.name, domain: run.brand.domain },
    date: run.finishedAt ?? run.createdAt,
    status: run.status,
    platforms: run.config.platforms,
    country: run.config.country,
    city: run.config.city,
    language: run.config.language,
    aggregates,
    categories: categoriesOf(aggregates),
    checks: results.map(checkFromResult),
  };
}

/** Public share: everything is inline; there are no ids, vendors or error codes. */
export function fromPublicReport(report: PublicReport): ReportViewModel {
  return {
    brand: report.brand,
    date: report.run.date,
    status: report.run.status,
    platforms: report.run.platforms,
    country: report.run.country,
    city: report.run.city,
    language: report.run.language,
    aggregates: report.aggregates,
    categories: categoriesOf(report.aggregates),
    checks: report.checks.map((c, i) => ({
      key: String(i),
      promptKey: c.prompt,
      prompt: c.prompt,
      category: c.category,
      platform: c.platform,
      status: c.status,
      answer: c.answer,
      mentioned: c.mentioned,
      rank: c.rank,
      cited: c.cited,
      citedUrl: c.citedUrl,
      snippet: c.snippet,
      citations: c.citations,
      vendors: null,
      competitors: c.competitors,
      errorMessage: c.status === 'failed' ? FAILED_FALLBACK : null,
    })),
  };
}

/** The same filters the server applies to `/runs/:id/results`, for the inline public checks. */
export function filterChecks(checks: ReportCheck[], filter: ReportFilter): ReportCheck[] {
  return checks.filter(
    (c) =>
      (filter.platform === undefined || c.platform === filter.platform) &&
      (filter.category === undefined || c.category === filter.category) &&
      (filter.status === undefined || c.status === filter.status) &&
      (filter.mentioned === undefined || c.mentioned === filter.mentioned),
  );
}

export interface ResultRow {
  promptKey: string;
  prompt: string;
  category: string;
  cells: Partial<Record<Platform, ReportCheck>>;
}

/** Prompt rows × platform cells, in the order the checks arrived. Display grouping only. */
export function groupByPrompt(checks: ReportCheck[]): ResultRow[] {
  const rows = new Map<string, ResultRow>();
  for (const check of checks) {
    let row = rows.get(check.promptKey);
    if (!row) {
      row = {
        promptKey: check.promptKey,
        prompt: check.prompt,
        category: check.category,
        cells: {},
      };
      rows.set(check.promptKey, row);
    }
    row.cells[check.platform] = check;
  }
  return [...rows.values()];
}

/** True when the citation's domain is the brand's domain or a subdomain of it (display only). */
export function isBrandDomain(domain: string, brandDomain: string): boolean {
  const clean = (d: string) => d.toLowerCase().replace(/^www\./, '');
  const d = clean(domain);
  const b = clean(brandDomain);
  return b !== '' && (d === b || d.endsWith(`.${b}`));
}
