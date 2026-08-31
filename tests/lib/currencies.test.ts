/** Currency catalog for the picker (3b / F25). */

import {
  currencyName,
  currencySymbol,
  filterCurrencies,
  listCurrencies,
} from '@/lib/currencies';

describe('listCurrencies', () => {
  const list = listCurrencies('en');

  it('returns a non-trivial, code-sorted catalog', () => {
    expect(list.length).toBeGreaterThan(20);
    const codes = list.map((c) => c.code);
    expect([...codes].sort((a, b) => a.localeCompare(b))).toEqual(codes);
  });

  it('includes common currencies with names', () => {
    const usd = list.find((c) => c.code === 'USD');
    expect(usd?.name.toLowerCase()).toContain('dollar');
    expect(list.some((c) => c.code === 'PHP')).toBe(true);
  });
});

describe('currencyName / currencySymbol', () => {
  it('localizes the name', () => {
    expect(currencyName('USD', 'en').toLowerCase()).toContain('dollar');
  });
  it('resolves a real name, never the bare code, for the common set', () => {
    // Guards the "PHP — PHP" native regression: on Hermes Intl returns the code,
    // so the static fallback must carry a real name.
    expect(currencyName('PHP', 'en').toLowerCase()).toContain('peso');
    expect(currencyName('PHP', 'en')).not.toBe('PHP');
  });
  it('resolves a symbol, falling back to the code', () => {
    expect(currencySymbol('USD', 'en-US')).toContain('$');
    expect(currencySymbol('ZZZ', 'en')).toBe('ZZZ');
  });
});

describe('filterCurrencies', () => {
  const list = listCurrencies('en');

  it('returns everything for a blank query', () => {
    expect(filterCurrencies(list, '  ')).toHaveLength(list.length);
  });

  it('matches by code and by name (case-insensitive)', () => {
    expect(filterCurrencies(list, 'php').some((c) => c.code === 'PHP')).toBe(true);
    expect(filterCurrencies(list, 'dollar').some((c) => c.code === 'USD')).toBe(true);
  });
});
