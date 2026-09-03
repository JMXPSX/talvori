/** Recurrence math for bills (§6.10). */

import { advanceDueDate, isOverdue } from '@/features/bills/recurrence';

describe('advanceDueDate', () => {
  it('adds 7 days weekly, rolling the month', () => {
    expect(advanceDueDate('2026-01-28', 'weekly')).toBe('2026-02-04');
  });

  it('adds a month, rolling the year', () => {
    expect(advanceDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('clamps the day to the target month (Jan 31 → Feb 28)', () => {
    expect(advanceDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('adds a year, clamping Feb 29 to Feb 28 in a non-leap year', () => {
    expect(advanceDueDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  it('adds a plain year', () => {
    expect(advanceDueDate('2026-06-10', 'yearly')).toBe('2027-06-10');
  });
});

describe('isOverdue', () => {
  it('is true only strictly before today', () => {
    expect(isOverdue('2026-09-01', '2026-09-03')).toBe(true);
    expect(isOverdue('2026-09-03', '2026-09-03')).toBe(false);
    expect(isOverdue('2026-09-05', '2026-09-03')).toBe(false);
  });
});
