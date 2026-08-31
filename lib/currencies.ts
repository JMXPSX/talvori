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

/** English names for the common set — used when `Intl.DisplayNames` can't resolve
 *  a real name (native Hermes lacks `type: 'currency'` and returns the code, so the
 *  picker showed "PHP — PHP"). Covers exactly the FALLBACK_CODES list native renders. */
const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  PHP: 'Philippine Peso', SAR: 'Saudi Riyal', AED: 'UAE Dirham', INR: 'Indian Rupee',
  CNY: 'Chinese Yuan', KRW: 'South Korean Won', AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar', CHF: 'Swiss Franc', HKD: 'Hong Kong Dollar',
  SGD: 'Singapore Dollar', MYR: 'Malaysian Ringgit', THB: 'Thai Baht',
  IDR: 'Indonesian Rupiah', VND: 'Vietnamese Dong', KWD: 'Kuwaiti Dinar',
  BHD: 'Bahraini Dinar', OMR: 'Omani Rial', QAR: 'Qatari Riyal',
  MXN: 'Mexican Peso', BRL: 'Brazilian Real', ZAR: 'South African Rand',
  NGN: 'Nigerian Naira', EGP: 'Egyptian Pound', TRY: 'Turkish Lira',
  NZD: 'New Zealand Dollar',
};

/** Localized display name for a currency code, falling back to a static name then the code. */
export function currencyName(code: string, locale: string): string {
  const upper = code.toUpperCase();
  try {
    // Intl.DisplayNames returns the code itself when it can't resolve a name
    // (native Hermes), so treat "name === code" as unresolved and fall through.
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
    if (name && name.toUpperCase() !== upper) return name;
  } catch {
    // fall through to the static map
  }
  return CURRENCY_NAMES[upper] ?? code;
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
