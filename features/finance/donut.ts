/**
 * Spending-by-category math for the dashboard donut. Pure. Category totals are
 * consolidated into the reporting currency via the same `sumInReporting` used
 * elsewhere (missing-rate transactions contribute 0, consistent with the
 * dashboard total). `donutArcs` turns values into [0,1] fractions + offsets for
 * an SVG stroke donut.
 */

import type { TransactionWithRefs } from '@/features/finance/api';
import { sumInReporting } from '@/features/finance/fx';

export const CATEGORY_COLORS = [
  '#0E6E5C', // teal (brand)
  '#E0A72E', // gold (accent)
  '#3B82C4', // blue
  '#B23A2E', // red
  '#7C5CBF', // violet
  '#2E8B57', // green
  '#D9773B', // orange
  '#5E6B63', // gray-green
] as const;

export interface DonutArc {
  fraction: number; // share of the whole, [0,1]
  offset: number; // cumulative start, [0,1]
}

/** Fractions + cumulative offsets for each value (negatives/zero ignored). */
export function donutArcs(values: readonly number[]): DonutArc[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return [];
  const arcs: DonutArc[] = [];
  let acc = 0;
  for (const v of values) {
    const fraction = Math.max(0, v) / total;
    arcs.push({ fraction, offset: acc });
    acc += fraction;
  }
  return arcs;
}

export interface CategorySlice {
  label: string;
  amountMinor: number;
  color: string;
}

type BreakdownTx = Pick<TransactionWithRefs, 'type' | 'amount_minor' | 'currency_code' | 'category'>;

/** Expense totals grouped by category, in the reporting currency, sorted desc. */
export function categoryBreakdown(
  txns: readonly BreakdownTx[],
  reporting: string,
  rateLookup: Parameters<typeof sumInReporting>[2],
  unknownLabel: string,
): { slices: CategorySlice[]; totalMinor: number } {
  const groups = new Map<string, { balanceMinor: number; currency: string }[]>();
  for (const tx of txns) {
    if (tx.type !== 'expense') continue;
    const label = tx.category?.name ?? unknownLabel;
    const arr = groups.get(label) ?? [];
    arr.push({ balanceMinor: tx.amount_minor, currency: tx.currency_code });
    groups.set(label, arr);
  }
  const raw: { label: string; amountMinor: number }[] = [];
  for (const [label, items] of groups) {
    const { totalMinor } = sumInReporting(items, reporting, rateLookup);
    if (totalMinor > 0) raw.push({ label, amountMinor: totalMinor });
  }
  raw.sort((a, b) => b.amountMinor - a.amountMinor);
  const slices: CategorySlice[] = raw.map((r, i) => ({
    ...r,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] as string,
  }));
  const totalMinor = slices.reduce((s, x) => s + x.amountMinor, 0);
  return { slices, totalMinor };
}
