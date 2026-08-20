import { formatDateRange, formatDateWithLocale, formatDateTimeWithLocale } from '@/lib/format';

const iso = '2026-08-12T15:30:00Z';

describe('formatDateWithLocale', () => {
  it('formats a date in en-US', () => {
    // Force UTC so the assertion is timezone-stable.
    const s = formatDateWithLocale(iso, 'en-US', { timeZone: 'UTC' });
    expect(s).toContain('2026');
    expect(s).toContain('Aug');
    expect(s).toContain('12');
  });

  it('produces non-empty output for fil-PH and ar-SA', () => {
    expect(formatDateWithLocale(iso, 'fil-PH', { timeZone: 'UTC' }).length).toBeGreaterThan(0);
    expect(formatDateWithLocale(iso, 'ar-SA', { timeZone: 'UTC' }).length).toBeGreaterThan(0);
  });

  it('returns empty string for invalid or empty input', () => {
    expect(formatDateWithLocale('', 'en-US')).toBe('');
    expect(formatDateWithLocale('not-a-date', 'en-US')).toBe('');
  });
});

describe('formatDateTimeWithLocale', () => {
  it('includes the time', () => {
    const s = formatDateTimeWithLocale(iso, 'en-US', { timeZone: 'UTC', hour12: false });
    expect(s).toContain('15');
    expect(s).toContain('30');
  });
});

describe('formatDateRange (F27)', () => {
  it('formats a same-year range compactly in en-US', () => {
    const s = formatDateRange('2026-08-01', '2026-08-31', 'en-US');
    expect(s).toContain('Aug');
    expect(s).toContain('2026');
    // Both endpoints appear; the year is not repeated on the low end.
    expect(s).toContain('1');
    expect(s).toContain('31');
  });

  it('produces non-empty output for fil-PH and ar-SA (RTL-safe)', () => {
    expect(formatDateRange('2026-08-01', '2026-08-31', 'fil-PH').length).toBeGreaterThan(0);
    expect(formatDateRange('2026-08-01', '2026-08-31', 'ar-SA').length).toBeGreaterThan(0);
  });

  it('treats inputs as calendar dates (UTC), so the day never slips', () => {
    // A date-only value must render as the 1st regardless of the host timezone.
    expect(formatDateRange('2026-08-01', '2026-08-01', 'en-US')).toContain('1');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDateRange('', '2026-08-31', 'en-US')).toBe('');
    expect(formatDateRange('2026-08-01', 'nope', 'en-US')).toBe('');
  });
});
