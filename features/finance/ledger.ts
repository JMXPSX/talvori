/**
 * Pure per-account ledger (money-model #5). One row per account with In / Out /
 * Net for one calendar month, in each account's OWN currency — a transaction's
 * currency follows its account (DB trigger), so no FX is needed here and Checking
 * and Savings are never silently combined.
 *
 * Transfers count both legs: a transfer-out is Out on its source account and a
 * transfer-in is In on its destination account, because each leg is its own
 * transaction row on its own account (linked by `transfer_group_id`). Goal
 * contributions and debt payments post as read-only `out` transactions (#6), so
 * they fall into Out naturally with no special-casing.
 *
 * No I/O — unit-tested; decoupled from api.ts via a minimal transaction shape so
 * jest never loads the Supabase client.
 */

import type { FlowDirection } from '@/lib/database.types';
import { monthKeyOf } from '@/features/finance/insights';

/** Minimal transaction shape the ledger needs (kept Supabase-free). */
export interface LedgerTxn {
  account_id: string;
  direction: FlowDirection;
  amount_minor: number;
  occurred_at: string;
}

/** Minimal account shape — id + its native currency for the row. */
export interface LedgerAccount {
  id: string;
  currency_code: string;
}

export interface AccountLedgerRow {
  accountId: string;
  /** The account's own currency; In/Out/Net are all in its minor units. */
  currency: string;
  inMinor: number;
  outMinor: number;
  /** In − Out, in the account's minor units (may be negative). */
  netMinor: number;
}

/**
 * In / Out / Net per account for one calendar month. Returns a row for every
 * account passed in (zero-activity accounts included), in the same order.
 *
 * @param monthKey 'YYYY-MM' — transactions outside this month are ignored.
 */
export function accountLedger(
  accounts: ReadonlyArray<LedgerAccount>,
  txns: ReadonlyArray<LedgerTxn>,
  monthKey: string,
): AccountLedgerRow[] {
  const rows = new Map<string, AccountLedgerRow>();
  for (const a of accounts) {
    rows.set(a.id, { accountId: a.id, currency: a.currency_code, inMinor: 0, outMinor: 0, netMinor: 0 });
  }

  for (const tx of txns) {
    if (monthKeyOf(tx.occurred_at) !== monthKey) continue;
    const row = rows.get(tx.account_id);
    if (!row) continue; // transaction on an account not in view (e.g. archived) — skip
    if (tx.direction === 'in') row.inMinor += tx.amount_minor;
    else row.outMinor += tx.amount_minor;
  }

  for (const row of rows.values()) row.netMinor = row.inMinor - row.outMinor;
  return accounts.map((a) => rows.get(a.id) as AccountLedgerRow);
}
