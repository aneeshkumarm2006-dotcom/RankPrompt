import { describe, expect, it } from 'vitest';
import { proseOf, usedMarkers } from '../src/clean';

describe('proseOf', () => {
  it('removes ChatGPT inline citation groups, including several links in one group', () => {
    const a =
      'Orion offers reporting. ([orion.com](https://orion.com/advisor-tech?utm_source=openai)) Addepar is strong ([addepar.com](https://addepar.com/x?utm_source=openai), [kitces.com](https://www.kitces.com/y)).';
    expect(proseOf(a)).toBe('Orion offers reporting. Addepar is strong.');
  });

  it('drops markdown links whose text is a domain (case 2) and keeps other link text', () => {
    expect(
      proseOf(
        'See [canadim.com](https://www.canadim.com/) or [the IRCC page](https://www.canada.ca/x).',
      ),
    ).toBe('See or the IRCC page.');
    expect(proseOf('Source: [www.orion.com/advisor-tech](https://orion.com/advisor-tech)')).toBe(
      'Source:',
    );
  });

  it('handles URLs with parentheses inside link targets', () => {
    expect(
      proseOf('Read [Wealth management](https://en.wikipedia.org/wiki/Wealth_(economics)) here.'),
    ).toBe('Read Wealth management here.');
  });

  it('removes bare URLs', () => {
    expect(proseOf('Visit https://www.ndexsystems.com/contact?utm_source=openai today')).toBe(
      'Visit today',
    );
  });

  it('removes Perplexity [n] and Agent API [web:n] markers from prose (case 3)', () => {
    expect(proseOf('Orion and Advyzon lead.[5][7] Wealthbox is a CRM [web:2].')).toBe(
      'Orion and Advyzon lead. Wealthbox is a CRM.',
    );
  });

  it('leaves plain prose untouched', () => {
    expect(proseOf('SS&C Black Diamond is popular with RIAs.')).toBe(
      'SS&C Black Diamond is popular with RIAs.',
    );
  });
});

describe('usedMarkers', () => {
  it('returns the markers in first-seen order, without duplicates', () => {
    expect(usedMarkers('a [7][8] b [4] c [7] d [web:12] e [1, 3]')).toEqual([7, 8, 4, 12, 1, 3]);
  });
});
