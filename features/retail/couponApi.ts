/**
 * Coupon data access. Household scoping + writer/viewer permission via RLS.
 * Amounts cross this boundary as integer minor units (screen converts from major).
 */

import type { CouponRow, RetailerProductRow, RetailerRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { listRetailerProducts } from '@/features/retail/api';

export interface CouponWithRefs extends CouponRow {
  retailer: Pick<RetailerRow, 'id' | 'name'> | null;
  retailer_product: Pick<RetailerProductRow, 'id' | 'display_name'> | null;
}

/** Minor-unit coupon input assembled by the screen (major->minor already done). */
export interface CreateCouponData {
  retailerId: string;
  retailerProductId?: string;
  title: string;
  code?: string;
  sourceUrl?: string;
  discountType: 'fixed' | 'percent';
  discountAmountMinor?: number;
  discountPercent?: number;
  currencyCode?: string;
  minPurchaseMinor?: number;
  maxDiscountMinor?: number;
  expiresAt?: string;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}
async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

const SELECT =
  '*, retailer:retailers(id,name), retailer_product:retailer_products(id,display_name)';

export async function listCoupons(hid: string): Promise<CouponWithRefs[]> {
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .eq('household_id', hid)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  return (data ?? []) as unknown as CouponWithRefs[];
}

/**
 * Coupons applicable to a product: those scoped to any of the product's
 * retailer_products, OR retailer-wide (null retailer_product_id) for any retailer
 * the product is sold at. Fetched by retailer, filtered in JS to avoid fragile
 * PostgREST `or()` strings.
 */
export async function listCouponsForProduct(productId: string): Promise<CouponWithRefs[]> {
  const rps = await listRetailerProducts(productId);
  if (rps.length === 0) return [];
  const retailerIds = Array.from(new Set(rps.map((r) => r.retailer_id)));
  const rpIds = new Set(rps.map((r) => r.id));
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .in('retailer_id', retailerIds)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  const rows = (data ?? []) as unknown as CouponWithRefs[];
  return rows.filter(
    (c) => c.retailer_product_id == null || rpIds.has(c.retailer_product_id),
  );
}

export async function createCoupon(hid: string, data: CreateCouponData): Promise<CouponRow> {
  const created_by = await currentUserId();
  const { data: row, error } = await getSupabase()
    .from('coupons')
    .insert({
      household_id: hid,
      retailer_id: data.retailerId,
      retailer_product_id: data.retailerProductId ?? null,
      title: data.title,
      code: data.code ?? null,
      source_url: data.sourceUrl ?? null,
      discount_type: data.discountType,
      discount_amount_minor: data.discountAmountMinor ?? null,
      discount_percent: data.discountPercent ?? null,
      currency_code: data.currencyCode ?? null,
      min_purchase_minor: data.minPurchaseMinor ?? null,
      max_discount_minor: data.maxDiscountMinor ?? null,
      expires_at: data.expiresAt ?? null,
      created_by,
    })
    .select('*')
    .single();
  if (error) fail('coupons.errors.saveFailed', error);
  return row as CouponRow;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await getSupabase().from('coupons').delete().eq('id', id);
  if (error) fail('coupons.errors.deleteFailed', error);
}
