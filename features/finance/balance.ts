/**
 * Pure balance math — the client-side mirror of the `account_balances` SQL view.
 * Kept pure (no I/O) so it's unit-testable and reusable for optimistic UI.
 * Everything is in integer minor units.
 */

import type { FlowDirection } from '@/lib/database.types';

export function signedMinor(direction: FlowDirection, amountMinor: number): number {
  return direction === 'in' ? amountMinor : -amountMinor;
}

/** balance = opening + Σ(in) − Σ(out), all in minor units. */
export function computeBalanceMinor(
  openingMinor: number,
  entries: ReadonlyArray<{ direction: FlowDirection; amount_minor: number }>,
): number {
  return entries.reduce((acc, e) => acc + signedMinor(e.direction, e.amount_minor), openingMinor);
}
