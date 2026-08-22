/**
 * Coupon-aware basket comparison (pure). Extends the plain `compareColumns` by
 * netting out coupons that are valid at each column's retailer, then ranking
 * columns by their NET total so the best basket reflects applicable coupons.
 *
 * Coupons are retailer-scoped: a coupon only helps columns belonging to its
 * retailer. Savings reuse the pure `applyCoupon` math against each item's lowest
 * price at that column, in the single comparison currency.
 */

import type { BasketItem, PricePoint } from '@/features/retail/basket';
import { applyCoupon, type CouponLike } from '@/features/retail/coupon';

export interface CouponForColumn {
  retailerId: string;
  coupon: CouponLike;
}

export interface ColumnTotalCoupon {
  columnKey: string;
  grossMinor: number;
  savingsMinor: number;
  netMinor: number;
  pricedCount: number;
  missingCount: number;
}

export function compareColumnsWithCoupons(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
  columnRetailer: Readonly<Record<string, string>>,
  couponsByProduct: ReadonlyMap<string, readonly CouponForColumn[]>,
  currencyCode: string,
  nowMs: number,
): ColumnTotalCoupon[] {
  const lowest = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.productId} ${p.columnKey}`;
    const prev = lowest.get(key);
    if (prev === undefined || p.effectiveMinor < prev) lowest.set(key, p.effectiveMinor);
  }

  const columns = Array.from(new Set(prices.map((p) => p.columnKey)));

  const totals = columns.map((columnKey): ColumnTotalCoupon => {
    const retailerId = columnRetailer[columnKey];
    let grossMinor = 0;
    let savingsMinor = 0;
    let pricedCount = 0;

    for (const it of items) {
      const base = lowest.get(`${it.productId} ${columnKey}`);
      if (base === undefined) continue;
      pricedCount += 1;
      grossMinor += base;

      let best = 0;
      const coupons = couponsByProduct.get(it.productId);
      if (coupons && retailerId) {
        for (const { retailerId: rid, coupon } of coupons) {
          if (rid !== retailerId) continue;
          const r = applyCoupon(coupon, base, currencyCode, nowMs);
          if (r.applicable && r.savingsMinor > best) best = r.savingsMinor;
        }
      }
      savingsMinor += best;
    }

    return {
      columnKey,
      grossMinor,
      savingsMinor,
      netMinor: grossMinor - savingsMinor,
      pricedCount,
      missingCount: items.length - pricedCount,
    };
  });

  return totals.sort((a, b) => a.netMinor - b.netMinor);
}
