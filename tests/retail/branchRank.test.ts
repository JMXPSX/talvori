import { rankBranches } from '@/features/retail/branchRank';
import type { RetailerStoreRow } from '@/lib/database.types';

function store(over: Partial<RetailerStoreRow>): RetailerStoreRow {
  return {
    id: 'x',
    name: 'Store',
    city: null,
    region: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    ...over,
  } as unknown as RetailerStoreRow;
}

// Austin, TX
const HERE = { lat: 30.2672, lng: -97.7431 };

describe('rankBranches', () => {
  const austin = store({ id: 'a', name: 'Walmart S 1st', city: 'Austin', postal_code: '78704', latitude: 30.24, longitude: -97.75 });
  const dallas = store({ id: 'd', name: 'Walmart Dallas', city: 'Dallas', postal_code: '75201', latitude: 32.78, longitude: -96.8 });
  const noGeo = store({ id: 'n', name: 'Walmart Online', city: 'Anywhere' });

  it('orders by distance nearest-first when coords are present', () => {
    const r = rankBranches([dallas, austin], HERE, '');
    expect(r.map((x) => x.store.id)).toEqual(['a', 'd']);
    expect(r[0]!.km).toBeLessThan(r[1]!.km!);
  });

  it('pushes branches without coordinates to the bottom', () => {
    const r = rankBranches([noGeo, austin], HERE, '');
    expect(r.map((x) => x.store.id)).toEqual(['a', 'n']);
    expect(r[1]!.km).toBeNull();
  });

  it('filters by city / ZIP / name (case-insensitive)', () => {
    expect(rankBranches([austin, dallas], HERE, 'dallas').map((x) => x.store.id)).toEqual(['d']);
    expect(rankBranches([austin, dallas], HERE, '78704').map((x) => x.store.id)).toEqual(['a']);
    expect(rankBranches([austin, dallas], null, 'walmart')).toHaveLength(2);
  });

  it('falls back to name order when there are no coords', () => {
    const b = store({ id: 'b', name: 'Aldi' });
    const r = rankBranches([noGeo, b], null, '');
    expect(r.map((x) => x.store.name)).toEqual(['Aldi', 'Walmart Online']);
    expect(r.every((x) => x.km === null)).toBe(true);
  });
});
