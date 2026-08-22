/**
 * Rank a retailer's branches for the picker (pure): filter by a city/ZIP/name
 * query, then order nearest-first when we have the shopper's coordinates.
 * Branches without coordinates sort after located ones (distance-first is the
 * whole point); with no coordinates at all we fall back to name order.
 */

import { haversineKm } from '@/features/retail/distance';
import type { RetailerStoreRow } from '@/lib/database.types';

export interface RankedBranch {
  store: RetailerStoreRow;
  km: number | null;
}

export function rankBranches(
  stores: readonly RetailerStoreRow[],
  coords: { lat: number; lng: number } | null,
  query: string,
): RankedBranch[] {
  const q = query.trim().toLowerCase();
  const matches = (s: RetailerStoreRow): boolean => {
    if (!q) return true;
    return [s.name, s.city, s.region, s.postal_code]
      .filter((v): v is string => typeof v === 'string')
      .some((v) => v.toLowerCase().includes(q));
  };

  const ranked: RankedBranch[] = stores.filter(matches).map((store) => ({
    store,
    km:
      coords && store.latitude != null && store.longitude != null
        ? haversineKm(coords, { lat: store.latitude, lng: store.longitude })
        : null,
  }));

  ranked.sort((a, b) => {
    if (a.km != null && b.km != null) return a.km - b.km;
    if (a.km != null) return -1;
    if (b.km != null) return 1;
    return a.store.name.localeCompare(b.store.name);
  });

  return ranked;
}
