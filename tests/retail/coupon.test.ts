import { applyCoupon, couponStatus } from '@/features/retail/coupon';
import type { CouponRow } from '@/lib/database.types';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

function coupon(over: Partial<CouponRow>): CouponRow {
  return {
    id: 'c', household_id: 'h', retailer_id: 'r', retailer_product_id: null,
    title: 'Test', code: null, source_url: null, notes: null,
    discount_type: 'fixed', discount_amount_minor: 500, discount_percent: null,
    currency_code: 'USD', min_purchase_minor: null, max_discount_minor: null,
    starts_at: null, expires_at: null, created_by: 'u', created_at: iso(now), updated_at: iso(now),
    ...over,
  };
}

describe('couponStatus', () => {
  it('is active with no dates', () => {
    expect(couponStatus(coupon({}), now)).toBe('active');
  });
  it('is expired past expires_at', () => {
    expect(couponStatus(coupon({ expires_at: iso(now - DAY) }), now)).toBe('expired');
  });
  it('is scheduled before starts_at', () => {
    expect(couponStatus(coupon({ starts_at: iso(now + DAY) }), now)).toBe('scheduled');
  });
});

describe('applyCoupon', () => {
  it('applies a fixed discount', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 500, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 1500, savingsMinor: 500 });
  });
  it('caps a fixed discount at the base price', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 5000, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 0, savingsMinor: 2000 });
  });
  it('applies a percent discount', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 10, currency_code: null }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1800, savingsMinor: 200 });
  });
  it('respects a percent max-discount cap', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 50,
        currency_code: null, max_discount_minor: 300 }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1700, savingsMinor: 300 });
  });
  it('is not applicable below min purchase', () => {
    const r = applyCoupon(coupon({ min_purchase_minor: 3000 }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'min_purchase' });
  });
  it('is not applicable on a currency mismatch (fixed)', () => {
    const r = applyCoupon(coupon({ currency_code: 'EUR' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'currency' });
  });
  it('is not applicable when expired', () => {
    const r = applyCoupon(coupon({ expires_at: iso(now - DAY) }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'expired' });
  });
});
