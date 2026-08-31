/**
 * Month In / Out / Net for the Activity summary (matches the Flow Prototype's
 * Activity header). FX-correct: each transaction is consolidated into the
 * reporting currency via the same rule as the dashboard rollup; a currency with
 * no rate is surfaced in `missing` (never silently counted as zero).
 *
 * Transfers are EXCLUDED (neutral — both legs would cancel in Net but inflate In
 * and Out). Income counts as In; expense, goal contributions and debt payments
 * count as Out. No I/O — unit-tested; kept Supabase-free via a minimal shape.
 */

import { convertMinor } from '@/features/finance/fx';
import { monthKeyOf } from '@/features/finance/insights';
import type { FlowDirection, TransactionType } from '@/lib/database.types';

export interface FlowTxn {
  type: TransactionType;
  direction: FlowDirection;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
}

export interface MonthFlow {
  /** In / Out / Net in the reporting currency's minor units. */
  inMinor: number;
  outMinor: number;
  netMinor: number;
  /** Currencies with no rate to the reporting currency (excluded from totals). */
  missing: string[];
}

/**
 * Aggregate one calendar month's flows into the reporting currency.
 * @param monthKey 'YYYY-MM'
 */
export function monthFlow(
  txns: ReadonlyArray<FlowTxn>,
  monthKey: string,
  reporting: string,
  rateFor: (from: string, to: string) => number | null,
): MonthFlow {
  const rep = reporting.toUpperCase();
  const missing = new Set<string>();
  let inMinor = 0;
  let outMinor = 0;

  for (const tx of txns) {
    if (tx.type === 'transfer') continue; // neutral — excluded from In/Out/Net
    if (monthKeyOf(tx.occurred_at) !== monthKey) continue;

    const from = tx.currency_code.toUpperCase();
    let repMinor: number;
    if (from === rep) {
      repMinor = tx.amount_minor;
    } else {
      const rate = rateFor(from, rep);
      if (rate == null) {
        missing.add(from);
        continue;
      }
      repMinor = convertMinor(tx.amount_minor, from, rep, rate);
    }

    if (tx.direction === 'in') inMinor += repMinor;
    else outMinor += repMinor;
  }

  return { inMinor, outMinor, netMinor: inMinor - outMinor, missing: [...missing] };
}
