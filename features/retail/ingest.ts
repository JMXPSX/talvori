/**
 * Pure connector-ingest normalization (5d architecture subset). Maps a
 * connector's NormalizedPrice[] to price_snapshots insert rows. No I/O — the
 * persisting runner lives in `ingestRunner.ts` so this stays dependency-free and
 * unit-testable. In production the runner runs inside a Supabase Edge Function so
 * retailer secrets never reach the client (see the 5d ADR).
 */

import type { NormalizedPrice } from '@/features/retail/connector';

export interface PriceInsertRow {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  source: string;
}

const isValidMinor = (n: number | undefined): n is number =>
  n !== undefined && Number.isFinite(n) && n >= 0;

/** Map connector prices to insert rows, dropping malformed entries. Pure. */
export function buildPriceInserts(
  retailerProductId: string,
  storeId: string | undefined,
  prices: NormalizedPrice[],
): PriceInsertRow[] {
  const rows: PriceInsertRow[] = [];
  for (const p of prices) {
    const currencyCode = (p.currencyCode ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;
    if (!Number.isFinite(p.regularMinor) || p.regularMinor < 0) continue;
    const row: PriceInsertRow = {
      retailerProductId,
      storeId,
      regularMinor: p.regularMinor,
      currencyCode,
      source: p.source && p.source.length > 0 ? p.source : 'connector',
    };
    if (isValidMinor(p.saleMinor)) row.saleMinor = p.saleMinor;
    if (isValidMinor(p.memberMinor)) row.memberMinor = p.memberMinor;
    rows.push(row);
  }
  return rows;
}
