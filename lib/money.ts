/**
 * Money utilities — Phase 1 foundation only (see 04_DATABASE_MONEY_MULTICURRENCY_SPEC.md).
 *
 * CRITICAL RULES enforced here:
 *   - Money is ALWAYS integer minor units + an ISO currency code. Never float.
 *   - Minor-unit exponent varies by currency (JPY=0, USD=2, BHD/KWD/OMR=3).
 *   - Nothing hard-codes '$', 'USD', or two decimals. Formatting is locale +
 *     currency driven via Intl.NumberFormat.
 *
 * No persistence and no FX conversion yet — that arrives with the Phase 3
 * financial core. This is the shared primitive everything else will build on.
 */

/** A monetary value in the smallest indivisible unit of its currency. */
export interface Money {
  /** Integer amount in minor units (e.g. 2599 for USD $25.99, 500 for ¥500). */
  amountMinor: number;
  /** ISO 4217 currency code, e.g. 'USD', 'JPY', 'PHP', 'SAR'. */
  currencyCode: string;
}

/**
 * Minor-unit exponents for currencies that deviate from the 2-decimal default.
 * Not exhaustive — extended as markets are validated in Phase 7. Anything not
 * listed falls back to `DEFAULT_MINOR_EXPONENT` (2).
 */
const MINOR_EXPONENTS: Readonly<Record<string, number>> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

const DEFAULT_MINOR_EXPONENT = 2;

/** Number of minor units per major unit for a currency (e.g. USD -> 100). */
export function minorExponent(currencyCode: string): number {
  return MINOR_EXPONENTS[currencyCode.toUpperCase()] ?? DEFAULT_MINOR_EXPONENT;
}

export function money(amountMinor: number, currencyCode: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Money.amountMinor must be an integer, got ${amountMinor}`);
  }
  if (!/^[A-Za-z]{3}$/.test(currencyCode)) {
    throw new Error(`Invalid ISO currency code: ${currencyCode}`);
  }
  return { amountMinor, currencyCode: currencyCode.toUpperCase() };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currencyCode !== b.currencyCode) {
    throw new Error(
      `Currency mismatch: ${a.currencyCode} vs ${b.currencyCode}. ` +
        'Convert via an FX snapshot before combining (Phase 3+).',
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currencyCode);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currencyCode);
}

/** Convert minor units to a major-unit number. Use for display/formatting only. */
export function toMajorUnits(value: Money): number {
  return value.amountMinor / 10 ** minorExponent(value.currencyCode);
}

/**
 * Convert a major-unit amount (e.g. user typed "25.99") into integer minor
 * units for the given currency, rounding half-away-from-zero.
 */
export function toMinorUnits(major: number, currencyCode: string): number {
  const factor = 10 ** minorExponent(currencyCode);
  // Math.round alone rounds negative halves toward +∞ (-2599.5 → -2599);
  // mirroring via the absolute value keeps halves away from zero for refunds.
  return Math.sign(major) * Math.round(Math.abs(major) * factor);
}

/**
 * Locale- and currency-aware formatting. NEVER hard-code the symbol or decimals.
 * @param locale BCP-47 tag, e.g. 'en-US', 'fil-PH', 'ar-SA'.
 */
export function formatMoney(value: Money, locale: string): string {
  const exponent = minorExponent(value.currencyCode);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currencyCode,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(toMajorUnits(value));
}
