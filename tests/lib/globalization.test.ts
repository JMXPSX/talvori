import { minorExponent, toMajorUnits, toMinorUnits, money } from '@/lib/money';
import { isRTLLanguage } from '@/lib/rtl';
import { formatDateWithLocale } from '@/lib/format';

// Priority markets (spec 05): core + GCC.
const EXP2 = ['USD', 'CAD', 'PHP', 'GBP', 'AUD', 'SGD', 'NZD', 'SAR', 'AED', 'QAR'];
const EXP3 = ['KWD', 'BHD', 'OMR'];

describe('currency exponents across priority markets', () => {
  it('uses 2 minor digits for standard priority currencies', () => {
    for (const c of EXP2) expect(minorExponent(c)).toBe(2);
  });
  it('uses 3 minor digits for the Gulf currencies', () => {
    for (const c of EXP3) expect(minorExponent(c)).toBe(3);
  });
  it('uses 0 minor digits for JPY (sanity)', () => {
    expect(minorExponent('JPY')).toBe(0);
  });
});

describe('minor-unit round-trip', () => {
  it('round-trips an exp-2 currency', () => {
    const minor = toMinorUnits(12.34, 'PHP'); // 1234
    expect(minor).toBe(1234);
    expect(toMajorUnits(money(minor, 'PHP'))).toBeCloseTo(12.34, 5);
  });
  it('round-trips an exp-3 currency', () => {
    const minor = toMinorUnits(12.345, 'KWD'); // 12345
    expect(minor).toBe(12345);
    expect(toMajorUnits(money(minor, 'KWD'))).toBeCloseTo(12.345, 5);
  });
});

describe('RTL detection across supported languages', () => {
  it('flags Arabic as RTL', () => {
    expect(isRTLLanguage('ar')).toBe(true);
    expect(isRTLLanguage('ar-SA')).toBe(true);
  });
  it('flags English and Filipino as LTR', () => {
    expect(isRTLLanguage('en')).toBe(false);
    expect(isRTLLanguage('fil')).toBe(false);
    expect(isRTLLanguage('tl')).toBe(false);
  });
});

describe('date formatting across supported locales', () => {
  const iso = '2026-08-12T00:00:00Z';
  it('produces non-empty output per locale and empty for bad input', () => {
    for (const loc of ['en-US', 'fil-PH', 'ar-SA']) {
      expect(formatDateWithLocale(iso, loc, { timeZone: 'UTC' }).length).toBeGreaterThan(0);
    }
    expect(formatDateWithLocale('', 'en-US')).toBe('');
  });
});
