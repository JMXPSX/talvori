/**
 * Retail connector interface — ARCHITECTED NOW, IMPLEMENTED LATER (Phase 5).
 *
 * Per 06_RETAIL_PRICE_COUPON_ENGINE_SPEC.md and 07 (§"Architect Now"): define
 * the standard connector shape so retailer-specific calls never scatter across
 * screens. NO concrete connectors, NO external calls, NO secrets in Phase 1.
 *
 * Runtime rule (do not violate later): the client never calls retailer APIs
 * directly. Flow is:
 *   Mobile/Web -> our Edge Function -> normalized cache -> connectors -> sources
 */

import type { Money } from '@/lib/money';

export interface ProductSearchInput {
  query: string;
  /** Optional store/branch to scope results to (see store/branch model). */
  storeId?: string;
  countryCode: string;
}

export interface NormalizedProduct {
  /** Our master product id, resolved via GTIN/UPC/EAN + attributes. */
  masterProductId: string;
  name: string;
  brand?: string;
  size?: string;
  gtin?: string;
}

export interface PriceLookupInput {
  masterProductId: string;
  storeId: string;
}

export type PriceKind = 'regular' | 'sale' | 'member' | 'coupon' | 'online';

export interface NormalizedPrice {
  masterProductId: string;
  storeId: string;
  kind: PriceKind;
  price: Money;
  /** When the source observed this price. Freshness must be visible to users. */
  observedAt: string;
  validUntil?: string;
  source: string;
}

export interface AvailabilityInput {
  masterProductId: string;
  storeId: string;
}

export interface AvailabilityResult {
  masterProductId: string;
  storeId: string;
  inStock: boolean;
}

/**
 * Contract every retailer adapter (WalmartConnector, KrogerConnector, …) will
 * implement in Phase 5. Only authorized/licensed data sources are permitted.
 */
export interface RetailerConnector {
  readonly retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
  checkAvailability?(input: AvailabilityInput): Promise<AvailabilityResult[]>;
}
