/** Budget/goal/debt progress math (integer minor units). */

import {
  budgetRemainingMinor,
  goalRemainingMinor,
  progressRatio,
} from '@/features/finance/progress';

describe('budgetRemainingMinor', () => {
  it('is limit minus spent and can go negative when overspent', () => {
    expect(budgetRemainingMinor(50000, 20000)).toBe(30000);
    expect(budgetRemainingMinor(50000, 65000)).toBe(-15000);
  });
});

describe('goalRemainingMinor', () => {
  it('never drops below zero', () => {
    expect(goalRemainingMinor(100000, 40000)).toBe(60000);
    expect(goalRemainingMinor(100000, 120000)).toBe(0);
  });
});

describe('progressRatio', () => {
  it('clamps to [0, 1]', () => {
    expect(progressRatio(0, 100)).toBe(0);
    expect(progressRatio(50, 100)).toBe(0.5);
    expect(progressRatio(150, 100)).toBe(1);
  });

  it('returns 1 for a zero or negative target (nothing to do)', () => {
    expect(progressRatio(0, 0)).toBe(1);
  });
});
