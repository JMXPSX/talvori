/**
 * Bills data access (§6.10). RLS-protected; the DB forces each bill's currency to
 * follow its funding account. "Mark paid" records a real transaction on that
 * account and advances the schedule — there is no background job.
 */

import { advanceDueDate } from '@/features/bills/recurrence';
import type { BillFormInput } from '@/features/bills/schemas';
import { createEntry } from '@/features/finance/api';
import type { BillRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { toMinorUnits } from '@/lib/money';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

export async function listBills(householdId: string): Promise<BillRow[]> {
  const { data, error } = await getSupabase()
    .from('bills')
    .select('*')
    .eq('household_id', householdId)
    .order('next_due_date', { ascending: true });
  if (error) fail('bills.errors.loadFailed', error);
  return (data ?? []) as BillRow[];
}

/** `currencyCode` is the funding account's currency — used to convert the major
 *  amount. The DB trigger re-derives the stored currency from the account too. */
export async function createBill(
  householdId: string,
  input: BillFormInput,
  currencyCode: string,
): Promise<BillRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('bills')
    .insert({
      household_id: householdId,
      name: input.name,
      direction: input.direction,
      amount_minor: toMinorUnits(input.amountMajor, currencyCode),
      frequency: input.frequency,
      next_due_date: input.nextDueDate,
      account_id: input.accountId,
      category_id: input.categoryId ?? null,
      notes: input.notes ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('bills.errors.saveFailed', error);
  return data as BillRow;
}

export async function updateBill(
  id: string,
  input: BillFormInput,
  currencyCode: string,
): Promise<BillRow> {
  const { data, error } = await getSupabase()
    .from('bills')
    .update({
      name: input.name,
      direction: input.direction,
      amount_minor: toMinorUnits(input.amountMajor, currencyCode),
      frequency: input.frequency,
      next_due_date: input.nextDueDate,
      account_id: input.accountId,
      category_id: input.categoryId ?? null,
      notes: input.notes ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('bills.errors.saveFailed', error);
  return data as BillRow;
}

/** Pause / resume a bill without deleting it. */
export async function setBillActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabase().from('bills').update({ is_active: isActive }).eq('id', id);
  if (error) fail('bills.errors.saveFailed', error);
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await getSupabase().from('bills').delete().eq('id', id);
  if (error) fail('bills.errors.deleteFailed', error);
}

/**
 * Record this cycle's payment as a transaction on the bill's account, then move
 * the due date forward one cycle. Two steps, not atomic: if the date bump fails
 * after the transaction posts, the payment still stands and can be re-marked.
 */
export async function markBillPaid(bill: BillRow): Promise<BillRow> {
  await createEntry({
    householdId: bill.household_id,
    accountId: bill.account_id,
    type: bill.direction === 'in' ? 'income' : 'expense',
    amountMinor: bill.amount_minor,
    currencyCode: bill.currency_code,
    categoryId: bill.category_id ?? undefined,
    description: bill.name,
  });
  const next = advanceDueDate(bill.next_due_date, bill.frequency);
  const { data, error } = await getSupabase()
    .from('bills')
    .update({ next_due_date: next })
    .eq('id', bill.id)
    .select('*')
    .single();
  if (error) fail('bills.errors.saveFailed', error);
  return data as BillRow;
}
