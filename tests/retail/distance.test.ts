import { haversineKm } from '@/features/retail/distance';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 40, lng: -73 }, { lat: 40, lng: -73 })).toBe(0);
  });
  it('approximates a known distance (NYC to LA ~3936km)', () => {
    const d = haversineKm({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(3980);
  });
});
