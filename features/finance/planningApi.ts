/**
 * Data access for budgets, savings goals, and debts. All money crosses as
 * integer minor units. RLS enforces household scoping and writer permissions.
 */

import type {
  BudgetAllocationRow,
  BudgetRow,
  BudgetStatusRow,
  DebtPaymentRow,
  DebtRow,
  DebtStatusRow,
  GoalContributionRow,
  SavingsGoalRow,
  SavingsGoalStatusRow,
} from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// Deletes ride the FK cascades (allocations/contributions/payments go with
// their parent); RLS narrows who may delete.
async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await getSupabase().from(table).delete().eq('id', id);
  if (error) fail('finance.errors.deleteFailed', error);
}

export async function deleteBudget(id: string): Promise<void> {
  return deleteRow('budgets', id);
}

export async function deleteAllocation(id: string): Promise<void> {
  return deleteRow('budget_allocations', id);
}

export async function deleteGoal(id: string): Promise<void> {
  return deleteRow('savings_goals', id);
}

export async function deleteDebt(id: string): Promise<void> {
  return deleteRow('debts', id);
}

// --- budgets ---------------------------------------------------------------
export async function listBudgets(householdId: string): Promise<BudgetRow[]> {
  const { data, error } = await getSupabase()
    .from('budgets')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('period_start', { ascending: false });
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as BudgetRow[];
}

export async function createBudget(
  householdId: string,
  input: { name: string; currencyCode: string; periodStart: string; periodEnd: string },
): Promise<BudgetRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('budgets')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.budgetFailed', error);
  return data as BudgetRow;
}

export async function addAllocation(input: {
  budgetId: string;
  householdId: string;
  categoryId?: string;
  limitMinor: number;
  accountId: string;
}): Promise<BudgetAllocationRow> {
  const { data, error } = await getSupabase()
    .from('budget_allocations')
    .insert({
      budget_id: input.budgetId,
      household_id: input.householdId,
      category_id: input.categoryId ?? null,
      limit_minor: input.limitMinor,
      account_id: input.accountId,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.allocationFailed', error);
  return data as BudgetAllocationRow;
}

export async function listBudgetStatus(budgetId: string): Promise<BudgetStatusRow[]> {
  const { data, error } = await getSupabase()
    .from('budget_status')
    .select('*')
    .eq('budget_id', budgetId);
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as BudgetStatusRow[];
}

// --- savings goals ---------------------------------------------------------
export async function listGoals(householdId: string): Promise<SavingsGoalRow[]> {
  const { data, error } = await getSupabase()
    .from('savings_goals')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as SavingsGoalRow[];
}

export async function listGoalStatus(householdId: string): Promise<SavingsGoalStatusRow[]> {
  const { data, error } = await getSupabase()
    .from('savings_goal_status')
    .select('*')
    .eq('household_id', householdId);
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as SavingsGoalStatusRow[];
}

export async function createGoal(
  householdId: string,
  input: { name: string; currencyCode: string; targetMinor: number; targetDate?: string },
): Promise<SavingsGoalRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('savings_goals')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      target_minor: input.targetMinor,
      target_date: input.targetDate ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.goalFailed', error);
  return data as SavingsGoalRow;
}

export async function addContribution(input: {
  goalId: string;
  householdId: string;
  amountMinor: number;
  note?: string;
}): Promise<GoalContributionRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('goal_contributions')
    .insert({
      goal_id: input.goalId,
      household_id: input.householdId,
      amount_minor: input.amountMinor,
      note: input.note ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.contributeFailed', error);
  return data as GoalContributionRow;
}

// --- debts -----------------------------------------------------------------
export async function listDebts(householdId: string): Promise<DebtRow[]> {
  const { data, error } = await getSupabase()
    .from('debts')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as DebtRow[];
}

export async function listDebtStatus(householdId: string): Promise<DebtStatusRow[]> {
  const { data, error } = await getSupabase()
    .from('debt_status')
    .select('*')
    .eq('household_id', householdId);
  if (error) fail('planning.errors.loadFailed', error);
  return (data ?? []) as DebtStatusRow[];
}

export async function createDebt(
  householdId: string,
  input: {
    name: string;
    currencyCode: string;
    principalMinor: number;
    apr?: number;
    dueDay?: number;
  },
): Promise<DebtRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('debts')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      principal_minor: input.principalMinor,
      apr: input.apr ?? null,
      due_day: input.dueDay ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.debtFailed', error);
  return data as DebtRow;
}

export async function addPayment(input: {
  debtId: string;
  householdId: string;
  amountMinor: number;
  note?: string;
}): Promise<DebtPaymentRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('debt_payments')
    .insert({
      debt_id: input.debtId,
      household_id: input.householdId,
      amount_minor: input.amountMinor,
      note: input.note ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('planning.errors.payFailed', error);
  return data as DebtPaymentRow;
}
