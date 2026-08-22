import { computeListCouponSavings, type ListItemForMatch } from '@/features/retail/couponMatch';

const NOW = Date.parse('2026-08-22T00:00:00Z');

type TestCoupon = Parameters<typeof computeListCouponSavings>[0][number];

function coupon(over: Partial<TestCoupon> = {}): TestCoupon {
  return {
    discount_type: 'percent',
    discount_amount_minor: null,
    discount_percent: 10,
    currency_code: null,
    min_purchase_minor: null,
    max_discount_minor: null,
    starts_at: null,
    expires_at: null,
    retailer_product: { product_id: 'p1' },
    ...over,
  } as TestCoupon;
}

const milk: ListItemForMatch = { product_id: 'p1', name: 'Milk', estimatedPriceMinor: 5000 };

describe('computeListCouponSavings', () => {
  it('matches by product and totals percent savings', () => {
    const r = computeListCouponSavings([coupon()], [milk], 'USD', NOW);
    expect(r.matches[0]!.matchedItemName).toBe('Milk');
    expect(r.matches[0]!.savingsMinor).toBe(500); // 10% of 5000
    expect(r.totalSavingsMinor).toBe(500);
  });

  it('matches the item but yields 0 savings when the fixed coupon currency differs', () => {
    const c = coupon({ discount_type: 'fixed', discount_amount_minor: 1000, currency_code: 'PHP' });
    const r = computeListCouponSavings([c], [milk], 'USD', NOW);
    expect(r.matches[0]!.matchedItemName).toBe('Milk');
    expect(r.matches[0]!.savingsMinor).toBe(0);
    expect(r.totalSavingsMinor).toBe(0);
  });

  it('takes the best coupon per item in the total (no double count)', () => {
    const pct = coupon(); // 500
    const fixed = coupon({ discount_type: 'fixed', discount_amount_minor: 1000, currency_code: 'USD' });
    const r = computeListCouponSavings([pct, fixed], [milk], 'USD', NOW);
    expect(r.matches.map((m) => m.savingsMinor).sort((a, b) => a - b)).toEqual([500, 1000]);
    expect(r.totalSavingsMinor).toBe(1000); // best of the two, once
  });

  it('marks a match but 0 savings when the item has no estimated price', () => {
    const r = computeListCouponSavings([coupon()], [{ ...milk, estimatedPriceMinor: null }], 'USD', NOW);
    expect(r.matches[0]!.matchedItemName).toBe('Milk');
    expect(r.matches[0]!.savingsMinor).toBe(0);
    expect(r.totalSavingsMinor).toBe(0);
  });

  it('does not match a coupon for a product that is not on the list', () => {
    const off = coupon({ retailer_product: { product_id: 'p2' } });
    const wide = coupon({ retailer_product: null });
    const r = computeListCouponSavings([off, wide], [milk], 'USD', NOW);
    expect(r.matches.every((m) => m.matchedItemName === null)).toBe(true);
    expect(r.totalSavingsMinor).toBe(0);
  });

  it('gives 0 savings for an expired coupon', () => {
    const c = coupon({ expires_at: '2026-08-01T00:00:00Z' });
    const r = computeListCouponSavings([c], [milk], 'USD', NOW);
    expect(r.matches[0]!.savingsMinor).toBe(0);
  });
});
