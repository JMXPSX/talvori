/**
 * Match coupons to the household's current grocery list and total the savings
 * they would unlock (pure).
 *
 * A coupon matches a list item when they point at the same catalog product
 * (`coupon.retailer_product.product_id === item.product_id`). Savings reuse the
 * pure coupon math in `coupon.ts`, applied to the item's ESTIMATED price (list
 * items rarely carry an observed `price_snapshot`, but they do carry an estimate)
 * in the list currency. The total takes the best coupon per product so two
 * coupons on one item never double-count.
 */

import { applyCoupon, type CouponLike } from '@/features/retail/coupon';

export interface ListItemForMatch {
  product_id: string | null;
  name: string;
  estimatedPriceMinor: number | null;
}

export interface CouponListMatch<C> {
  coupon: C;
  matchedItemName: string | null;
  savingsMinor: number;
}

export interface ListCouponSummary<C> {
  matches: CouponListMatch<C>[];
  totalSavingsMinor: number;
}

type MatchableCoupon = CouponLike & {
  retailer_product: { product_id?: string | null } | null;
};

export function computeListCouponSavings<C extends MatchableCoupon>(
  coupons: readonly C[],
  listItems: readonly ListItemForMatch[],
  listCurrency: string,
  nowMs: number,
): ListCouponSummary<C> {
  const itemByProduct = new Map<string, ListItemForMatch>();
  for (const it of listItems) {
    if (it.product_id && !itemByProduct.has(it.product_id)) itemByProduct.set(it.product_id, it);
  }

  const matches: CouponListMatch<C>[] = [];
  const bestByProduct = new Map<string, number>();

  for (const coupon of coupons) {
    const pid = coupon.retailer_product?.product_id ?? null;
    const item = pid ? itemByProduct.get(pid) : undefined;
    if (!pid || !item) {
      matches.push({ coupon, matchedItemName: null, savingsMinor: 0 });
      continue;
    }
    const savingsMinor =
      item.estimatedPriceMinor != null
        ? applyCoupon(coupon, item.estimatedPriceMinor, listCurrency, nowMs).savingsMinor
        : 0;
    matches.push({ coupon, matchedItemName: item.name, savingsMinor });
    if (savingsMinor > (bestByProduct.get(pid) ?? 0)) bestByProduct.set(pid, savingsMinor);
  }

  let totalSavingsMinor = 0;
  for (const v of bestByProduct.values()) totalSavingsMinor += v;

  return { matches, totalSavingsMinor };
}
