/** Month-scoped, FX-correct spending insights (2d / F24). */

import { insightsForMonth, monthKeyOf, type InsightTxn } from '@/features/finance/insights';

const tx = (over: Partial<InsightTxn>): InsightTxn => ({
  type: 'expense',
  amount_minor: 1000,
  currency_code: 'PHP',
  occurred_at: '2026-08-10T00:00:00Z',
  category_id: null,
  ...over,
});

// 1 SAR = 15 PHP; everything else has no rate.
const rateFor = (from: string, to: string): number | null =>
  from === 'SAR' && to === 'PHP' ? 15 : null;

describe('monthKeyOf', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKeyOf('2026-08-10T09:30:00Z')).toBe('2026-08');
  });
});

describe('insightsForMonth', () => {
  it('sums only expenses in the given month, in reporting currency', () => {
    const r = insightsForMonth(
      [
        tx({ amount_minor: 5000, category_id: 'food' }),
        tx({ amount_minor: 3000, category_id: 'food' }),
        tx({ amount_minor: 2000, category_id: 'rent' }),
        tx({ type: 'income', amount_minor: 9999 }), // ignored (not expense)
        tx({ occurred_at: '2026-07-31T00:00:00Z', amount_minor: 7777 }), // other month
      ],
      '2026-08',
      'PHP',
      rateFor,
    );
    expect(r.totalSpentMinor).toBe(10000);
    expect(r.count).toBe(3);
    expect(r.byCategory[0]).toEqual({ categoryId: 'food', amountMinor: 8000 });
    expect(r.byCategory[1]).toEqual({ categoryId: 'rent', amountMinor: 2000 });
    expect(r.missing).toEqual([]);
  });

  it('converts foreign expenses and flags currencies with no rate', () => {
    const r = insightsForMonth(
      [
        tx({ currency_code: 'SAR', amount_minor: 100, category_id: 'food' }), // 100*15 = 1500
        tx({ currency_code: 'USD', amount_minor: 500 }), // no rate → missing
      ],
      '2026-08',
      'PHP',
      rateFor,
    );
    expect(r.totalSpentMinor).toBe(1500);
    expect(r.count).toBe(2); // both counted as transactions...
    expect(r.missing).toEqual(['USD']); // ...but USD excluded from the total
  });
});
