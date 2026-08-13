import { formatDateWithLocale, formatDateTimeWithLocale } from '@/lib/format';

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
