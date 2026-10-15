import { getDomain, getHostname, parse } from 'tldts';
import type { Citation } from './types';

const TLD_OPTS = { allowPrivateDomains: true } as const;

/** Hostname of a URL or bare domain, lowercased, without `www.`. '' when it doesn't parse. */
export function hostOf(urlOrDomain: string): string {
  const host = getHostname(urlOrDomain.trim(), TLD_OPTS) ?? '';
  return host.toLowerCase().replace(/^www\./, '');
}

/** Registrable domain (`blog.orion.com` → `orion.com`), honouring private suffixes. */
export const siteOf = (urlOrDomain: string): string | null =>
  getDomain(urlOrDomain.trim().toLowerCase(), TLD_OPTS);

/**
 * Cited = the citation's registrable domain equals the brand's (so subdomains count, both ways).
 * Replaces the prototype's `url.includes(domain)` (03 § Matching).
 */
export function sameSite(a: string, b: string): boolean {
  const sa = siteOf(a);
  return sa !== null && sa === siteOf(b);
}

/** True when a string is a bare domain with a known public suffix (e.g. a Gemini citation title). */
export function isDomainLike(s: string): boolean {
  const t = s.trim();
  if (!/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(t)) return false;
  const p = parse(t, TLD_OPTS);
  return p.isIcann === true || p.isPrivate === true;
}

/** Drops tracking params that providers append (`utm_source=openai` and friends). */
export function stripTracking(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.trim();
  }
  for (const key of [...u.searchParams.keys()]) {
    if (/^utm_/i.test(key)) u.searchParams.delete(key);
  }
  return u.toString().replace(/\?$/, '');
}

const dedupeKey = (url: string): string => {
  try {
    const u = new URL(url);
    return `${hostOf(u.hostname)}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
};

/** Cleans, dedupes (first seen wins) and numbers citations. Only http(s) links are kept (8.3). */
export function finalizeCitations(
  items: readonly { url: string; title?: string | null | undefined; domain?: string | undefined }[],
): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const item of items) {
    if (!/^https?:\/\//i.test(item.url.trim())) continue;
    const url = stripTracking(item.url);
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    const title = item.title?.trim();
    out.push({
      url,
      domain: item.domain ?? hostOf(url),
      ...(title ? { title } : {}),
      position: out.length + 1,
    });
  }
  return out;
}
