import type { Brand, BrandDefaults, Category, PatchBrandBody, Platform } from '@pv/shared';

/** What the brand settings form edits (08 § PATCH /brands/:id). */
export interface BrandFormValues {
  name: string;
  websiteUrl: string;
  summary: string;
  aliases: string[];
  categories: Category[];
  defaults: BrandDefaults;
}

/** The server trims and collapses whitespace (`textSchema`); compare the same way. */
export const normText = (s: string): string => s.trim().replace(/\s+/g, ' ');

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function formFromBrand(brand: Brand): BrandFormValues {
  return {
    name: brand.name,
    websiteUrl: brand.websiteUrl,
    summary: brand.summary,
    aliases: [...brand.aliases],
    categories: brand.categories.map((c) => ({ ...c })),
    defaults: { ...brand.defaults, platforms: [...brand.defaults.platforms] },
  };
}

/** Defaults as they will be sent: city only for a local scope, platforms limited to the plan. */
export function cleanDefaults(
  defaults: BrandDefaults,
  allowed?: readonly Platform[],
): BrandDefaults {
  const city = defaults.scope === 'local' ? normText(defaults.city ?? '') || null : null;
  const platforms =
    allowed && allowed.length > 0
      ? defaults.platforms.filter((p) => allowed.includes(p))
      : [...defaults.platforms];
  return { ...defaults, city, platforms };
}

export const cleanCategories = (categories: readonly Category[]): Category[] =>
  categories.map((c) => ({
    name: normText(c.name),
    description: normText(c.description),
    source: c.source,
  }));

const cleanAliases = (aliases: readonly string[]) => aliases.map(normText).filter(Boolean);

/** Only the fields that differ from the saved brand (PATCH sends changed fields only). */
export function buildBrandPatch(
  brand: Brand,
  form: BrandFormValues,
  allowed?: readonly Platform[],
): PatchBrandBody {
  const patch: PatchBrandBody = {};
  const name = normText(form.name);
  if (name !== brand.name) patch.name = name;
  const websiteUrl = form.websiteUrl.trim();
  if (websiteUrl !== brand.websiteUrl) patch.websiteUrl = websiteUrl;
  const summary = form.summary.trim();
  if (summary !== brand.summary.trim()) patch.summary = summary;

  const aliases = cleanAliases(form.aliases);
  if (!sameList(aliases, brand.aliases)) patch.aliases = aliases;

  const categories = cleanCategories(form.categories);
  const categoriesChanged =
    categories.length !== brand.categories.length ||
    categories.some((c, i) => {
      const b = brand.categories[i];
      return !b || b.name !== c.name || b.description !== c.description || b.source !== c.source;
    });
  if (categoriesChanged) patch.categories = categories;

  const defaults = cleanDefaults(form.defaults, allowed);
  const d = brand.defaults;
  if (
    defaults.country !== d.country ||
    defaults.city !== d.city ||
    defaults.language !== d.language ||
    defaults.scope !== d.scope ||
    !sameSet(defaults.platforms, d.platforms)
  ) {
    patch.defaults = defaults;
  }
  return patch;
}

/** Per-row category errors: a name is required and names are unique, ignoring case. */
export function categoryErrors(categories: readonly { name: string }[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  categories.forEach((c, i) => {
    const key = normText(c.name).toLowerCase();
    if (!key) errors[i] = 'Give the category a name';
    else if (seen.has(key)) errors[i] = 'Category names must be unique';
    seen.add(key);
  });
  return errors;
}

/** Client checks before a save, keyed like the server's VALIDATION_FAILED paths. */
export function validateBrandForm(form: BrandFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!normText(form.name)) errors.name = 'Enter the brand name';
  if (form.websiteUrl.trim().length < 3) errors.websiteUrl = 'Enter the website address';
  Object.assign(errors, validateDefaults(form.defaults));
  for (const [i, message] of Object.entries(categoryErrors(form.categories))) {
    errors[`categories.${i}.name`] = message;
  }
  return errors;
}

export function validateDefaults(defaults: BrandDefaults): Record<string, string> {
  const errors: Record<string, string> = {};
  if (defaults.scope === 'local' && !normText(defaults.city ?? '')) {
    errors['defaults.city'] = 'A local search needs a city';
  }
  if (defaults.platforms.length === 0) errors['defaults.platforms'] = 'Pick at least one platform';
  return errors;
}
