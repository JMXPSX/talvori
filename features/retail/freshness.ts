/**
 * Price freshness buckets from an observation timestamp. Screens turn these into
 * localized "Last updated…" labels. Boundaries: <24h fresh, <7d recent, else stale.
 */

export type Freshness = 'fresh' | 'recent' | 'stale';

const DAY = 24 * 3600 * 1000;

export function freshnessOf(observedAtMs: number, nowMs: number): Freshness {
  const age = nowMs - observedAtMs;
  if (age < DAY) return 'fresh';
  if (age < 7 * DAY) return 'recent';
  return 'stale';
}
