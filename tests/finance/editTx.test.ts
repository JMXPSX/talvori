/** Pure helpers behind the transaction edit sheet (3a / F14 backdating). */

import { isoDatePart, occurredAtFrom } from '@/features/finance/editTx';

describe('isoDatePart', () => {
  it('extracts the calendar date', () => {
    expect(isoDatePart('2026-08-12T15:30:00Z')).toBe('2026-08-12');
  });
  it('returns empty string for invalid input', () => {
    expect(isoDatePart('not-a-date')).toBe('');
  });
});

describe('occurredAtFrom (F14 backdating)', () => {
  const original = '2026-08-12T15:30:00.000Z';

  it('keeps the original timestamp when the date is unchanged', () => {
    expect(occurredAtFrom('2026-08-12', original)).toBe(original);
  });

  it('anchors a changed date to noon UTC (no timezone day-slip)', () => {
    expect(occurredAtFrom('2026-08-01', original)).toBe('2026-08-01T12:00:00.000Z');
  });

  it('returns null for a malformed date', () => {
    expect(occurredAtFrom('2026-8-1', original)).toBeNull();
    expect(occurredAtFrom('', original)).toBeNull();
  });
});
