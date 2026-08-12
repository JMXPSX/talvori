/**
 * Retail connector contract (slice 5d will implement adapters + a backend Price
 * API). Types ONLY — no implementations, not imported by UI. Documents the shape
 * a WalmartConnector / KrogerConnector / MerchantFeedConnector must satisfy so it
 * drops in with no schema change. Live calls run server-side (Edge Function),
 * never from the client, per the retail spec.
 */

export interface ProductSearchInput {
  query: string;
  countryCode?: string;
}

export interface NormalizedProduct {
  gtin?: string;
  name: string;
  brand?: string;
  sizeValue?: number;
  sizeUnit?: string;
  packCount?: number;
}

export interface PriceLookupInput {
  retailerProductId: string;
  storeId?: string;
}

export interface NormalizedPrice {
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  observedAt: string;
  validUntil?: string;
  source: string;
}

export interface RetailerConnector {
  retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
}
