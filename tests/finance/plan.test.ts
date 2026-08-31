/** Pure helpers behind the Plan tab (1b / F01). */

import {
  aggregateBudget,
  daysRemaining,
  meterState,
  pickCurrentBudget,
  safeToSpendPerDayMinor,
  spentFraction,
} from '@/features/finance/plan';
import type { BudgetStatusRow } from '@/lib/database.types';

const row = (limit: number, spent: number): BudgetStatusRow => ({
  allocation_id: 'a',
  budget_id: 'b',
  household_id: 'h',
  category_id: null,
  currency_code: 'PHP',
  limit_minor: limit,
  spent_minor: spent,
  account_id: null,
});

describe('meterState / spentFraction', () => {
  it('flags normal, full, and over', () => {
    expect(meterState(10000, 5000)).toBe('normal');
    expect(meterState(10000, 10000)).toBe('full');
    expect(meterState(10000, 12000)).toBe('over');
  });
  it('treats spend with no limit as full fraction', () => {
    expect(spentFraction(0, 500)).toBe(1);
    expect(spentFraction(0, 0)).toBe(0);
    expect(spentFraction(10000, 2500)).toBe(0.25);
  });
});

describe('aggregateBudget', () => {
  it('rolls allocations into one month total', () => {
    const agg = aggregateBudget([row(10000, 4000), row(5000, 6000)]);
    expect(agg.limitMinor).toBe(15000);
    expect(agg.spentMinor).toBe(10000);
    expect(agg.remainingMinor).toBe(5000);
    expect(agg.state).toBe('normal');
  });
});

describe('pickCurrentBudget', () => {
  const budgets = [
    { period_start: '2026-07-01', period_end: '2026-07-31' },
    { period_start: '2026-08-01', period_end: '2026-08-31' },
  ];
  it('prefers the budget whose period contains today', () => {
    expect(pickCurrentBudget(budgets, '2026-08-20T10:00:00Z')?.period_start).toBe('2026-08-01');
  });
  it('falls back to the first budget when none matches', () => {
    expect(pickCurrentBudget(budgets, '2026-09-10T00:00:00Z')?.period_start).toBe('2026-07-01');
    expect(pickCurrentBudget([], '2026-08-20T00:00:00Z')).toBeNull();
  });
});

describe('daysRemaining / safeToSpendPerDayMinor', () => {
  it('counts whole days to the period end', () => {
    expect(daysRemaining('2026-08-31', '2026-08-20T09:00:00Z')).toBe(11);
    expect(daysRemaining('2026-08-01', '2026-08-20T00:00:00Z')).toBe(0);
  });
  it('splits the remaining budget across the days left', () => {
    expect(safeToSpendPerDayMinor(11000, 11)).toBe(1000);
    expect(safeToSpendPerDayMinor(0, 11)).toBeNull();
    expect(safeToSpendPerDayMinor(5000, 0)).toBeNull();
  });
});
