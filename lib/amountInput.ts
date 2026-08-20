/**
 * Locale-aware amount INPUT parsing (F29). The money engine stores integer minor
 * units; this is the front door that turns what a person types into a plain
 * major-unit number for `toMinorUnits`. A user in a comma-decimal locale types
 * "12,50" and means 12.5; an Arabic user may type Arabic-Indic digits ("١٢٫٥").
 *
 * Pure (no Expo/RN imports) so it unit-tests under jest and can sit beside
 * lib/money.ts. It does NOT change the stored representation — callers still feed
 * the returned number to `toMinorUnits`.
 */

/** Map Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII. */
function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) {
      out += String.fromCharCode(code - 0x0660 + 48); // Arabic-Indic
    } else if (code >= 0x06f0 && code <= 0x06f9) {
      out += String.fromCharCode(code - 0x06f0 + 48); // Extended (Persian/Urdu)
    } else {
      out += ch;
    }
  }
  return out;
}

/** Discover a locale's decimal + group separators from Intl (with fallbacks). */
function separatorsFor(locale: string): { decimal: string; group: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
    const group = parts.find((p) => p.type === 'group')?.value ?? ',';
    return { decimal, group };
  } catch {
    return { decimal: '.', group: ',' };
  }
}

/**
 * Parse a user-typed amount string into a major-unit number, honoring the
 * locale's decimal separator. Returns `null` for blank or unparseable input so
 * callers can fall through to their existing validation error.
 */
export function parseAmount(input: string, locale: string): number | null {
  if (input == null) return null;
  const digits = toAsciiDigits(String(input)).trim();
  if (digits === '') return null;

  const { decimal, group } = separatorsFor(locale);

  let normalized = digits
    // Drop the locale's grouping separator wherever it appears.
    .split(group)
    .join('')
    // Common whitespace groupers ICU may use (NBSP, narrow NBSP, thin space).
    .replace(/[\s   ]/g, '')
    // Normalize the minus sign (U+2212) to ASCII.
    .replace(/−/g, '-');

  // Fold the locale decimal separator to '.'. If the locale groups with '.',
  // that char was already removed above, so this only runs for comma-decimals.
  if (decimal !== '.') {
    normalized = normalized.split(decimal).join('.');
  }

  // Reject anything that isn't a plain signed decimal after normalization.
  if (!/^-?\d*\.?\d+$/.test(normalized) && !/^-?\d+\.?\d*$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
