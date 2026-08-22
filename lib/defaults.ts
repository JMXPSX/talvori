/**
 * App defaults for country / currency.
 *
 * The primary sample market is the United States, so when the device locale does
 * not supply a region or currency we fall back to US / USD rather than to empty.
 * Device locale still wins when present — this is a fallback for a global app,
 * not a forced override.
 */

import { getLocales } from 'expo-localization';

export const DEFAULT_COUNTRY = 'US';
export const DEFAULT_CURRENCY = 'USD';

export function defaultCurrencyCode(): string {
  try {
    return getLocales()[0]?.currencyCode || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function defaultCountryCode(): string {
  try {
    return getLocales()[0]?.regionCode || DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}
