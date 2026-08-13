/**
 * Export assembly (I/O). Loops every household the user belongs to and reads
 * it through the existing feature APIs — RLS is the scope boundary, so the
 * export can never contain more than the user can already see in the app.
 */

import { buildExport, type AccountExport, type HouseholdExportBundle } from '@/features/account/export';
import { listAccountBalances, listAccounts, listCategories, listTransactions } from '@/features/finance/api';
import { listLatestRates } from '@/features/finance/fxApi';
import {
  listBudgetStatus,
  listBudgets,
  listDebtStatus,
  listDebts,
  listGoalStatus,
  listGoals,
} from '@/features/finance/planningApi';
import { listItems, listLists } from '@/features/grocery/api';
import { listMembers, listMyHouseholds } from '@/features/household/api';
import {
  listPricesForProduct,
  listProducts,
  listRetailers,
  listSavedLocations,
  listStores,
} from '@/features/retail/api';
import type { PriceWithRefs } from '@/features/retail/api';
import { listCoupons } from '@/features/retail/couponApi';
import type { GroceryItemRow, RetailerStoreRow } from '@/lib/database.types';

/** High enough to cover full history at current scale; revisit with pagination. */
const EXPORT_TRANSACTION_LIMIT = 10000;

async function bundleHousehold(householdId: string): Promise<HouseholdExportBundle> {
  const [household, members, accounts, balances, categories, transactions, fxRates] =
    await Promise.all([
      listMyHouseholds().then((hs) => hs.find((h) => h.id === householdId)),
      listMembers(householdId),
      listAccounts(householdId),
      listAccountBalances(householdId),
      listCategories(householdId),
      listTransactions(householdId, EXPORT_TRANSACTION_LIMIT),
      listLatestRates(householdId),
    ]);
  if (!household) throw new Error(`household ${householdId} not readable`);

  const [budgets, goals, debts, groceryLists, retailers, products, coupons, savedLocations] =
    await Promise.all([
      listBudgets(householdId),
      listGoals(householdId),
      listDebts(householdId),
      listLists(householdId),
      listRetailers(householdId),
      listProducts(householdId),
      listCoupons(householdId),
      listSavedLocations(householdId),
    ]);

  const [budgetStatus, goalStatus, debtStatus] = await Promise.all([
    Promise.all(budgets.map((b) => listBudgetStatus(b.id))).then((r) => r.flat()),
    listGoalStatus(householdId),
    listDebtStatus(householdId),
  ]);

  const itemsPerList = await Promise.all(groceryLists.map((l) => listItems(l.id)));
  const items: Record<string, GroceryItemRow[]> = {};
  groceryLists.forEach((l, i) => {
    items[l.id] = itemsPerList[i] ?? [];
  });

  const stores: RetailerStoreRow[] = (
    await Promise.all(retailers.map((r) => listStores(r.id)))
  ).flat();
  const prices: PriceWithRefs[] = (
    await Promise.all(products.map((p) => listPricesForProduct(p.id)))
  ).flat();

  return {
    household,
    members,
    accounts,
    balances,
    categories,
    transactions,
    fxRates,
    budgets,
    budgetStatus,
    goals,
    goalStatus,
    debts,
    debtStatus,
    grocery: { lists: groceryLists, items },
    retail: { retailers, stores, products, prices },
    coupons,
    savedLocations,
  };
}

/** Assemble the full export for the signed-in user. */
export async function assembleExport(
  user: { id: string; email: string | null },
  exportedAt: string,
): Promise<AccountExport> {
  const households = await listMyHouseholds();
  const bundles = await Promise.all(households.map((h) => bundleHousehold(h.id)));
  return buildExport(user, bundles, exportedAt);
}
