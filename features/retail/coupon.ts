/**
 * Pure coupon math. A coupon applies ON TOP of an effective base price (the
 * caller passes min(regular, sale)). Fixed coupons must match the price currency;
 * percent coupons are currency-agnostic. Savings never exceed the base price.
 */

export type CouponStatus = 'scheduled' | 'active' | 'expired';

export interface CouponLike {
  discount_type: 'fixed' | 'percent';
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

export interface ApplyResult {
  applicable: boolean;
  finalMinor: number;
  savingsMinor: number;
  reason?: 'expired' | 'scheduled' | 'currency' | 'min_purchase';
}

export function couponStatus(
  c: Pick<CouponLike, 'starts_at' | 'expires_at'>,
  nowMs: number,
): CouponStatus {
  if (c.expires_at != null && new Date(c.expires_at).getTime() < nowMs) return 'expired';
  if (c.starts_at != null && new Date(c.starts_at).getTime() > nowMs) return 'scheduled';
  return 'active';
}

export function applyCoupon(
  c: CouponLike,
  basePriceMinor: number,
  currencyCode: string,
  nowMs: number,
): ApplyResult {
  const notApplicable = (reason: ApplyResult['reason']): ApplyResult => ({
    applicable: false,
    finalMinor: basePriceMinor,
    savingsMinor: 0,
    reason,
  });

  const status = couponStatus(c, nowMs);
  if (status === 'expired') return notApplicable('expired');
  if (status === 'scheduled') return notApplicable('scheduled');
  if (c.discount_type === 'fixed' && c.currency_code !== currencyCode) {
    return notApplicable('currency');
  }
  if (c.min_purchase_minor != null && basePriceMinor < c.min_purchase_minor) {
    return notApplicable('min_purchase');
  }

  let raw: number;
  if (c.discount_type === 'fixed') {
    raw = c.discount_amount_minor ?? 0;
  } else {
    raw = Math.round((basePriceMinor * (c.discount_percent ?? 0)) / 100);
  }
  const cap = c.max_discount_minor ?? Infinity;
  const savingsMinor = Math.max(0, Math.min(raw, cap, basePriceMinor));
  return { applicable: true, finalMinor: basePriceMinor - savingsMinor, savingsMinor };
}
