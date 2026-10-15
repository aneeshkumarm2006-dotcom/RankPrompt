import type { BrandListItem } from '@pv/shared';

export type BrandSort = 'newest' | 'oldest' | 'name';

export const BRAND_SORTS: { value: BrandSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

/** A brand without prompts or without a run is still mid-wizard (F-10: the resumable state). */
export const needsSetup = (brand: Pick<BrandListItem, 'promptCount' | 'latestRun'>): boolean =>
  brand.promptCount === 0 || brand.latestRun === null;

export const setupHref = (brandId: string): string =>
  `/app/brands/new?brandId=${encodeURIComponent(brandId)}`;

/** v1 MyBrands search (name or website) and sort, plus a name sort. */
export function filterAndSortBrands<T extends BrandListItem>(
  brands: readonly T[],
  query: string,
  sort: BrandSort,
): T[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? brands.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.domain.toLowerCase().includes(q) ||
          b.websiteUrl.toLowerCase().includes(q),
      )
    : [...brands];
  const time = (b: T) => new Date(b.createdAt).getTime();
  return filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return sort === 'newest' ? time(b) - time(a) : time(a) - time(b);
  });
}
