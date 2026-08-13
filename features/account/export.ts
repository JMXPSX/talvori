/**
 * Pure export shaping for the GDPR-style data export (no I/O, unit-tested).
 * `exportApi.ts` fetches the per-household bundles through the existing RLS-
 * scoped readers; this module only assembles and names the result.
 */

import type { MemberWithProfile } from '@/features/household/api';
import type { TransactionWithRefs } from '@/features/finance/api';
import type { PriceWithRefs, RetailerProductWithRetailer, SavedLocationWithStore } from '@/features/retail/api';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import type {
  AccountBalanceRow,
  AccountRow,
  BudgetRow,
  BudgetStatusRow,
  CategoryRow,
  DebtRow,
  DebtStatusRow,
  GroceryItemRow,
  GroceryListRow,
  HouseholdRow,
  LatestFxRateRow,
  ProductRow,
  RetailerRow,
  RetailerStoreRow,
  SavingsGoalRow,
  SavingsGoalStatusRow,
} from '@/lib/database.types';

export interface HouseholdExportBundle {
  household: HouseholdRow;
  members: MemberWithProfile[];
  accounts: AccountRow[];
  balances: AccountBalanceRow[];
  categories: CategoryRow[];
  transactions: TransactionWithRefs[];
  fxRates: LatestFxRateRow[];
  budgets: BudgetRow[];
  budgetStatus: BudgetStatusRow[];
  goals: SavingsGoalRow[];
  goalStatus: SavingsGoalStatusRow[];
  debts: DebtRow[];
  debtStatus: DebtStatusRow[];
  grocery: {
    lists: GroceryListRow[];
    /** Items keyed by their list id. */
    items: Record<string, GroceryItemRow[]>;
  };
  retail: {
    retailers: RetailerRow[];
    stores: RetailerStoreRow[];
    products: ProductRow[];
    retailerProducts?: RetailerProductWithRetailer[];
    prices: PriceWithRefs[];
  };
  coupons: CouponWithRefs[];
  savedLocations: SavedLocationWithStore[];
}

export interface AccountExport {
  exportedAt: string;
  user: { id: string; email: string | null };
  households: HouseholdExportBundle[];
}

/** Assemble the export document. Sorts households by name; does not mutate input. */
export function buildExport(
  user: { id: string; email: string | null },
  bundles: readonly HouseholdExportBundle[],
  exportedAt: string,
): AccountExport {
  return {
    exportedAt,
    user: { id: user.id, email: user.email },
    households: [...bundles].sort((a, b) => a.household.name.localeCompare(b.household.name)),
  };
}

/** `household-export-YYYYMMDD-HHMMSS.json`, derived only from the ISO string. */
export function exportFilename(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  return `household-export-${stamp}.json`;
}
