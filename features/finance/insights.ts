/**
 * Pure spending-insights aggregation (2d — fixes F24). Month-scoped and
 * FX-correct: expenses are converted into the reporting currency via the same
 * rule as the dashboard rollup, and any currency without a rate is surfaced in
 * `missing` (never silently counted as zero). No I/O — unit-tested; decoupled
 * from api.ts via a minimal transaction shape so jest never loads Supabase.
 */

import { convertMinor } from '@/features/finance/fx';

export interface InsightTxn {
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  category_id: string | null;
}

export interface CategorySpend {
  categoryId: string | null;
  amountMinor: number;
}

export interface MonthInsights {
  /** Total expense, in the reporting currency's minor units. */
  totalSpentMinor: number;
  /** Number of expense transactions counted in the month. */
  count: number;
  /** Per-category spend in reporting units, largest first. */
  byCategory: CategorySpend[];
  /** Currencies with no rate to the reporting currency (excluded from totals). */
  missing: string[];
}

/** The 'YYYY-MM' month key of an ISO timestamp. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Aggregate expenses for one calendar month into the reporting currency.
 * @param monthKey 'YYYY-MM'
 * @param rateFor (from, to) => rate or null when no rate is known
 */
export function insightsForMonth(
  txns: ReadonlyArray<InsightTxn>,
  monthKey: string,
  reporting: string,
  rateFor: (from: string, to: string) => number | null,
): MonthInsights {
  const rep = reporting.toUpperCase();
  const byCat = new Map<string, number>(); // key: category_id or '' for none
  const missing = new Set<string>();
  let totalSpentMinor = 0;
  let count = 0;

  for (const tx of txns) {
    if (tx.type !== 'expense') continue;
    if (monthKeyOf(tx.occurred_at) !== monthKey) continue;
    count += 1;

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
    totalSpentMinor += repMinor;
    const key = tx.category_id ?? '';
    byCat.set(key, (byCat.get(key) ?? 0) + repMinor);
  }

  const byCategory = [...byCat.entries()]
    .map(([k, amountMinor]) => ({ categoryId: k === '' ? null : k, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  return { totalSpentMinor, count, byCategory, missing: [...missing] };
}
