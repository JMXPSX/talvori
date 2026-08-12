/**
 * Presentation helpers that need the device locale. Kept separate from
 * lib/money.ts so the money engine stays free of Expo dependencies.
 */

import { getLocales } from 'expo-localization';

import { formatMoney, money } from '@/lib/money';

/** Best BCP-47 tag for formatting (device locale), falling back to en-US. */
export function localeTag(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en-US';
  } catch {
    return 'en-US';
  }
}

/** Format integer minor units + currency for display in the device locale. */
export function formatAmount(amountMinor: number, currencyCode: string): string {
  return formatMoney(money(amountMinor, currencyCode), localeTag());
}
