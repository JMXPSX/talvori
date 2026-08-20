/**
 * Pure helpers behind the Plan tab (1b — fixes F01). No I/O; the screen wires
 * these to the planning queries. Kept component-free so it unit-tests under jest.
 */

import { budgetRemainingMinor } from '@/features/finance/progress';
import type { BudgetStatusRow } from '@/lib/database.types';

export type BudgetMeterState = 'normal' | 'full' | 'over';

export interface BudgetAggregate {
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  fraction: number; // 0..1 (unclamped ratio is clamped by the meter)
  state: BudgetMeterState;
}

/** Meter state for a single limit vs spend (shared by the ring and each row). */
export function meterState(limitMinor: number, spentMinor: number): BudgetMeterState {
  const remaining = budgetRemainingMinor(limitMinor, spentMinor);
  if (remaining < 0) return 'over';
  if (remaining === 0 && limitMinor > 0) return 'full';
  return 'normal';
}

/** Spent fraction of a limit; a spend with no limit reads as full. */
export function spentFraction(limitMinor: number, spentMinor: number): number {
  if (limitMinor > 0) return spentMinor / limitMinor;
  return spentMinor > 0 ? 1 : 0;
}

/** Roll a budget's category allocations into one month total. */
export function aggregateBudget(status: ReadonlyArray<BudgetStatusRow>): BudgetAggregate {
  const limitMinor = status.reduce((s, r) => s + r.limit_minor, 0);
  const spentMinor = status.reduce((s, r) => s + r.spent_minor, 0);
  return {
    limitMinor,
    spentMinor,
    remainingMinor: budgetRemainingMinor(limitMinor, spentMinor),
    fraction: spentFraction(limitMinor, spentMinor),
    state: meterState(limitMinor, spentMinor),
  };
}

/** The active budget: the one whose period contains today, else the first. */
export function pickCurrentBudget<T extends { period_start: string; period_end: string }>(
  budgets: ReadonlyArray<T>,
  todayISO: string,
): T | null {
  const today = todayISO.slice(0, 10);
  const inRange = budgets.find((b) => b.period_start <= today && today <= b.period_end);
  return inRange ?? budgets[0] ?? null;
}

/** Whole days from today to the period end (never negative). */
export function daysRemaining(periodEndISO: string, todayISO: string): number {
  const end = Date.parse(`${periodEndISO.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${todayISO.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(end) || Number.isNaN(today)) return 0;
  return Math.max(0, Math.round((end - today) / 86_400_000));
}

/** Even daily allowance for the remaining budget; null when there's none/no time. */
export function safeToSpendPerDayMinor(remainingMinor: number, days: number): number | null {
  if (remainingMinor <= 0 || days <= 0) return null;
  return Math.floor(remainingMinor / days);
}
