/**
 * Per-retailer reach + price-freshness aggregation (pure).
 *
 * The Stores hub (4d) shows each retailer's branch count, price count, and the
 * age of its newest price. Rather than a bespoke aggregate RPC, we fetch three
 * minimal household-scoped lists and fold them here — no migration, and the fold
 * is pure so it unit-tests without touching Supabase.
 */

export interface RetailerStat {
  branches: number;
  prices: number;
  /** ISO timestamp of the newest price snapshot for this retailer, or null. */
  lastObservedAt: string | null;
}

export const EMPTY_RETAILER_STAT: RetailerStat = { branches: 0, prices: 0, lastObservedAt: null };

export function computeRetailerStats(
  stores: readonly { retailer_id: string }[],
  retailerProducts: readonly { id: string; retailer_id: string }[],
  prices: readonly { retailer_product_id: string; observed_at: string }[],
): Map<string, RetailerStat> {
  const stats = new Map<string, RetailerStat>();
  const entry = (id: string): RetailerStat => {
    let s = stats.get(id);
    if (!s) {
      s = { branches: 0, prices: 0, lastObservedAt: null };
      stats.set(id, s);
    }
    return s;
  };

  for (const s of stores) entry(s.retailer_id).branches += 1;

  const retailerOf = new Map<string, string>();
  for (const rp of retailerProducts) retailerOf.set(rp.id, rp.retailer_id);

  for (const p of prices) {
    const rid = retailerOf.get(p.retailer_product_id);
    if (!rid) continue; // price for a product we didn't fetch — ignore
    const s = entry(rid);
    s.prices += 1;
    const ms = Date.parse(p.observed_at);
    if (!Number.isNaN(ms) && (s.lastObservedAt === null || ms > Date.parse(s.lastObservedAt))) {
      s.lastObservedAt = p.observed_at;
    }
  }

  return stats;
}
