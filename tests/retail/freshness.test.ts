import { freshnessOf } from '@/features/retail/freshness';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

describe('freshnessOf', () => {
  const now = 1_000 * DAY;
  it('is fresh within 24h', () => {
    expect(freshnessOf(now - 5 * HOUR, now)).toBe('fresh');
  });
  it('is recent within 7 days', () => {
    expect(freshnessOf(now - 3 * DAY, now)).toBe('recent');
  });
  it('is stale beyond 7 days', () => {
    expect(freshnessOf(now - 10 * DAY, now)).toBe('stale');
  });
  it('treats exactly 24h as recent (boundary)', () => {
    expect(freshnessOf(now - DAY, now)).toBe('recent');
  });
});
