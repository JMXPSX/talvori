/**
 * Pure helpers for the transaction edit sheet (3a). No I/O — unit-tested; the
 * screen wires these to `updateTransaction`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar-date (YYYY-MM-DD) portion of an ISO timestamp, or '' if invalid. */
export function isoDatePart(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/**
 * Build an `occurred_at` ISO string from a user-edited calendar date, enabling
 * backdating (F14). When the date is unchanged we keep the original timestamp
 * (so an untouched transaction keeps its clock time); when it changes we anchor
 * to noon UTC so the calendar day never slips across timezones. Returns null for
 * a malformed date so the caller can surface a validation error.
 */
export function occurredAtFrom(dateStr: string, originalISO: string): string | null {
  if (!ISO_DATE.test(dateStr)) return null;
  if (isoDatePart(originalISO) === dateStr) return originalISO;
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
