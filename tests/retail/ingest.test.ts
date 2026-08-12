import { buildPriceInserts } from '@/features/retail/ingest';
import type { NormalizedPrice } from '@/features/retail/connector';
import { mockConnector } from '@/features/retail/connectors/mockConnector';

function np(over: Partial<NormalizedPrice>): NormalizedPrice {
  return {
    regularMinor: 1000,
    currencyCode: 'usd',
    observedAt: '2026-08-12T00:00:00Z',
    source: 'connector',
    ...over,
  };
}

describe('buildPriceInserts', () => {
  it('maps a valid price and uppercases the currency', () => {
    const rows = buildPriceInserts('rp1', 's1', [np({ regularMinor: 1000, saleMinor: 800, currencyCode: 'usd' })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: 's1', regularMinor: 1000, saleMinor: 800, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('omits sale/member when absent and passes storeId undefined', () => {
    const rows = buildPriceInserts('rp1', undefined, [np({ regularMinor: 500 })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: undefined, regularMinor: 500, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('skips an invalid currency', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ currencyCode: 'US' })])).toEqual([]);
  });

  it('skips a negative or non-finite regular price', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: -1 })])).toEqual([]);
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: Number.NaN })])).toEqual([]);
  });

  it('defaults source to "connector" when the price omits it', () => {
    const rows = buildPriceInserts('rp1', undefined, [{ regularMinor: 100, currencyCode: 'PHP', observedAt: 'x', source: '' }]);
    expect(rows[0]?.source).toBe('connector');
  });

  it('returns [] for empty input', () => {
    expect(buildPriceInserts('rp1', 's1', [])).toEqual([]);
  });
});

describe('mockConnector + buildPriceInserts (pipeline composition)', () => {
  it('turns fetched prices into insert rows', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'rp-rice' });
    const rows = buildPriceInserts('rp-rice', 'store-1', prices);
    expect(rows).toEqual([
      { retailerProductId: 'rp-rice', storeId: 'store-1', regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', source: 'mock' },
    ]);
  });

  it('returns no rows for an unknown retailer product', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'nope' });
    expect(buildPriceInserts('nope', undefined, prices)).toEqual([]);
  });
});
