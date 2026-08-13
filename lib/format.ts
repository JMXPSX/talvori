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

const DATE_OPTS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

function parse(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locale-explicit date formatter (pure). Empty string on invalid input. */
export function formatDateWithLocale(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = parse(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...opts }).format(d);
}

/** Locale-explicit date+time formatter (pure). Empty string on invalid input. */
export function formatDateTimeWithLocale(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = parse(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...TIME_OPTS, ...opts }).format(d);
}

/** Device-locale date. */
export function formatDate(iso: string): string {
  return formatDateWithLocale(iso, localeTag());
}

/** Device-locale date + time. */
export function formatDateTime(iso: string): string {
  return formatDateTimeWithLocale(iso, localeTag());
}
