import { describe, expect, it } from 'vitest';
import { buildBrandPatch, categoryErrors, formFromBrand, validateBrandForm } from './brandForm';
import { filterAndSortBrands, needsSetup } from './brandList';
import { makeBrand, makeListItem } from './testFixtures';

describe('buildBrandPatch', () => {
  it('is empty when nothing changed', () => {
    const brand = makeBrand();
    expect(buildBrandPatch(brand, formFromBrand(brand))).toEqual({});
  });

  it('sends only the changed fields, trimmed', () => {
    const brand = makeBrand();
    const form = { ...formFromBrand(brand), name: '  Acme   Corp ', aliases: ['Acme Inc', 'ACME'] };
    expect(buildBrandPatch(brand, form)).toEqual({
      name: 'Acme Corp',
      aliases: ['Acme Inc', 'ACME'],
    });
  });

  it('sends the whole defaults object when one default changes, with city only for local', () => {
    const brand = makeBrand();
    const form = formFromBrand(brand);
    form.defaults = { ...form.defaults, scope: 'local', city: ' Toronto ' };
    expect(buildBrandPatch(brand, form).defaults).toEqual({
      ...brand.defaults,
      scope: 'local',
      city: 'Toronto',
    });
  });

  it('ignores platform order and drops platforms outside the plan', () => {
    const brand = makeBrand();
    const form = formFromBrand(brand);
    form.defaults.platforms = ['perplexity', 'chatgpt', 'claude'];
    expect(buildBrandPatch(brand, form, ['chatgpt', 'perplexity'])).toEqual({});
  });

  it('detects category edits', () => {
    const brand = makeBrand();
    const form = formFromBrand(brand);
    form.categories = form.categories.slice(1);
    expect(buildBrandPatch(brand, form).categories).toEqual([brand.categories[1]]);
  });
});

describe('categoryErrors / validateBrandForm', () => {
  it('flags empty and duplicate names, ignoring case', () => {
    expect(categoryErrors([{ name: 'A' }, { name: ' ' }, { name: 'a' }])).toEqual({
      1: 'Give the category a name',
      2: 'Category names must be unique',
    });
  });

  it('needs a city for a local scope and at least one platform', () => {
    const form = formFromBrand(makeBrand());
    form.defaults = { ...form.defaults, scope: 'local', city: null, platforms: [] };
    expect(Object.keys(validateBrandForm(form)).sort()).toEqual([
      'defaults.city',
      'defaults.platforms',
    ]);
  });
});

describe('brand list helpers', () => {
  it('needs setup without prompts or without a run', () => {
    expect(needsSetup(makeListItem())).toBe(false);
    expect(needsSetup(makeListItem({ promptCount: 0 }))).toBe(true);
    expect(needsSetup(makeListItem({ latestRun: null }))).toBe(true);
  });

  it('searches name/domain and sorts', () => {
    const a = makeListItem({
      id: 'a',
      name: 'Zeta',
      domain: 'zeta.io',
      createdAt: '2026-01-01T00:00:00Z',
    });
    const b = makeListItem({
      id: 'b',
      name: 'alpha',
      domain: 'alpha.com',
      createdAt: '2026-02-01T00:00:00Z',
    });
    expect(filterAndSortBrands([a, b], '', 'newest').map((x) => x.id)).toEqual(['b', 'a']);
    expect(filterAndSortBrands([a, b], '', 'oldest').map((x) => x.id)).toEqual(['a', 'b']);
    expect(filterAndSortBrands([a, b], '', 'name').map((x) => x.id)).toEqual(['b', 'a']);
    expect(filterAndSortBrands([a, b], 'ZETA.', 'newest').map((x) => x.id)).toEqual(['a']);
  });
});
