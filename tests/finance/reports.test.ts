/** Range-scoped, FX-correct reporting (Reports screen). */

import {
  presetRange,
  reportForRange,
  type ReportTxn,
} from '@/features/finance/reports';

const tx = (over: Partial<ReportTxn>): ReportTxn => ({
  type: 'expense',
  direction: 'out',
  amount_minor: 1000,
  currency_code: 'PHP',
  occurred_at: '2026-08-10T00:00:00Z',
  category_id: null,
  ...over,
});

// 1 SAR = 15 PHP; everything else has no rate.
const rateFor = (from: string, to: string): number | null =>
  from === 'SAR' && to === 'PHP' ? 15 : null;

describe('presetRange', () => {
  const today = '2026-08-10T12:00:00Z';

  it('this-month spans the 1st to today', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-08-01', to: '2026-08-10' });
  });

  it('last-month spans the whole prior month', () => {
    expect(presetRange('last-month', today)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('last-month rolls the year back at January', () => {
    expect(presetRange('last-month', '2026-01-05T00:00:00Z')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('last-3-months starts two months back on the 1st', () => {
    expect(presetRange('last-3-months', today)).toEqual({ from: '2026-06-01', to: '2026-08-10' });
  });

  it('ytd starts on Jan 1', () => {
    expect(presetRange('ytd', today)).toEqual({ from: '2026-01-01', to: '2026-08-10' });
  });
});

describe('reportForRange', () => {
  const range = { from: '2026-08-01', to: '2026-08-31' };

  it('sums in/out/net and category spend within the range', () => {
    const r = reportForRange(
      [
        tx({ amount_minor: 5000, category_id: 'food' }),
        tx({ amount_minor: 3000, category_id: 'food' }),
        tx({ type: 'income', direction: 'in', amount_minor: 20000, category_id: null }),
        tx({ occurred_at: '2026-07-31T00:00:00Z', amount_minor: 9999 }), // out of range
      ],
      range,
      'PHP',
      rateFor,
    );
    expect(r.inMinor).toBe(20000);
    expect(r.outMinor).toBe(8000);
    expect(r.netMinor).toBe(12000);
    expect(r.count).toBe(3);
    expect(r.byCategory).toEqual([{ categoryId: 'food', amountMinor: 8000 }]);
  });

  it('excludes transfers and converts foreign currency via the rate', () => {
    const r = reportForRange(
      [
        tx({ type: 'transfer', direction: 'out', amount_minor: 5000 }),
        tx({ currency_code: 'SAR', amount_minor: 100, category_id: 'food' }), // 100 SAR → 1500 PHP
      ],
      range,
      'PHP',
      rateFor,
    );
    expect(r.outMinor).toBe(1500);
    expect(r.count).toBe(1);
  });

  it('surfaces currencies with no rate instead of counting them as zero', () => {
    const r = reportForRange(
      [tx({ currency_code: 'USD', amount_minor: 5000 })],
      range,
      'PHP',
      rateFor,
    );
    expect(r.outMinor).toBe(0);
    expect(r.count).toBe(0);
    expect(r.missing).toEqual(['USD']);
  });
});
