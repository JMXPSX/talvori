/**
 * Currency catalog for the picker (3b — fixes F25). Pure: derives the code list,
 * localized names, and symbols from Intl at runtime (no bundled table to rot),
 * with a small fallback set for engines that lack `Intl.supportedValuesOf`.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/** Common currencies used when `Intl.supportedValuesOf('currency')` is absent. */
const FALLBACK_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'PHP', 'SAR', 'AED', 'INR', 'CNY', 'KRW',
  'AUD', 'CAD', 'CHF', 'HKD', 'SGD', 'MYR', 'THB', 'IDR', 'VND', 'KWD',
  'BHD', 'OMR', 'QAR', 'MXN', 'BRL', 'ZAR', 'NGN', 'EGP', 'TRY', 'NZD',
];

function supportedCurrencyCodes(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    const codes = fn?.('currency');
    if (codes && codes.length > 0) return codes;
  } catch {
    // fall through
  }
  return FALLBACK_CODES;
}

/** Localized display name for a currency code, falling back to the code. */
export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Narrow symbol for a currency code (e.g. "$", "₱"), falling back to the code. */
export function currencySymbol(code: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/** Full, code-sorted catalog with localized names + symbols. */
export function listCurrencies(locale: string): CurrencyInfo[] {
  return supportedCurrencyCodes()
    .map((code) => ({ code, name: currencyName(code, locale), symbol: currencySymbol(code, locale) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Filter by a query matching code, name, or symbol (case-insensitive). */
export function filterCurrencies(list: readonly CurrencyInfo[], query: string): CurrencyInfo[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...list];
  return list.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q),
  );
}
