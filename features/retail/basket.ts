/**
 * Pure basket comparison over opaque column keys (the caller maps a branch or an
 * online retailer to a key + label). Amounts are integer minor units in ONE
 * currency (caller pre-filters to the reporting currency). Coupons are handled
 * separately — totals here are pre-coupon.
 */

export interface BasketItem {
  productId: string;
}
export interface PricePoint {
  productId: string;
  columnKey: string;
  effectiveMinor: number;
}
export interface ColumnTotal {
  columnKey: string;
  totalMinor: number;
  pricedCount: number;
  missingCount: number;
}

/** Lowest price per (product, column). */
function lowestByProductColumn(prices: readonly PricePoint[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.productId} ${p.columnKey}`;
    const prev = best.get(key);
    if (prev === undefined || p.effectiveMinor < prev) best.set(key, p.effectiveMinor);
  }
  return best;
}

/** Per column: total of priced items + coverage counts. Sorted by total asc. */
export function compareColumns(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): ColumnTotal[] {
  const lowest = lowestByProductColumn(prices);
  const columns = Array.from(new Set(prices.map((p) => p.columnKey)));
  const totals = columns.map((columnKey) => {
    let totalMinor = 0;
    let pricedCount = 0;
    for (const it of items) {
      const v = lowest.get(`${it.productId} ${columnKey}`);
      if (v !== undefined) {
        totalMinor += v;
        pricedCount += 1;
      }
    }
    return { columnKey, totalMinor, pricedCount, missingCount: items.length - pricedCount };
  });
  return totals.sort((a, b) => a.totalMinor - b.totalMinor);
}

/** Best price per item across all columns, summed (the theoretical floor). */
export function bestFloorMinor(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): { totalMinor: number; pricedCount: number } {
  const bestPerProduct = new Map<string, number>();
  for (const p of prices) {
    const prev = bestPerProduct.get(p.productId);
    if (prev === undefined || p.effectiveMinor < prev) bestPerProduct.set(p.productId, p.effectiveMinor);
  }
  let totalMinor = 0;
  let pricedCount = 0;
  for (const it of items) {
    const v = bestPerProduct.get(it.productId);
    if (v !== undefined) {
      totalMinor += v;
      pricedCount += 1;
    }
  }
  return { totalMinor, pricedCount };
}
