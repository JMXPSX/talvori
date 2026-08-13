/**
 * Money engine tests. This is high-risk logic (see 04 spec + 10 review rules:
 * money calculations require tests), so cover the currency-exponent edge cases
 * that the "never use float, never hard-code USD" rules exist to protect.
 */

import {
  addMoney,
  formatMoney,
  minorExponent,
  money,
  subtractMoney,
  toMajorUnits,
  toMinorUnits,
} from '@/lib/money';

describe('minorExponent', () => {
  it('defaults to 2 decimals', () => {
    expect(minorExponent('USD')).toBe(2);
    expect(minorExponent('PHP')).toBe(2);
    expect(minorExponent('EUR')).toBe(2);
  });

  it('knows zero-decimal currencies', () => {
    expect(minorExponent('JPY')).toBe(0);
    expect(minorExponent('KRW')).toBe(0);
  });

  it('knows three-decimal currencies', () => {
    expect(minorExponent('BHD')).toBe(3);
    expect(minorExponent('KWD')).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(minorExponent('jpy')).toBe(0);
  });
});

describe('money()', () => {
  it('rejects non-integer minor units (no floats)', () => {
    expect(() => money(25.5, 'USD')).toThrow();
  });

  it('rejects invalid currency codes', () => {
    expect(() => money(100, 'US')).toThrow();
    expect(() => money(100, 'DOLLARS')).toThrow();
  });

  it('uppercases the currency code', () => {
    expect(money(2599, 'usd').currencyCode).toBe('USD');
  });
});

describe('major/minor conversion', () => {
  it('USD $25.99 <-> 2599 minor units', () => {
    expect(toMinorUnits(25.99, 'USD')).toBe(2599);
    expect(toMajorUnits(money(2599, 'USD'))).toBeCloseTo(25.99, 5);
  });

  it('JPY has no minor subdivision', () => {
    expect(toMinorUnits(500, 'JPY')).toBe(500);
    expect(toMajorUnits(money(500, 'JPY'))).toBe(500);
  });

  it('BHD uses three decimals', () => {
    expect(toMinorUnits(1.234, 'BHD')).toBe(1234);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts same-currency amounts', () => {
    expect(addMoney(money(2599, 'USD'), money(101, 'USD')).amountMinor).toBe(2700);
    expect(subtractMoney(money(2700, 'USD'), money(700, 'USD')).amountMinor).toBe(2000);
  });

  it('refuses to combine mismatched currencies', () => {
    expect(() => addMoney(money(100, 'USD'), money(100, 'PHP'))).toThrow(/mismatch/i);
  });
});

describe('rounding hardening (Phase 8)', () => {
  it('rounds halves away from zero for negative amounts (refunds)', () => {
    // JPY halves are exactly representable (factor 1), so this pins the rule.
    expect(toMinorUnits(2.5, 'JPY')).toBe(3);
    expect(toMinorUnits(-2.5, 'JPY')).toBe(-3);
    expect(toMinorUnits(-0.5, 'JPY')).toBe(-1);
  });

  it('survives classic float-precision traps', () => {
    // 4.35 * 100 === 434.99999… and 25.99 * 100 === 2598.99999… as doubles.
    expect(toMinorUnits(4.35, 'USD')).toBe(435);
    expect(toMinorUnits(25.99, 'USD')).toBe(2599);
    expect(toMinorUnits(0.07, 'USD')).toBe(7);
    expect(toMinorUnits(-19.99, 'USD')).toBe(-1999);
    expect(toMinorUnits(1.005, 'BHD')).toBe(1005);
  });

  it('round-trips minor -> major -> minor across exponents (property-style)', () => {
    // Deterministic LCG so the sample set is stable across runs.
    let seed = 42;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed;
    };
    const currencies = ['USD', 'JPY', 'KWD'];
    for (const currency of currencies) {
      for (let i = 0; i < 250; i += 1) {
        const amountMinor = (next() % 1_000_000_000) - 500_000_000;
        const roundTripped = toMinorUnits(toMajorUnits(money(amountMinor, currency)), currency);
        expect(roundTripped).toBe(amountMinor);
      }
    }
  });
});

describe('formatMoney', () => {
  it('formats per locale + currency without hard-coding $ or decimals', () => {
    const usd = formatMoney(money(2599, 'USD'), 'en-US');
    expect(usd).toContain('25.99');

    const jpy = formatMoney(money(500, 'JPY'), 'ja-JP');
    // Zero-decimal currency: no fractional part.
    expect(jpy).not.toContain('.00');
  });
});
