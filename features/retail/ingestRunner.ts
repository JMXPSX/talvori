/**
 * Reference connector-ingest runner (5d architecture subset). Composes a
 * connector + the pure `buildPriceInserts` mapping + persistence. This is the
 * exact core a production Edge Function will run server-side (retailer secrets
 * stay server-side; see the 5d ADR). Locally it works against the mock connector.
 * Not wired to any screen. Kept separate from `ingest.ts` so the pure mapping
 * stays free of the Supabase client dependency.
 */

import { createPrice } from '@/features/retail/api';
import type { RetailerConnector } from '@/features/retail/connector';
import { buildPriceInserts } from '@/features/retail/ingest';

/** Fetch, normalize, and persist one retailer_product's prices; returns count. */
export async function ingestFromConnector(
  householdId: string,
  connector: RetailerConnector,
  retailerProductId: string,
  storeId?: string,
): Promise<number> {
  const prices = await connector.fetchPrice({ retailerProductId, storeId });
  const rows = buildPriceInserts(retailerProductId, storeId, prices);
  for (const row of rows) {
    await createPrice(householdId, {
      retailerProductId: row.retailerProductId,
      storeId: row.storeId,
      regularMinor: row.regularMinor,
      saleMinor: row.saleMinor,
      memberMinor: row.memberMinor,
      currencyCode: row.currencyCode,
      source: row.source,
    });
  }
  return rows.length;
}
