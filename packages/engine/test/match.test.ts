import { describe, expect, it } from 'vitest';
import { proseOf } from '../src/clean';
import { finalizeCitations, isDomainLike, sameSite, stripTracking } from '../src/domain';
import { buildMatcher, matchAll, matchEntity } from '../src/match';
import { loadFixture } from './helpers';

const cites = (...urls: string[]) => finalizeCitations(urls.map((url) => ({ url })));

describe('buildMatcher', () => {
  it('always keeps the name, drops extra aliases under 3 characters, dedupes case-insensitively', () => {
    const m = buildMatcher({
      name: 'HP',
      aliases: ['hp', 'Hewlett-Packard', 'H', 'HEWLETT-PACKARD'],
    });
    expect(m.aliases).toEqual(['HP', 'Hewlett-Packard']);
  });

  it('matches whole words only (Unicode-aware)', () => {
    const m = buildMatcher({ name: 'Orion' });
    expect(m.test('Orion is good')).toBe(true);
    expect(m.test('see orion.com')).toBe(true);
    expect(m.test('Orionis Capital')).toBe(false);
    expect(m.test('the orionadvisor site')).toBe(false);
  });

  it('handles punctuation and Unicode in names (case 7)', () => {
    const ssc = buildMatcher({ name: 'Black Diamond', aliases: ['SS&C Black Diamond'] });
    expect(ssc.test('Use SS&C Black Diamond for reporting')).toBe(true);
    expect(ssc.test('Use SS＆C  Black\nDiamond')).toBe(true); // full-width &, odd whitespace
    const sg = buildMatcher({ name: 'Société Générale' });
    expect(sg.test('Banks like SOCIÉTÉ GÉNÉRALE offer this')).toBe(true);
    expect(sg.test('Sociétés Générales')).toBe(false);
    const lowes = buildMatcher({ name: "Lowe's" });
    expect(lowes.test('Try Lowe’s or Home Depot')).toBe(true);
    const zh = buildMatcher({ name: '华为' });
    expect(zh.test('推荐 华为 云')).toBe(true);
  });
});

describe('domain helpers', () => {
  it('sameSite compares registrable domains, so subdomains count', () => {
    expect(sameSite('blog.ndexsystems.com', 'https://www.ndexsystems.com/')).toBe(true);
    expect(sameSite('ndexsystems.com.evil.io', 'ndexsystems.com')).toBe(false);
    expect(sameSite('bbc.co.uk', 'news.bbc.co.uk')).toBe(true);
    expect(sameSite('foo.blogspot.com', 'bar.blogspot.com')).toBe(false); // private suffix
  });

  it('strips utm params and dedupes citations by normalised URL', () => {
    expect(stripTracking('https://orion.com/a?utm_source=openai')).toBe('https://orion.com/a');
    expect(stripTracking('https://x.com/a?id=2&utm_source=openai&utm_medium=x')).toBe(
      'https://x.com/a?id=2',
    );
    const c = cites(
      'https://www.orion.com/a/?utm_source=openai',
      'https://orion.com/a',
      'https://addepar.com/',
    );
    expect(c.map((x) => [x.position, x.domain])).toEqual([
      [1, 'orion.com'],
      [2, 'addepar.com'],
    ]);
  });

  it('isDomainLike accepts real domains only', () => {
    expect(isDomainLike('canadim.com')).toBe(true);
    expect(isDomainLike('www.gov.uk')).toBe(true);
    expect(isDomainLike('College of Immigration')).toBe(false);
    expect(isDomainLike('file.notatld')).toBe(false);
  });
});

describe('matchEntity', () => {
  const brand = buildMatcher({
    name: 'NDEX Systems',
    domain: 'https://www.ndexsystems.com/',
    aliases: ['NDEX'],
  });

  it('mentioned in text but not in vendors → mentioned, rank null (case 8)', () => {
    const prose = 'Most advisors pick Orion. NDEX is a niche option for data aggregation.';
    const r = matchEntity(brand, prose, ['Orion'], []);
    expect(r).toEqual({
      mentioned: true,
      rank: null,
      cited: false,
      citedUrl: null,
      snippet: 'NDEX is a niche option for data aggregation.',
    });
  });

  it('empty vendor list and no mention (case 8)', () => {
    expect(matchEntity(brand, 'No vendors here.', [], [])).toMatchObject({
      mentioned: false,
      rank: null,
      snippet: null,
    });
  });

  it('rank comes from the vendor list and implies mentioned', () => {
    const r = matchEntity(brand, 'Orion and others.', ['Orion', 'NDEX Systems Inc.'], []);
    expect(r).toMatchObject({ mentioned: true, rank: 2 });
  });

  it('cited by subdomain; citedUrl is the first matching citation', () => {
    const c = cites(
      'https://orion.com/',
      'https://docs.ndexsystems.com/api',
      'https://www.ndexsystems.com/',
    );
    expect(matchEntity(brand, '', [], c)).toMatchObject({
      cited: true,
      citedUrl: 'https://docs.ndexsystems.com/api',
    });
  });

  it('snippet is capped at 600 chars', () => {
    const long = `NDEX ${'x'.repeat(800)}.`;
    expect(matchEntity(brand, long, [], []).snippet).toHaveLength(600);
  });
});

describe('real answers', () => {
  it('a brand named in its own domain gets no false mention from inline citations (case 1)', () => {
    const f = loadFixture('chatgpt/fiserv-only-in-citations.json');
    const body = f.http[0]?.body as { output: { type: string; content?: { text: string }[] }[] };
    const answer = body.output.find((o) => o.type === 'message')?.content?.[0]?.text ?? '';
    expect(answer.toLowerCase()).toContain('fiserv.com');
    const prose = proseOf(answer);
    expect(prose.toLowerCase()).not.toContain('fiserv');
    const fiserv = buildMatcher({ name: 'Fiserv', domain: 'fiserv.com' });
    // The v1/luna extractor ran on the raw answer and listed "Fiserv" because of the citation;
    // on prose it only sees the vendors that the text names.
    const vendors = (f.meta.vendors ?? []).filter((v) => buildMatcher({ name: v }).test(prose));
    expect(vendors).not.toContain('Fiserv');
    const citations = finalizeCitations([
      { url: 'https://www.fiserv.com/content/dam/x.pdf?utm_source=openai' },
    ]);
    expect(matchEntity(fiserv, prose, vendors, citations)).toMatchObject({
      mentioned: false,
      rank: null,
      cited: true,
    });
    // Matching the raw answer instead would have counted it.
    expect(fiserv.test(answer)).toBe(true);
  });

  it('scores the brand and every competitor with the same functions; suggests the rest', () => {
    const f = loadFixture('chatgpt/ndex-wealth-platforms.json');
    const body = f.http[0]?.body as { output: { type: string; content?: { text: string }[] }[] };
    const prose = proseOf(body.output.find((o) => o.type === 'message')?.content?.[0]?.text ?? '');
    const vendors = f.meta.vendors ?? [];
    const r = matchAll(
      prose,
      vendors,
      cites(
        'https://orion.com/advisor-tech?utm_source=openai',
        'https://addepar.com/wealth-management',
      ),
      buildMatcher({ name: 'NDEX Systems', domain: 'ndexsystems.com', aliases: ['NDEX'] }),
      [
        buildMatcher({ name: 'Advyzon', domain: 'advyzon.com' }),
        buildMatcher({ name: 'Orion', domain: 'orion.com' }),
        buildMatcher({
          name: 'Black Diamond',
          domain: 'sscblackdiamond.com',
          aliases: ['SS&C Black Diamond'],
        }),
        buildMatcher({ name: 'Addepar', domain: 'addepar.com' }),
      ],
    );
    expect(r.brand).toMatchObject({ mentioned: false, rank: null, cited: false });
    // Same ranks as the stored luna run: Advyzon 1, Orion 2, Black Diamond -, Addepar 5.
    expect(r.competitors.map((c) => [c.name, c.rank, c.cited])).toEqual([
      ['Advyzon', 1, false],
      ['Orion', 2, true],
      ['Black Diamond', null, false],
      ['Addepar', 5, true],
    ]);
    expect(r.suggested).toEqual([
      'Envestnet Tamarac',
      'Altruist',
      'Wealthbox',
      'RightCapital',
      'eMoney',
      'Holistiplan',
      'MoneyGuide',
    ]);
  });
});
