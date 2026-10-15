import type { CheckStatus, Platform } from './enums';

/**
 * Metric definitions (D-012, 05). Defined once here. The server computes every number with these
 * functions and stores them on the run; the UI, the PDF and the exports only display them. Any
 * change to a definition bumps METRICS_VERSION, which is stamped on every run at finalize.
 */
export const METRICS_VERSION = '1';

export interface Ratio {
  num: number;
  den: number;
  /** num ÷ den, or null when den is 0. The UI shows "—" for null, never 0%. */
  rate: number | null;
}
/** Every metric is returned as `{ num, den, rate }` (05). */
export type Metric = Ratio;

export const ratio = (num: number, den: number): Ratio => ({
  num,
  den,
  rate: den ? num / den : null,
});

/** Mean rank with its count ("avg #2.4 across 31 answers"). A missing rank is never filled in. */
export interface AvgRank {
  value: number | null;
  count: number;
}

/** Only `ok` checks count in metric denominators (`no_answer`, `failed`, `canceled` never do). */
export const isAnswered = (status: CheckStatus): boolean => status === 'ok';

/** One entity's score on one check: the brand, or one tracked competitor. */
export interface ScoredCheck {
  status: CheckStatus;
  mentioned: boolean;
  cited: boolean;
  rank: number | null;
}

const answeredOf = <T extends { status: CheckStatus }>(checks: readonly T[]): T[] =>
  checks.filter((c) => isAnswered(c.status));

/** Visibility = mentioned ÷ answered, pooled over whatever checks are passed in. */
export const visibility = (checks: readonly ScoredCheck[]): Ratio => {
  const answered = answeredOf(checks);
  return ratio(answered.filter((c) => c.mentioned).length, answered.length);
};

/** Citation rate = cited ÷ answered. A citation alone does not count as visible. */
export const citedRate = (checks: readonly ScoredCheck[]): Ratio => {
  const answered = answeredOf(checks);
  return ratio(answered.filter((c) => c.cited).length, answered.length);
};

/** Top-3 rate = answered checks with rank ≤ 3 ÷ answered. */
export const top3Rate = (checks: readonly ScoredCheck[]): Ratio => {
  const answered = answeredOf(checks);
  return ratio(answered.filter((c) => c.rank !== null && c.rank <= 3).length, answered.length);
};

/** Mean rank over answered checks where the entity was ranked, with how many there were. */
export const avgRank = (checks: readonly ScoredCheck[]): AvgRank => {
  const ranks = answeredOf(checks)
    .map((c) => c.rank)
    .filter((r): r is number => r !== null);
  return {
    value: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
    count: ranks.length,
  };
};

/** `avgRank().value`, for places that show only the number (the CLI export). */
export const averageRank = (checks: readonly ScoredCheck[]): number | null => avgRank(checks).value;

// ---- Run-level inputs -----------------------------------------------------------------------

/** What the metrics need from one stored check (`run_results`). */
export interface MetricCheck {
  promptId: string;
  category: string;
  platform: Platform;
  status: CheckStatus;
  brand: { mentioned: boolean; rank: number | null; cited: boolean };
  competitors: readonly {
    competitorId: string;
    mentioned: boolean;
    rank: number | null;
    cited: boolean;
  }[];
  /** Ordered vendor list from the extractor. */
  vendors: readonly string[];
  /** Vendors that matched neither the brand nor a tracked competitor. */
  suggested: readonly string[];
  citations: readonly { domain: string; url: string }[];
}

export interface TrackedCompetitor {
  id: string;
  name: string;
}

const brandScore = (c: MetricCheck): ScoredCheck => ({ status: c.status, ...c.brand });

const competitorScore = (c: MetricCheck, competitorId: string): ScoredCheck => {
  const m = c.competitors.find((x) => x.competitorId === competitorId);
  return {
    status: c.status,
    mentioned: m?.mentioned ?? false,
    cited: m?.cited ?? false,
    rank: m?.rank ?? null,
  };
};

/**
 * Prompt coverage = prompts with ≥1 answered check where the brand is mentioned ÷ prompts with
 * ≥1 answered check ("on how many questions do we show up anywhere?").
 */
export const promptCoverage = (checks: readonly MetricCheck[]): Ratio => {
  const answeredPrompts = new Set<string>();
  const coveredPrompts = new Set<string>();
  for (const c of answeredOf(checks)) {
    answeredPrompts.add(c.promptId);
    if (c.brand.mentioned) coveredPrompts.add(c.promptId);
  }
  return ratio(coveredPrompts.size, answeredPrompts.size);
};

/**
 * Share of voice over answered checks: an entity's mentions ÷ (brand mentions + mentions of every
 * tracked competitor). Each company counts at most once per check. Returns the shared denominator
 * plus each entity's mention count.
 */
function voiceCounts(
  checks: readonly MetricCheck[],
  competitors: readonly TrackedCompetitor[],
): { brand: number; byCompetitor: Map<string, number>; total: number } {
  let brand = 0;
  const byCompetitor = new Map(competitors.map((c) => [c.id, 0]));
  for (const c of answeredOf(checks)) {
    if (c.brand.mentioned) brand++;
    for (const comp of competitors) {
      if (c.competitors.some((x) => x.competitorId === comp.id && x.mentioned)) {
        byCompetitor.set(comp.id, (byCompetitor.get(comp.id) ?? 0) + 1);
      }
    }
  }
  const total = brand + [...byCompetitor.values()].reduce((a, b) => a + b, 0);
  return { brand, byCompetitor, total };
}

export const shareOfVoice = (
  checks: readonly MetricCheck[],
  competitors: readonly TrackedCompetitor[],
): Ratio => {
  const v = voiceCounts(checks, competitors);
  return ratio(v.brand, v.total);
};

/**
 * AI Overview presence = `google_aio` checks with an overview (`ok`) ÷ `google_aio` checks that
 * returned either way (`ok` or `no_answer`). The only metric whose denominator includes `no_answer`.
 */
export const aioPresence = (checks: readonly MetricCheck[]): Ratio => {
  const aio = checks.filter(
    (c) => c.platform === 'google_aio' && (c.status === 'ok' || c.status === 'no_answer'),
  );
  return ratio(aio.filter((c) => c.status === 'ok').length, aio.length);
};

/** A domain belongs to the brand when it equals the brand's registrable domain or is under it. */
export const isBrandDomain = (domain: string, brandDomain: string): boolean => {
  const d = domain.toLowerCase();
  const b = brandDomain.toLowerCase();
  return b !== '' && (d === b || d.endsWith(`.${b}`));
};

const nameKey = (name: string): string => name.normalize('NFKC').trim().toLowerCase();

// ---- Run aggregates (`runs.aggregates`, written at finalize) --------------------------------

export interface PlatformAggregate {
  visibility: Metric;
  citationRate: Metric;
  top3Rate: Metric;
  avgRank: AvgRank;
  /** Only on `google_aio`. */
  aioPresence?: Metric;
}

export interface CompetitorAggregate {
  competitorId: string;
  name: string;
  visibility: Metric;
  avgRank: AvgRank;
  shareOfVoice: Metric;
  citationRate: Metric;
}

export interface SuggestedCompetitor {
  name: string;
  /** Answered checks naming it (once per check). */
  mentions: number;
  bestRank: number;
  avgRank: number;
}

export interface CitedDomain {
  domain: string;
  /** Answered checks citing it (once per check). */
  count: number;
  platforms: Platform[];
  isBrand: boolean;
}

export interface RunAggregates {
  total: {
    visibility: Metric;
    citationRate: Metric;
    promptCoverage: Metric;
    top3Rate: Metric;
    avgRank: AvgRank;
    shareOfVoice: Metric;
  };
  byPlatform: Partial<Record<Platform, PlatformAggregate>>;
  byCategory: Record<string, { visibility: Metric; citationRate: Metric }>;
  competitors: CompetitorAggregate[];
  /** Top 10 by mentions. */
  suggestedCompetitors: SuggestedCompetitor[];
  /** Top 20 by count. */
  topCitedDomains: CitedDomain[];
}

export const SUGGESTED_COMPETITORS_LIMIT = 10;
export const TOP_CITED_DOMAINS_LIMIT = 20;

/** Vendors that are often recommended but not tracked yet (05 § Suggested competitors). */
export function suggestedCompetitors(
  checks: readonly MetricCheck[],
  limit = SUGGESTED_COMPETITORS_LIMIT,
): SuggestedCompetitor[] {
  const byKey = new Map<string, { name: string; ranks: number[] }>();
  for (const c of answeredOf(checks)) {
    const seen = new Set<string>();
    for (const name of c.suggested) {
      const key = nameKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const rank = c.vendors.findIndex((v) => nameKey(v) === key) + 1;
      const entry = byKey.get(key) ?? { name: name.trim(), ranks: [] };
      if (rank > 0) entry.ranks.push(rank);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((e) => ({
      name: e.name,
      mentions: e.ranks.length,
      bestRank: Math.min(...e.ranks),
      avgRank: e.ranks.reduce((a, b) => a + b, 0) / e.ranks.length,
    }))
    .filter((s) => s.mentions > 0)
    .sort(
      (a, b) => b.mentions - a.mentions || a.avgRank - b.avgRank || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/** The domains cited across answered checks (05 § Run aggregates `topCitedDomains`). */
export function topCitedDomains(
  checks: readonly MetricCheck[],
  brandDomain: string,
  limit = TOP_CITED_DOMAINS_LIMIT,
): CitedDomain[] {
  const byDomain = new Map<string, { count: number; platforms: Set<Platform> }>();
  for (const c of answeredOf(checks)) {
    const seen = new Set<string>();
    for (const cit of c.citations) {
      const domain = cit.domain.toLowerCase();
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      const entry = byDomain.get(domain) ?? { count: 0, platforms: new Set<Platform>() };
      entry.count++;
      entry.platforms.add(c.platform);
      byDomain.set(domain, entry);
    }
  }
  return [...byDomain.entries()]
    .map(([domain, e]) => ({
      domain,
      count: e.count,
      platforms: [...e.platforms].sort(),
      isBrand: isBrandDomain(domain, brandDomain),
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

/**
 * Every aggregate of one run, pooled from its checks (never averages of platform rates, 05).
 * Recomputable at any time from `run_results`.
 */
export function computeRunAggregates(
  checks: readonly MetricCheck[],
  opts: { brandDomain: string; competitors: readonly TrackedCompetitor[] },
): RunAggregates {
  const brand = checks.map(brandScore);
  const voice = voiceCounts(checks, opts.competitors);

  const byPlatform: RunAggregates['byPlatform'] = {};
  for (const platform of [...new Set(checks.map((c) => c.platform))]) {
    const subset = checks.filter((c) => c.platform === platform);
    const scores = subset.map(brandScore);
    byPlatform[platform] = {
      visibility: visibility(scores),
      citationRate: citedRate(scores),
      top3Rate: top3Rate(scores),
      avgRank: avgRank(scores),
      ...(platform === 'google_aio' ? { aioPresence: aioPresence(subset) } : {}),
    };
  }

  const byCategory: RunAggregates['byCategory'] = {};
  for (const category of [...new Set(checks.map((c) => c.category))]) {
    const scores = checks.filter((c) => c.category === category).map(brandScore);
    byCategory[category] = { visibility: visibility(scores), citationRate: citedRate(scores) };
  }

  return {
    total: {
      visibility: visibility(brand),
      citationRate: citedRate(brand),
      promptCoverage: promptCoverage(checks),
      top3Rate: top3Rate(brand),
      avgRank: avgRank(brand),
      shareOfVoice: ratio(voice.brand, voice.total),
    },
    byPlatform,
    byCategory,
    competitors: opts.competitors.map((comp) => {
      const scores = checks.map((c) => competitorScore(c, comp.id));
      return {
        competitorId: comp.id,
        name: comp.name,
        visibility: visibility(scores),
        avgRank: avgRank(scores),
        shareOfVoice: ratio(voice.byCompetitor.get(comp.id) ?? 0, voice.total),
        citationRate: citedRate(scores),
      };
    }),
    suggestedCompetitors: suggestedCompetitors(checks),
    topCitedDomains: topCitedDomains(checks, opts.brandDomain),
  };
}

// ---- Run-over-run deltas (05 § Trends) ------------------------------------------------------

export interface VisibilityDelta {
  /** Visibility of each run, restricted to the prompts and platforms both runs share. */
  current: Ratio;
  previous: Ratio;
  /** Percentage points (current − previous) × 100, or null when either rate is null. */
  deltaPts: number | null;
  sharedPrompts: number;
  sharedPlatforms: Platform[];
}

/**
 * "+6 pts vs last run": computed only over the prompts and platforms both runs share, so a changed
 * prompt set or platform list can't fake a move.
 */
export function visibilityDelta(
  previous: readonly MetricCheck[],
  current: readonly MetricCheck[],
): VisibilityDelta {
  const prompts = new Set(previous.map((c) => c.promptId));
  const sharedPrompts = new Set(current.map((c) => c.promptId).filter((p) => prompts.has(p)));
  const platforms = new Set(previous.map((c) => c.platform));
  const sharedPlatforms = [...new Set(current.map((c) => c.platform))]
    .filter((p) => platforms.has(p))
    .sort();
  const keep = (c: MetricCheck) =>
    sharedPrompts.has(c.promptId) && sharedPlatforms.includes(c.platform);
  const cur = visibility(current.filter(keep).map(brandScore));
  const prev = visibility(previous.filter(keep).map(brandScore));
  return {
    current: cur,
    previous: prev,
    deltaPts:
      cur.rate === null || prev.rate === null
        ? null
        : Math.round((cur.rate - prev.rate) * 1000) / 10,
    sharedPrompts: sharedPrompts.size,
    sharedPlatforms,
  };
}
