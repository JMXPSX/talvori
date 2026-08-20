/**
 * Locale-aware amount input parsing (F29). Proves the field accepts what a user
 * in each locale actually types — including the comma decimal ("12,50") and
 * Arabic-Indic digits — before the money engine converts to minor units.
 */

import { parseAmount } from '@/lib/amountInput';

describe('parseAmount — dot-decimal (en)', () => {
  it('parses a plain decimal', () => {
    expect(parseAmount('12.50', 'en-US')).toBe(12.5);
    expect(parseAmount('0.07', 'en-US')).toBe(0.07);
  });

  it('drops grouping separators', () => {
    expect(parseAmount('1,234.50', 'en-US')).toBe(1234.5);
  });
});

describe('parseAmount — comma-decimal locale (F29 "12,50")', () => {
  it('reads the comma as the decimal point', () => {
    expect(parseAmount('12,50', 'de-DE')).toBe(12.5);
  });

  it('reads dot as grouping under a comma-decimal locale', () => {
    expect(parseAmount('1.234,50', 'de-DE')).toBe(1234.5);
  });
});

describe('parseAmount — Arabic digits', () => {
  it('folds Arabic-Indic digits to ASCII', () => {
    expect(parseAmount('١٢', 'ar-SA')).toBe(12);
  });
});

describe('parseAmount — round-trips each locale format', () => {
  // Whatever separators a locale's Intl formatter emits, parseAmount reverses.
  it.each(['en-US', 'fil-PH', 'ar-SA', 'de-DE'])('round-trips %s', (locale) => {
    const value = 1234.5;
    const formatted = new Intl.NumberFormat(locale).format(value);
    expect(parseAmount(formatted, locale)).toBe(value);
  });
});

describe('parseAmount — rejects unparseable input', () => {
  it('returns null for blank or garbage', () => {
    expect(parseAmount('', 'en-US')).toBeNull();
    expect(parseAmount('   ', 'en-US')).toBeNull();
    expect(parseAmount('abc', 'en-US')).toBeNull();
  });
});
