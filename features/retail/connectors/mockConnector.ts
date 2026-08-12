/**
 * DEV/TEST FIXTURE ONLY — not a live retailer. Performs NO network calls and NO
 * coupon clipping. Exists to prove the RetailerConnector interface is
 * implementable and to exercise the ingest pipeline in tests. Real adapters
 * (Walmart/Kroger/etc.) run server-side in an Edge Function — see the 5d ADR.
 */

import type {
  NormalizedPrice,
  NormalizedProduct,
  PriceLookupInput,
  ProductSearchInput,
  RetailerConnector,
} from '@/features/retail/connector';

export const MOCK_FIXTURE: {
  products: NormalizedProduct[];
  pricesByRetailerProduct: Record<string, NormalizedPrice[]>;
} = {
  products: [
    { gtin: '0000000000017', name: 'Sample Rice 5kg', brand: 'SampleBrand', sizeValue: 5, sizeUnit: 'kg', packCount: 1 },
    { gtin: '0000000000024', name: 'Sample Cooking Oil 1L', brand: 'SampleBrand', sizeValue: 1, sizeUnit: 'L', packCount: 1 },
  ],
  pricesByRetailerProduct: {
    'rp-rice': [
      { regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
    'rp-oil': [
      { regularMinor: 12000, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
  },
};

export const mockConnector: RetailerConnector = {
  retailerId: 'mock',
  async searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]> {
    const q = input.query.trim().toLowerCase();
    if (!q) return MOCK_FIXTURE.products;
    return MOCK_FIXTURE.products.filter((p) => p.name.toLowerCase().includes(q));
  },
  async fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]> {
    return MOCK_FIXTURE.pricesByRetailerProduct[input.retailerProductId] ?? [];
  },
};
