/**
 * Assembles latest prices per (product, column) in one currency for basket
 * comparison. A "column" is a physical branch (store id) or an online retailer
 * (online:{retailerId}). Reduces to the latest snapshot per (product, column),
 * effective = min(regular, sale).
 */

import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type { PricePoint } from '@/features/retail/basket';

interface PriceJoinRow {
  regular_price_minor: number;
  sale_price_minor: number | null;
  observed_at: string;
  store_id: string | null;
  retailer_product: { product_id: string; retailer: { id: string; name: string } | null } | null;
  store: { id: string; name: string } | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getBasketPrices(
  productIds: string[],
  currencyCode: string,
): Promise<{ prices: PricePoint[]; labels: Record<string, string> }> {
  if (productIds.length === 0) return { prices: [], labels: {} };

  // Which retailer_products belong to these products?
  const { data: rps, error: rpErr } = await getSupabase()
    .from('retailer_products')
    .select('id')
    .in('product_id', productIds);
  if (rpErr) fail('retail.errors.loadFailed', rpErr);
  const rpIds = (rps ?? []).map((r) => (r as { id: string }).id);
  if (rpIds.length === 0) return { prices: [], labels: {} };

  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select(
      'regular_price_minor, sale_price_minor, observed_at, store_id,' +
        'retailer_product:retailer_products(product_id, retailer:retailers(id,name)),' +
        'store:retailer_stores(id,name)',
    )
    .in('retailer_product_id', rpIds)
    .eq('currency_code', currencyCode)
    .order('observed_at', { ascending: false });
  if (error) fail('retail.errors.loadFailed', error);

  const rows = (data ?? []) as unknown as PriceJoinRow[];
  const labels: Record<string, string> = {};
  // Latest per (productId, columnKey): rows are already newest-first, keep first seen.
  const seen = new Set<string>();
  const prices: PricePoint[] = [];
  for (const r of rows) {
    const productId = r.retailer_product?.product_id;
    if (!productId) continue;
    const retailerId = r.retailer_product?.retailer?.id ?? 'unknown';
    const retailerName = r.retailer_product?.retailer?.name ?? '—';
    const columnKey = r.store_id ?? `online:${retailerId}`;
    const dedupe = `${productId} ${columnKey}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const effectiveMinor = Math.min(
      r.regular_price_minor,
      r.sale_price_minor ?? r.regular_price_minor,
    );
    prices.push({ productId, columnKey, effectiveMinor });
    labels[columnKey] = r.store?.name ?? `Online · ${retailerName}`;
  }
  return { prices, labels };
}
