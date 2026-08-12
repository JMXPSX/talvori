/**
 * Pure progress math for budgets / goals / debts, in integer minor units.
 * No I/O — unit-testable and reusable for UI meters.
 */

/** Remaining budget for an allocation (can go negative when overspent). */
export function budgetRemainingMinor(limitMinor: number, spentMinor: number): number {
  return limitMinor - spentMinor;
}

/** Remaining amount to reach a savings target (never below zero). */
export function goalRemainingMinor(targetMinor: number, savedMinor: number): number {
  return Math.max(0, targetMinor - savedMinor);
}

/**
 * Progress ratio in [0, 1] given a current and target amount in minor units.
 * Returns 1 when the target is 0 (nothing left to do) to avoid divide-by-zero.
 */
export function progressRatio(currentMinor: number, targetMinor: number): number {
  if (targetMinor <= 0) return 1;
  return Math.min(1, Math.max(0, currentMinor / targetMinor));
}
