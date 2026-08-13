/**
 * Finance data access. All money crosses this boundary as integer minor units.
 * RLS enforces household scoping and writer-vs-viewer permissions; transfers go
 * through the atomic create_transfer RPC.
 */

import type {
  AccountBalanceRow,
  AccountRow,
  AccountType,
  CategoryKind,
  CategoryRow,
  FlowDirection,
  TransactionRow,
} from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

/** Transaction row with its account + category embedded for display. */
export interface TransactionWithRefs extends TransactionRow {
  account: Pick<AccountRow, 'id' | 'name' | 'currency_code'> | null;
  category: Pick<CategoryRow, 'id' | 'name'> | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// --- accounts --------------------------------------------------------------
export async function listAccounts(householdId: string): Promise<AccountRow[]> {
  const { data, error } = await getSupabase()
    .from('accounts')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('name', { ascending: true });
  if (error) fail('finance.errors.loadFailed', error);
  return (data ?? []) as AccountRow[];
}

export async function listAccountBalances(householdId: string): Promise<AccountBalanceRow[]> {
  const { data, error } = await getSupabase()
    .from('account_balances')
    .select('*')
    .eq('household_id', householdId);
  if (error) fail('finance.errors.loadFailed', error);
  return (data ?? []) as AccountBalanceRow[];
}

export async function createAccount(
  householdId: string,
  input: { name: string; type: AccountType; currencyCode: string; openingBalanceMinor: number },
): Promise<AccountRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('accounts')
    .insert({
      household_id: householdId,
      name: input.name,
      type: input.type,
      currency_code: input.currencyCode,
      opening_balance_minor: input.openingBalanceMinor,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('finance.errors.accountFailed', error);
  return data as AccountRow;
}

// --- categories ------------------------------------------------------------
export async function listCategories(
  householdId: string,
  kind?: CategoryKind,
): Promise<CategoryRow[]> {
  let query = getSupabase()
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) fail('finance.errors.loadFailed', error);
  return (data ?? []) as CategoryRow[];
}

export async function createCategory(
  householdId: string,
  input: { name: string; kind: CategoryKind },
): Promise<CategoryRow> {
  const { data, error } = await getSupabase()
    .from('categories')
    .insert({ household_id: householdId, name: input.name, kind: input.kind })
    .select('*')
    .single();
  if (error) fail('finance.errors.categoryFailed', error);
  return data as CategoryRow;
}

// --- transactions ----------------------------------------------------------
export async function listTransactions(
  householdId: string,
  limit = 50,
): Promise<TransactionWithRefs[]> {
  const { data, error } = await getSupabase()
    .from('transactions')
    .select('*, account:accounts(id,name,currency_code), category:categories(id,name)')
    .eq('household_id', householdId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) fail('finance.errors.loadFailed', error);
  return (data ?? []) as unknown as TransactionWithRefs[];
}

/** Record a single income or expense (transfers use createTransfer). */
export async function createEntry(input: {
  householdId: string;
  accountId: string;
  type: 'income' | 'expense';
  amountMinor: number;
  currencyCode: string;
  categoryId?: string;
  description?: string;
  occurredAt?: string;
}): Promise<TransactionRow> {
  const createdBy = await currentUserId();
  const direction: FlowDirection = input.type === 'income' ? 'in' : 'out';
  const { data, error } = await getSupabase()
    .from('transactions')
    .insert({
      household_id: input.householdId,
      account_id: input.accountId,
      type: input.type,
      direction,
      amount_minor: input.amountMinor,
      currency_code: input.currencyCode,
      category_id: input.categoryId ?? null,
      description: input.description ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('finance.errors.entryFailed', error);
  return data as TransactionRow;
}

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  fromAmountMinor: number;
  toAmountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_transfer', {
    _from_account: input.fromAccountId,
    _to_account: input.toAccountId,
    _from_amount_minor: input.fromAmountMinor,
    _to_amount_minor: input.toAmountMinor,
    _description: input.description ?? null,
    _occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
  if (error) fail('finance.errors.transferFailed', error);
  return data as string;
}

/** Delete an account and (via FK cascade) every transaction on it. RLS: owner/admin. */
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await getSupabase().from('accounts').delete().eq('id', id);
  if (error) fail('finance.errors.deleteFailed', error);
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await getSupabase().from('transactions').delete().eq('id', id);
  if (error) fail('finance.errors.deleteFailed', error);
}
