import {
  countryName,
  languageName,
  PLATFORM_LABELS,
  type CountryCode,
  type LanguageCode,
  type Platform,
} from '@pv/shared';

/**
 * Display helpers only. Every number shown here was computed by the server (05: the UI never
 * computes visibility itself); these just turn it into text.
 */

export interface RatioLike {
  num: number;
  den: number;
  rate: number | null;
}

/** `0.4231` → `42%`; null (nothing answered) → `—`. */
export function pct(rate: number | null | undefined, digits = 0): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
}

/** A server ratio as `42%`. */
export const ratioPct = (r: RatioLike | null | undefined, digits = 0): string =>
  pct(r?.rate, digits);

/** A server ratio as `11/26`. */
export const ratioFraction = (r: RatioLike | null | undefined): string =>
  r ? `${r.num}/${r.den}` : '—';

/** Chart value 0–100 (rounded); null rates chart as 0. */
export const ratioChartValue = (r: RatioLike | null | undefined): number =>
  r?.rate === null || r?.rate === undefined ? 0 : Math.round(r.rate * 1000) / 10;

/** Rank `#3`; missing → `—` (F-13: never `#undefined` or 0). */
export function rank(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) return '—';
  return `#${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

/** Percentage points delta: `+4.2 pts`. */
export function deltaPts(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${Math.abs(value).toFixed(1)} pts`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const toDate = (iso: string | Date) => (iso instanceof Date ? iso : new Date(iso));

export const formatDate = (iso: string | Date | null | undefined): string =>
  iso ? dateFmt.format(toDate(iso)) : '—';
export const formatDateTime = (iso: string | Date | null | undefined): string =>
  iso ? dateTimeFmt.format(toDate(iso)) : '—';
export const formatShortDate = (iso: string | Date | null | undefined): string =>
  iso ? shortFmt.format(toDate(iso)) : '—';

/** "3 minutes ago" style text. */
export function timeAgo(iso: string | Date, now = Date.now()): string {
  const seconds = Math.round((toDate(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
}

/** `$99` / `$19.50` from whole cents. */
export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export const number = (n: number): string => new Intl.NumberFormat().format(n);

export const platformLabel = (p: Platform): string => PLATFORM_LABELS[p];

/** "Toronto, Canada" / "United States". */
export function locationLabel(country: string, city?: string | null): string {
  const name = countryName(country as CountryCode);
  return city ? `${city}, ${name}` : name;
}

export const languageLabel = (code: string): string => languageName(code as LanguageCode);

/** Google s2 favicon (D-013: built on the client, never fetched by the server). */
export const faviconUrl = (domain: string, size = 64): string =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

/** `https://www.example.com/x` → `example.com/x`. */
export const prettyUrl = (url: string): string =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

export const pluralize = (n: number, one: string, many = `${one}s`): string =>
  `${number(n)} ${n === 1 ? one : many}`;
