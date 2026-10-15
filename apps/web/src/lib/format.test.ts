import { describe, expect, it } from 'vitest';
import { deltaPts, money, pct, rank, ratioChartValue, ratioFraction, ratioPct } from './format';

describe('format', () => {
  it('shows ratios as the server computed them', () => {
    const r = { num: 11, den: 26, rate: 11 / 26 };
    expect(ratioPct(r)).toBe('42%');
    expect(ratioFraction(r)).toBe('11/26');
    expect(ratioChartValue(r)).toBe(42.3);
    expect(ratioPct({ num: 0, den: 0, rate: null })).toBe('—');
    expect(pct(undefined)).toBe('—');
  });

  it('never shows #undefined or #0 for a missing rank (F-13)', () => {
    expect(rank(null)).toBe('—');
    expect(rank(undefined)).toBe('—');
    expect(rank(0)).toBe('—');
    expect(rank(3)).toBe('#3');
    expect(rank(2.456)).toBe('#2.5');
  });

  it('formats deltas and money', () => {
    expect(deltaPts(4.24)).toBe('+4.2 pts');
    expect(deltaPts(-1)).toBe('−1.0 pts');
    expect(deltaPts(null)).toBe('—');
    expect(money(9900)).toBe('$99');
    expect(money(1950)).toBe('$19.50');
  });
});
