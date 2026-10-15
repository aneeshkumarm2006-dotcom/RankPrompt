/**
 * DataForSEO (Google Ads geo target) country location codes are `2000 + ISO 3166-1 numeric`
 * (US 2840, CA 2124, both checked against `serp/google/locations`). Covers every country in
 * `@pv/shared` COUNTRIES.
 */
const ISO_NUMERIC: Record<string, number> = {
  CA: 124,
  IN: 356,
  US: 840,
  GB: 826,
  AU: 36,
  DE: 276,
  FR: 250,
  JP: 392,
  BR: 76,
  MX: 484,
  IT: 380,
  ES: 724,
  NL: 528,
  SE: 752,
  CH: 756,
  SG: 702,
  AE: 784,
  ZA: 710,
  AR: 32,
  CL: 152,
  CO: 170,
  PE: 604,
  UA: 804,
  UG: 800,
  KE: 404,
  NG: 566,
  EG: 818,
  PK: 586,
  BD: 50,
  VN: 704,
  TH: 764,
  MY: 458,
  PH: 608,
  ID: 360,
  KR: 410,
  TW: 158,
  HK: 344,
  NZ: 554,
};

export function countryLocationCode(iso2: string): number {
  const numeric = ISO_NUMERIC[iso2.toUpperCase()];
  if (numeric === undefined) throw new Error(`no DataForSEO location code for country ${iso2}`);
  return 2000 + numeric;
}

/** DataForSEO wants region-specific codes for a few Google interface languages. */
export function dfsLanguageCode(language: string, country: string): string {
  const lang = language.toLowerCase();
  const cc = country.toUpperCase();
  if (lang === 'zh') return cc === 'TW' || cc === 'HK' ? 'zh-TW' : 'zh-CN';
  if (lang === 'pt') return cc === 'BR' ? 'pt-BR' : 'pt-PT';
  return lang;
}
