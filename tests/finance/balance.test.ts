/** Balance math tests — mirrors the account_balances SQL view. Integer minor
 *  units only; income adds, expense/out subtracts. */

import { computeBalanceMinor, signedMinor } from '@/features/finance/balance';

describe('signedMinor', () => {
  it('income (in) is positive, expense (out) is negative', () => {
    expect(signedMinor('in', 2599)).toBe(2599);
    expect(signedMinor('out', 2599)).toBe(-2599);
  });
});

describe('computeBalanceMinor', () => {
  it('returns the opening balance when there are no entries', () => {
    expect(computeBalanceMinor(10000, [])).toBe(10000);
  });

  it('adds income and subtracts expense', () => {
    const entries = [
      { direction: 'in' as const, amount_minor: 5000 }, // +50.00
      { direction: 'out' as const, amount_minor: 1299 }, // -12.99
      { direction: 'out' as const, amount_minor: 701 }, // -7.01
    ];
    expect(computeBalanceMinor(0, entries)).toBe(3000); // 30.00
  });

  it('handles transfer legs (out on source, in on destination)', () => {
    const source = [{ direction: 'out' as const, amount_minor: 2500 }];
    const dest = [{ direction: 'in' as const, amount_minor: 2500 }];
    expect(computeBalanceMinor(10000, source)).toBe(7500);
    expect(computeBalanceMinor(0, dest)).toBe(2500);
  });

  it('stays exact — no floating point drift', () => {
    const entries = Array.from({ length: 3 }, () => ({ direction: 'out' as const, amount_minor: 10 }));
    // 0.10 * 3 in float is 0.30000000000000004; in minor units it's exact.
    expect(computeBalanceMinor(100, entries)).toBe(70);
  });
});
