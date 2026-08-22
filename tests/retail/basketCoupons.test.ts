import {
  compareColumnsWithCoupons,
  type CouponForColumn,
} from '@/features/retail/basketCoupons';
import type { CouponLike } from '@/features/retail/coupon';

const NOW = Date.parse('2026-08-22T00:00:00Z');

function fixed(amountMinor: number, currency = 'USD', over: Partial<CouponLike> = {}): CouponLike {
  return {
    discount_type: 'fixed',
    discount_amount_minor: amountMinor,
    discount_percent: null,
    currency_code: currency,
    min_purchase_minor: null,
    max_discount_minor: null,
    starts_at: null,
    expires_at: null,
    ...over,
  };
}

const items = [{ productId: 'p1' }, { productId: 'p2' }];
// sA (retailer rA) is cheaper on list price; sB (retailer rB) pricier.
const prices = [
  { productId: 'p1', columnKey: 'sA', effectiveMinor: 1000 },
  { productId: 'p2', columnKey: 'sA', effectiveMinor: 1000 },
  { productId: 'p1', columnKey: 'sB', effectiveMinor: 1100 },
  { productId: 'p2', columnKey: 'sB', effectiveMinor: 1100 },
];
const columnRetailer = { sA: 'rA', sB: 'rB' };

describe('compareColumnsWithCoupons', () => {
  it('nets retailer-scoped coupons and can flip the ranking by net', () => {
    // A $5 coupon on p1, only at retailer rB (column sB).
    const couponsByProduct = new Map<string, CouponForColumn[]>([
      ['p1', [{ retailerId: 'rB', coupon: fixed(500) }]],
    ]);
    const r = compareColumnsWithCoupons(items, prices, columnRetailer, couponsByProduct, 'USD', NOW);

    // sB nets 2200 - 500 = 1700, beating sA's 2000.
    expect(r[0]!.columnKey).toBe('sB');
    expect(r[0]!.grossMinor).toBe(2200);
    expect(r[0]!.savingsMinor).toBe(500);
    expect(r[0]!.netMinor).toBe(1700);
    // The rB coupon does NOT touch sA (retailer rA).
    expect(r[1]!.columnKey).toBe('sA');
    expect(r[1]!.savingsMinor).toBe(0);
    expect(r[1]!.netMinor).toBe(2000);
  });

  it('falls back to list-price order when there are no coupons', () => {
    const r = compareColumnsWithCoupons(items, prices, columnRetailer, new Map(), 'USD', NOW);
    expect(r.map((c) => c.columnKey)).toEqual(['sA', 'sB']);
    expect(r.every((c) => c.savingsMinor === 0 && c.netMinor === c.grossMinor)).toBe(true);
  });

  it('ignores a coupon whose retailer has no column here', () => {
    const couponsByProduct = new Map<string, CouponForColumn[]>([
      ['p1', [{ retailerId: 'rZ', coupon: fixed(500) }]],
    ]);
    const r = compareColumnsWithCoupons(items, prices, columnRetailer, couponsByProduct, 'USD', NOW);
    expect(r.every((c) => c.savingsMinor === 0)).toBe(true);
  });

  it('reports coverage counts per column', () => {
    const partial = [{ productId: 'p1', columnKey: 'sA', effectiveMinor: 1000 }];
    const r = compareColumnsWithCoupons(items, partial, { sA: 'rA' }, new Map(), 'USD', NOW);
    expect(r[0]!.pricedCount).toBe(1);
    expect(r[0]!.missingCount).toBe(1);
  });
});
