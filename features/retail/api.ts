/**
 * Retail data access. Household scoping + writer/viewer permission are enforced
 * by RLS. Prices cross this boundary as integer minor units in the store currency.
 */

import type {
  PriceSnapshotRow,
  ProductRow,
  RetailerDirectoryRow,
  RetailerProductRow,
  RetailerRow,
  RetailerStoreRow,
  SavedLocationRow,
} from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { computeRetailerStats, type RetailerStat } from '@/features/retail/retailerStats';
import type {
  CreateProductInput,
  CreateRetailerInput,
  CreateRetailerProductInput,
  CreateSavedLocationInput,
  CreateStoreInput,
} from '@/features/retail/schemas';

export interface RetailerProductWithRetailer extends RetailerProductRow {
  retailer: Pick<RetailerRow, 'id' | 'name'> | null;
}
export interface PriceWithRefs extends PriceSnapshotRow {
  retailer_product:
    | (Pick<RetailerProductRow, 'id' | 'display_name'> & {
        retailer: Pick<RetailerRow, 'id' | 'name'> | null;
      })
    | null;
  store: Pick<RetailerStoreRow, 'id' | 'name' | 'currency_code' | 'latitude' | 'longitude'> | null;
}
export interface SavedLocationWithStore extends SavedLocationRow {
  store:
    | (Pick<RetailerStoreRow, 'id' | 'name' | 'latitude' | 'longitude'> & {
        retailer: Pick<RetailerRow, 'id' | 'name'> | null;
      })
    | null;
}

/** Price snapshot with already-converted minor amounts (screen boundary). */
export interface CreatePriceMinorInput {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  source?: string;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}
async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// --- retailer directory (5a) -----------------------------------------------
/**
 * Seeded, global retailer directory for a country. Read-only reference data.
 * Returns [] (not an error) when the table isn't present yet — so the add-retailer
 * screen degrades gracefully to manual entry until the 5a migration is applied.
 */
export async function listRetailerDirectory(countryCode: string): Promise<RetailerDirectoryRow[]> {
  const { data, error } = await getSupabase()
    .from('retailer_directory')
    .select('*')
    .eq('country_code', countryCode.toUpperCase())
    .order('name');
  if (error) return [];
  return (data ?? []) as RetailerDirectoryRow[];
}

// --- retailers -------------------------------------------------------------
export async function listRetailers(hid: string): Promise<RetailerRow[]> {
  const { data, error } = await getSupabase()
    .from('retailers').select('*').eq('household_id', hid).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as RetailerRow[];
}
export async function getRetailer(id: string): Promise<RetailerRow | null> {
  const { data, error } = await getSupabase()
    .from('retailers').select('*').eq('id', id).maybeSingle();
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? null) as RetailerRow | null;
}
export async function createRetailer(hid: string, input: CreateRetailerInput): Promise<RetailerRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailers').insert({
    household_id: hid, name: input.name, country_code: input.countryCode ?? null,
    website: input.website ?? null, notes: input.notes ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.retailerFailed', error);
  return data as RetailerRow;
}
export async function deleteRetailer(id: string): Promise<void> {
  const { error } = await getSupabase().from('retailers').delete().eq('id', id);
  if (error) fail('retail.errors.deleteFailed', error);
}
/**
 * Per-retailer reach + freshness for the Stores hub (4d). Three minimal
 * household-scoped selects, aggregated client-side (no aggregate RPC/migration).
 * Retailers with neither stores nor prices simply won't appear in the map — the
 * caller defaults them to zeros.
 */
export async function listRetailerStats(hid: string): Promise<Map<string, RetailerStat>> {
  const supabase = getSupabase();
  const [stores, rps, prices] = await Promise.all([
    supabase.from('retailer_stores').select('retailer_id').eq('household_id', hid),
    supabase.from('retailer_products').select('id, retailer_id').eq('household_id', hid),
    supabase.from('price_snapshots').select('retailer_product_id, observed_at').eq('household_id', hid),
  ]);
  const error = stores.error ?? rps.error ?? prices.error;
  if (error) fail('retail.errors.loadFailed', error);
  return computeRetailerStats(
    (stores.data ?? []) as { retailer_id: string }[],
    (rps.data ?? []) as { id: string; retailer_id: string }[],
    (prices.data ?? []) as { retailer_product_id: string; observed_at: string }[],
  );
}

// --- stores ----------------------------------------------------------------
export async function listStores(retailerId: string): Promise<RetailerStoreRow[]> {
  const { data, error } = await getSupabase()
    .from('retailer_stores').select('*').eq('retailer_id', retailerId).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as RetailerStoreRow[];
}
export async function createStore(
  hid: string, retailerId: string, input: CreateStoreInput,
): Promise<RetailerStoreRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailer_stores').insert({
    household_id: hid, retailer_id: retailerId, name: input.name,
    street: input.street ?? null, city: input.city ?? null, region: input.region ?? null,
    postal_code: input.postalCode ?? null, country_code: input.countryCode ?? null,
    latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    currency_code: input.currencyCode, is_online: input.isOnline ?? false, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.storeFailed', error);
  return data as RetailerStoreRow;
}

// --- products --------------------------------------------------------------
export async function listProducts(hid: string): Promise<ProductRow[]> {
  const { data, error } = await getSupabase()
    .from('products').select('*').eq('household_id', hid).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as ProductRow[];
}
export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data, error } = await getSupabase()
    .from('products').select('*').eq('id', id).maybeSingle();
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? null) as ProductRow | null;
}
export async function createProduct(hid: string, input: CreateProductInput): Promise<ProductRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('products').insert({
    household_id: hid, name: input.name, brand: input.brand ?? null,
    gtin: input.gtin ?? null, upc: input.upc ?? null, ean: input.ean ?? null,
    size_value: input.sizeValue ?? null, size_unit: input.sizeUnit ?? null,
    pack_count: input.packCount, category: input.category ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.productFailed', error);
  return data as ProductRow;
}

// --- retailer_products -----------------------------------------------------
export async function listRetailerProducts(productId: string): Promise<RetailerProductWithRetailer[]> {
  const { data, error } = await getSupabase()
    .from('retailer_products')
    .select('*, retailer:retailers(id,name)')
    .eq('product_id', productId);
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as RetailerProductWithRetailer[];
}
export async function createRetailerProduct(
  hid: string, input: CreateRetailerProductInput,
): Promise<RetailerProductRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailer_products').insert({
    household_id: hid, product_id: input.productId, retailer_id: input.retailerId,
    retailer_sku: input.retailerSku ?? null, display_name: input.displayName ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.retailerProductFailed', error);
  return data as RetailerProductRow;
}

// --- price snapshots -------------------------------------------------------
export async function listPricesForProduct(productId: string): Promise<PriceWithRefs[]> {
  // Two-step: retailer_products for this product, then their price snapshots.
  const rps = await listRetailerProducts(productId);
  const ids = rps.map((r) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select(
      '*, retailer_product:retailer_products(id,display_name,retailer:retailers(id,name)),' +
        'store:retailer_stores(id,name,currency_code,latitude,longitude)',
    )
    .in('retailer_product_id', ids)
    .order('observed_at', { ascending: false });
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as PriceWithRefs[];
}
export async function createPrice(hid: string, input: CreatePriceMinorInput): Promise<PriceSnapshotRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('price_snapshots').insert({
    household_id: hid, retailer_product_id: input.retailerProductId, store_id: input.storeId ?? null,
    regular_price_minor: input.regularMinor, sale_price_minor: input.saleMinor ?? null,
    member_price_minor: input.memberMinor ?? null, currency_code: input.currencyCode,
    source: input.source ?? 'manual', created_by,
  }).select('*').single();
  if (error) fail('retail.errors.priceFailed', error);
  return data as PriceSnapshotRow;
}
export async function deletePrice(id: string): Promise<void> {
  const { error } = await getSupabase().from('price_snapshots').delete().eq('id', id);
  if (error) fail('retail.errors.deleteFailed', error);
}

// --- saved locations -------------------------------------------------------
export async function listSavedLocations(hid: string): Promise<SavedLocationWithStore[]> {
  const { data, error } = await getSupabase()
    .from('saved_locations')
    .select('*, store:retailer_stores(id,name,latitude,longitude,retailer:retailers(id,name))')
    .eq('household_id', hid)
    .order('label');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as SavedLocationWithStore[];
}
export async function createSavedLocation(
  hid: string, input: CreateSavedLocationInput,
): Promise<SavedLocationRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('saved_locations').insert({
    household_id: hid, label: input.label, store_id: input.storeId, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.locationFailed', error);
  return data as SavedLocationRow;
}
export async function setActiveLocation(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_active_saved_location', { _id: id });
  if (error) fail('retail.errors.saveFailed', error);
}
/**
 * Set a store as the household's active shopping location (5b): reuse an existing
 * saved_location for that store if present (no duplicates), else create one, then
 * mark it active. The "Save & set as my location" glue.
 */
export async function saveAndActivateLocation(
  hid: string,
  storeId: string,
  label: string,
): Promise<void> {
  const existing = await listSavedLocations(hid);
  const found = existing.find((l) => l.store_id === storeId);
  const id = found ? found.id : (await createSavedLocation(hid, { label, storeId })).id;
  await setActiveLocation(id);
}
