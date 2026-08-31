import { resolveDate } from '@/components/ui/DateField';

/** Local ISO date (yyyy-mm-dd) for a Date. Mirrors the component's own helper. */
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('resolveDate (§6.5 date field)', () => {
  it('custom mode returns the entered date verbatim', () => {
    expect(resolveDate('custom', '2026-01-15')).toBe('2026-01-15');
  });

  it('today resolves to the local ISO date', () => {
    expect(resolveDate('today', '')).toBe(localISO(new Date()));
  });

  it('yesterday is exactly one day before today', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(resolveDate('yesterday', '')).toBe(localISO(y));
  });

  it('all three modes return an ISO yyyy-mm-dd string', () => {
    for (const r of [resolveDate('today', ''), resolveDate('yesterday', ''), resolveDate('custom', '2026-02-02')]) {
      expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
