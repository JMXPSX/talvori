/** Month In/Out/Net for the Activity summary — FX-consolidated, transfers excluded. */

import { monthFlow, type FlowTxn } from '@/features/finance/flow';

const tx = (over: Partial<FlowTxn>): FlowTxn => ({
  type: 'expense',
  direction: 'out',
  amount_minor: 1000,
  currency_code: 'USD',
  occurred_at: '2026-08-10T00:00:00Z',
  ...over,
});

// 1 EUR = 1.1 USD; nothing else has a rate.
const rateFor = (from: string, to: string): number | null =>
  from === 'EUR' && to === 'USD' ? 1.1 : null;

describe('monthFlow', () => {
  it('sums income as In, expense/goal/debt as Out, and derives Net', () => {
    const r = monthFlow(
      [
        tx({ type: 'income', direction: 'in', amount_minor: 240000 }),
        tx({ type: 'expense', direction: 'out', amount_minor: 8640 }),
        tx({ type: 'goal_contribution', direction: 'out', amount_minor: 5000 }),
        tx({ type: 'debt_payment', direction: 'out', amount_minor: 4500 }),
      ],
      '2026-08',
      'USD',
      rateFor,
    );
    expect(r).toEqual({ inMinor: 240000, outMinor: 18140, netMinor: 221860, missing: [] });
  });

  it('excludes transfers (both legs) from In/Out/Net', () => {
    const r = monthFlow(
      [
        tx({ type: 'transfer', direction: 'out', amount_minor: 50000 }),
        tx({ type: 'transfer', direction: 'in', amount_minor: 50000 }),
        tx({ type: 'income', direction: 'in', amount_minor: 10000 }),
      ],
      '2026-08',
      'USD',
      rateFor,
    );
    expect(r).toMatchObject({ inMinor: 10000, outMinor: 0, netMinor: 10000 });
  });

  it('ignores other months', () => {
    const r = monthFlow(
      [
        tx({ type: 'income', direction: 'in', amount_minor: 5000 }),
        tx({ type: 'income', direction: 'in', amount_minor: 9999, occurred_at: '2026-07-31T23:00:00Z' }),
      ],
      '2026-08',
      'USD',
      rateFor,
    );
    expect(r.inMinor).toBe(5000);
  });

  it('converts foreign flows and flags currencies with no rate', () => {
    const r = monthFlow(
      [
        tx({ type: 'income', direction: 'in', currency_code: 'EUR', amount_minor: 10000 }), // 100 * 1.1 = 110.00
        tx({ type: 'expense', direction: 'out', currency_code: 'PHP', amount_minor: 500000 }), // no rate → missing
      ],
      '2026-08',
      'USD',
      rateFor,
    );
    expect(r.inMinor).toBe(11000);
    expect(r.outMinor).toBe(0);
    expect(r.missing).toEqual(['PHP']);
  });
});
