import { sameSite, siteOf } from './domain';
import type { Citation, CompetitorMatch, EntityInput, EntityMatch, MatchResult } from './types';

/** Extra aliases shorter than this are dropped to avoid false matches (03 § Matching). */
export const MIN_ALIAS_LENGTH = 3;
const SNIPPET_MAX = 600;

/** NFKC, lowercase, typographic quotes folded, so "SS＆C" / "Lowe’s" match "SS&C" / "Lowe's". */
const fold = (s: string): string =>
  s.normalize('NFKC').toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');

// No `-` here (unlike the 03 sketch): `\-` outside a class is a syntax error in `u` mode.
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export interface Matcher {
  id?: string;
  name: string;
  aliases: string[];
  /** Registrable domain, or null when the entity has none. */
  site: string | null;
  test(text: string): boolean;
}

export function buildMatcher(entity: EntityInput): Matcher {
  const name = entity.name.trim();
  const aliases: string[] = [];
  for (const a of [name, ...(entity.aliases ?? [])]) {
    const t = a.trim().replace(/\s+/g, ' ');
    if (!t || (t !== name && [...t].length < MIN_ALIAS_LENGTH)) continue;
    if (!aliases.some((x) => fold(x) === fold(t))) aliases.push(t);
  }
  // Whole word: no letter or digit on either side (Unicode-aware); any run of whitespace inside.
  const patterns = aliases.map(
    (a) =>
      new RegExp(
        String.raw`(^|[^\p{L}\p{N}])${fold(a)
          .split(' ')
          .map(esc)
          .join(String.raw`\s+`)}($|[^\p{L}\p{N}])`,
        'u',
      ),
  );
  const site = entity.domain ? siteOf(entity.domain) : null;
  return {
    ...(entity.id === undefined ? {} : { id: entity.id }),
    name,
    aliases,
    site,
    test: (text) => {
      const t = fold(text);
      return patterns.some((p) => p.test(t));
    },
  };
}

/** 1-based position of the first vendor naming the entity, or null. */
export const rankIn = (vendors: readonly string[], m: Matcher): number | null => {
  const i = vendors.findIndex((v) => m.test(v));
  return i === -1 ? null : i + 1;
};

const SENTENCE_SPLIT = /(?<=[.!?\n])\s+/;

/** First sentence of the prose that names the entity, trimmed to 600 chars. */
export const snippetFor = (prose: string, m: Matcher): string | null =>
  prose
    .split(SENTENCE_SPLIT)
    .find((s) => m.test(s))
    ?.trim()
    .slice(0, SNIPPET_MAX) ?? null;

export function matchEntity(
  m: Matcher,
  prose: string,
  vendors: readonly string[],
  citations: readonly Citation[],
): EntityMatch {
  const rank = rankIn(vendors, m);
  const cite = m.site
    ? citations.find((c) => c.domain && sameSite(c.domain, m.site as string))
    : undefined;
  return {
    mentioned: m.test(prose) || rank !== null,
    rank,
    cited: cite !== undefined,
    citedUrl: cite?.url ?? null,
    snippet: snippetFor(prose, m),
  };
}

/**
 * Scores the brand and every tracked competitor with the same functions (D-010, D-011).
 * `prose` must be the cleaned answer (clean.ts), never the raw one.
 */
export function matchAll(
  prose: string,
  vendors: readonly string[],
  citations: readonly Citation[],
  brand: Matcher,
  competitors: readonly Matcher[],
): MatchResult {
  const tracked = [brand, ...competitors];
  return {
    brand: matchEntity(brand, prose, vendors, citations),
    competitors: competitors.map((c): CompetitorMatch => ({
      ...(c.id === undefined ? {} : { id: c.id }),
      name: c.name,
      ...matchEntity(c, prose, vendors, citations),
    })),
    suggested: vendors.filter((v) => !tracked.some((m) => m.test(v))),
  };
}
