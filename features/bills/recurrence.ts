/**
 * Pure recurrence math for bills. No I/O. Dates are ISO calendar dates
 * (`yyyy-mm-dd`) handled in UTC so they never drift a day across timezones.
 */

import type { BillFrequency } from '@/lib/database.types';

function isoDate(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/**
 * The next due date after `iso` for a given frequency. Monthly/yearly clamp the
 * day to the target month's length (Jan 31 → Feb 28; Feb 29 → non-leap Feb 28).
 *
 * ponytail: the anchor day can drift after a clamp — once a Jan-31 bill lands on
 * Feb 28 it stays on the 28th. Store an anchor day if strict "last day" matters.
 */
export function advanceDueDate(iso: string, frequency: BillFrequency): string {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (frequency === 'weekly') {
    return isoDate(new Date(Date.UTC(y, m - 1, d + 7)));
  }
  let year = y;
  let month = m - 1; // 0-based
  if (frequency === 'monthly') {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  } else {
    year += 1; // yearly
  }
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(year, month, Math.min(d, lastDay))));
}

/** True when a due date is strictly before today (both `yyyy-mm-dd`). */
export function isOverdue(dueISO: string, todayISO: string): boolean {
  return dueISO < todayISO;
}
