/**
 * Pure grocery math in integer minor units (list currency). No I/O — unit
 * tested and reusable in the list UI. Null prices count as 0.
 */

import type { GroceryItemRow } from '@/lib/database.types';

type PriceItem = Pick<
  GroceryItemRow,
  'estimated_price_minor' | 'actual_price_minor' | 'is_purchased'
>;

/** Sum of every item's estimated price (null → 0). */
export function estimatedTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce((sum, it) => sum + (it.estimated_price_minor ?? 0), 0);
}

/** Sum of actual prices for purchased items only (null → 0). */
export function actualTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce(
    (sum, it) => sum + (it.is_purchased ? it.actual_price_minor ?? 0 : 0),
    0,
  );
}

/** How many items are marked purchased. */
export function purchasedCount(items: readonly PriceItem[]): number {
  return items.reduce((n, it) => n + (it.is_purchased ? 1 : 0), 0);
}
