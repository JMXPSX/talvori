/**
 * Pure FX conversion — exponent-aware, integer minor units in and out. No I/O.
 *
 * A rate means: 1 unit of `base` = `rate` units of `quote`
 * (amount_in_quote = amount_in_base * rate). Because currencies have different
 * minor-unit exponents (USD 2, JPY 0, BHD 3), conversion goes through MAJOR
 * units and re-rounds to the target currency's minor units.
 */

import { minorExponent } from '@/lib/money';

export interface Rate {
  base: string;
  quote: string;
  rate: number;
}

/** Convert an amount in `from` currency (minor units) into `to` (minor units). */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  if (from.toUpperCase() === to.toUpperCase()) return amountMinor;
  const majorFrom = amountMinor / 10 ** minorExponent(from);
  const majorTo = majorFrom * rate;
  return Math.round(majorTo * 10 ** minorExponent(to));
}

export interface Convertible {
  balanceMinor: number;
  currency: string;
}

export interface RollupResult {
  /** Total in the reporting currency's minor units (only convertible items). */
  totalMinor: number;
  /** Currencies with no available rate to the reporting currency. */
  missing: string[];
}

/**
 * Sum items into the reporting currency. Items already in the reporting currency
 * pass through; others use `rateFor(from, to)`. Items with no rate are excluded
 * from the total and reported in `missing` (never silently counted as zero).
 */
export function sumInReporting(
  items: ReadonlyArray<Convertible>,
  reporting: string,
  rateFor: (from: string, to: string) => number | null,
): RollupResult {
  let totalMinor = 0;
  const missing = new Set<string>();

  for (const item of items) {
    if (item.currency.toUpperCase() === reporting.toUpperCase()) {
      totalMinor += item.balanceMinor;
      continue;
    }
    const rate = rateFor(item.currency, reporting);
    if (rate == null) {
      missing.add(item.currency.toUpperCase());
      continue;
    }
    totalMinor += convertMinor(item.balanceMinor, item.currency, reporting, rate);
  }

  return { totalMinor, missing: [...missing] };
}
