/**
 * Pure range reporting (Reports screen). Cash flow (in / out / net) plus a
 * per-category expense breakdown for an arbitrary inclusive [from, to] date
 * range, consolidated into the reporting currency by the same FX rule as the
 * dashboard. Currencies with no rate are surfaced in `missing` (never counted
 * as zero). Transfers are neutral and excluded. No I/O — unit-tested; decoupled
 * from api.ts via a minimal txn shape so jest never loads Supabase.
 */

import { convertMinor } from '@/features/finance/fx';
import type { FlowDirection, TransactionType } from '@/lib/database.types';

export interface ReportTxn {
  type: TransactionType;
  direction: FlowDirection;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  category_id: string | null;
}

export type RangePreset = 'this-month' | 'last-month' | 'last-3-months' | 'ytd';

/** Inclusive date range, both ends 'YYYY-MM-DD'. */
export interface DateRange {
  from: string;
  to: string;
}

export interface CategorySpend {
  categoryId: string | null;
  amountMinor: number;
}

export interface RangeReport {
  /** In / Out / Net in the reporting currency's minor units. */
  inMinor: number;
  outMinor: number;
  netMinor: number;
  /** Non-transfer transactions counted (i.e. with a known rate) in the range. */
  count: number;
  /** Per-category expense spend in reporting units, largest first. */
  byCategory: CategorySpend[];
  /** Currencies with no rate to the reporting currency (excluded from totals). */
  missing: string[];
}

const pad = (n: number): string => String(n).padStart(2, '0');
const dateOf = (iso: string): string => iso.slice(0, 10);

/** Last calendar day of month `m` (1-based) as 'YYYY-MM-DD'. */
function lastDayOf(y: number, m: number): string {
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** Inclusive [from, to] for a named preset, relative to `todayISO`. */
export function presetRange(preset: RangePreset, todayISO: string): DateRange {
  const d = dateOf(todayISO);
  const y = +d.slice(0, 4);
  const m = +d.slice(5, 7); // 1-based
  switch (preset) {
    case 'this-month':
      return { from: `${y}-${pad(m)}-01`, to: d };
    case 'last-month': {
      const ly = m === 1 ? y - 1 : y;
      const lm = m === 1 ? 12 : m - 1;
      return { from: `${ly}-${pad(lm)}-01`, to: lastDayOf(ly, lm) };
    }
    case 'last-3-months': {
      // This month plus the prior two full months (m is 1-based → m-3 is 0-based two months back).
      const start = new Date(Date.UTC(y, m - 3, 1));
      return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: d };
    }
    case 'ytd':
      return { from: `${y}-01-01`, to: d };
  }
}

/**
 * Aggregate flows over [range.from, range.to] into the reporting currency.
 * @param rateFor (from, to) => rate or null when no rate is known
 */
export function reportForRange(
  txns: ReadonlyArray<ReportTxn>,
  range: DateRange,
  reporting: string,
  rateFor: (from: string, to: string) => number | null,
): RangeReport {
  const rep = reporting.toUpperCase();
  const byCat = new Map<string, number>(); // key: category_id or '' for none
  const missing = new Set<string>();
  let inMinor = 0;
  let outMinor = 0;
  let count = 0;

  for (const tx of txns) {
    if (tx.type === 'transfer') continue; // neutral — excluded from In/Out/Net
    const d = dateOf(tx.occurred_at);
    if (d < range.from || d > range.to) continue;

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

    count += 1;
    if (tx.direction === 'in') {
      inMinor += repMinor;
    } else {
      outMinor += repMinor;
      if (tx.type === 'expense') {
        const key = tx.category_id ?? '';
        byCat.set(key, (byCat.get(key) ?? 0) + repMinor);
      }
    }
  }

  const byCategory = [...byCat.entries()]
    .map(([k, amountMinor]) => ({ categoryId: k === '' ? null : k, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  return { inMinor, outMinor, netMinor: inMinor - outMinor, count, byCategory, missing: [...missing] };
}
