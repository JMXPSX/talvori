import { computeRetailerStats, EMPTY_RETAILER_STAT } from '@/features/retail/retailerStats';

describe('computeRetailerStats', () => {
  it('counts branches per retailer', () => {
    const stats = computeRetailerStats(
      [{ retailer_id: 'a' }, { retailer_id: 'a' }, { retailer_id: 'b' }],
      [],
      [],
    );
    expect(stats.get('a')?.branches).toBe(2);
    expect(stats.get('b')?.branches).toBe(1);
  });

  it('counts prices via retailer_product → retailer, keeping the newest date', () => {
    const stats = computeRetailerStats(
      [],
      [
        { id: 'rp1', retailer_id: 'a' },
        { id: 'rp2', retailer_id: 'a' },
        { id: 'rp3', retailer_id: 'b' },
      ],
      [
        { retailer_product_id: 'rp1', observed_at: '2026-08-01T00:00:00Z' },
        { retailer_product_id: 'rp2', observed_at: '2026-08-20T00:00:00Z' },
        { retailer_product_id: 'rp3', observed_at: '2026-07-15T00:00:00Z' },
      ],
    );
    expect(stats.get('a')?.prices).toBe(2);
    expect(stats.get('a')?.lastObservedAt).toBe('2026-08-20T00:00:00Z');
    expect(stats.get('b')?.prices).toBe(1);
    expect(stats.get('b')?.lastObservedAt).toBe('2026-07-15T00:00:00Z');
  });

  it('ignores prices for products that were not fetched', () => {
    const stats = computeRetailerStats(
      [],
      [{ id: 'rp1', retailer_id: 'a' }],
      [{ retailer_product_id: 'unknown', observed_at: '2026-08-01T00:00:00Z' }],
    );
    expect(stats.get('a')).toBeUndefined();
  });

  it('ignores unparseable observation timestamps for the newest-date pick', () => {
    const stats = computeRetailerStats(
      [],
      [{ id: 'rp1', retailer_id: 'a' }],
      [
        { retailer_product_id: 'rp1', observed_at: 'not-a-date' },
        { retailer_product_id: 'rp1', observed_at: '2026-08-05T00:00:00Z' },
      ],
    );
    expect(stats.get('a')?.prices).toBe(2);
    expect(stats.get('a')?.lastObservedAt).toBe('2026-08-05T00:00:00Z');
  });

  it('returns an empty map for empty inputs', () => {
    expect(computeRetailerStats([], [], []).size).toBe(0);
    expect(EMPTY_RETAILER_STAT).toEqual({ branches: 0, prices: 0, lastObservedAt: null });
  });
});
