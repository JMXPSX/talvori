/**
 * Grocery data access. Household scoping + writer/viewer permission are enforced
 * by RLS; realtime subscriptions stream row changes (RLS still applies per row).
 * All money crosses this boundary as integer minor units in the list currency.
 */

import type { GroceryItemRow, GroceryListRow } from '@/lib/database.types';
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

// --- lists -----------------------------------------------------------------
export async function listLists(householdId: string): Promise<GroceryListRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('household_id', householdId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryListRow[];
}

export async function getList(id: string): Promise<GroceryListRow | null> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? null) as GroceryListRow | null;
}

export async function createList(
  householdId: string,
  input: { name: string; currencyCode: string },
): Promise<GroceryListRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.listFailed', error);
  return data as GroceryListRow;
}

export async function archiveList(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_lists')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) fail('grocery.errors.saveFailed', error);
}

// --- items -----------------------------------------------------------------
export async function listItems(listId: string): Promise<GroceryItemRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryItemRow[];
}

export async function addItem(
  listId: string,
  input: { name: string; quantity: number; unit?: string; estimatedPriceMinor?: number },
): Promise<GroceryItemRow> {
  const addedBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_items')
    // household_id is set by the grocery_items_enforce_list trigger.
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000',
      name: input.name,
      quantity: input.quantity,
      unit: input.unit ?? null,
      estimated_price_minor: input.estimatedPriceMinor ?? null,
      added_by: addedBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.itemFailed', error);
  return data as GroceryItemRow;
}

export async function updateItem(
  id: string,
  patch: Partial<{
    name: string;
    quantity: number;
    unit: string | null;
    estimatedPriceMinor: number | null;
    actualPriceMinor: number | null;
    isPurchased: boolean;
  }>,
): Promise<GroceryItemRow> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.estimatedPriceMinor !== undefined) row.estimated_price_minor = patch.estimatedPriceMinor;
  if (patch.actualPriceMinor !== undefined) row.actual_price_minor = patch.actualPriceMinor;
  if (patch.isPurchased !== undefined) row.is_purchased = patch.isPurchased;

  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

/** Toggle purchased state, stamping purchaser + optional actual price. */
export async function setPurchased(
  id: string,
  isPurchased: boolean,
  actualPriceMinor?: number,
): Promise<GroceryItemRow> {
  const purchasedBy = isPurchased ? await currentUserId() : null;
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update({
      is_purchased: isPurchased,
      purchased_by: purchasedBy,
      purchased_at: isPurchased ? new Date().toISOString() : null,
      ...(actualPriceMinor !== undefined ? { actual_price_minor: actualPriceMinor } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('grocery_items').delete().eq('id', id);
  if (error) fail('grocery.errors.deleteFailed', error);
}

/** Delete a list and (via FK cascade) its items. RLS narrows to owner/admin. */
export async function deleteList(id: string): Promise<void> {
  const { error } = await getSupabase().from('grocery_lists').delete().eq('id', id);
  if (error) fail('grocery.errors.deleteFailed', error);
}

/**
 * Complete a trip → ONE expense; returns its tx id (§6.8 Record purchase).
 * `store` names the expense; `actualTotalMinor` overrides the item sum when the
 * shopper enters a different total actually paid (migration 16).
 */
export async function completeList(
  listId: string,
  accountId: string,
  categoryId?: string,
  store?: string,
  actualTotalMinor?: number,
  /** false = post the expense but keep the list active (Shop's evergreen list). */
  complete = true,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accountId,
    _category_id: categoryId ?? null,
    _store: store?.trim() || null,
    _actual_total_minor: actualTotalMinor ?? null,
    _complete: complete,
  });
  if (error) fail('grocery.errors.checkoutFailed', error);
  return data as string;
}

/** Last unit price paid per item name — seeds Buy-again + estimates (§6.8). */
export interface PriceHistoryEntry {
  name: string;
  unit_price_minor: number;
  currency_code: string;
}
export async function listPriceHistory(householdId: string): Promise<PriceHistoryEntry[]> {
  const { data, error } = await getSupabase().rpc('grocery_price_history', {
    _household_id: householdId,
  });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as PriceHistoryEntry[];
}

/** Recent store names for the finish-trip store chips (§6.8). */
export async function listRecentStores(householdId: string): Promise<string[]> {
  const { data, error } = await getSupabase().rpc('grocery_recent_stores', {
    _household_id: householdId,
  });
  if (error) fail('grocery.errors.loadFailed', error);
  return ((data ?? []) as { store: string }[]).map((r) => r.store);
}

/** Link (or clear) the catalog product a list item refers to. */
export async function setGroceryItemProduct(
  itemId: string,
  productId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_items')
    .update({ product_id: productId })
    .eq('id', itemId);
  if (error) fail('grocery.errors.saveFailed', error);
}

// --- realtime --------------------------------------------------------------
/** Subscribe to any list change in a household. Returns an unsubscribe fn. */
export function subscribeToLists(householdId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_lists:${householdId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_lists', filter: `household_id=eq.${householdId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}

/** Subscribe to item changes within one list. Returns an unsubscribe fn. */
export function subscribeToItems(listId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_items:${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
