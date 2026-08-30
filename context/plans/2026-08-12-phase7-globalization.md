# Phase 7 — Globalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add locale/timezone-aware date formatting (the one globalization gap), wire it into the FX rates screen, and add a validation matrix proving currency-exponent / RTL / date handling across the 13 priority markets.

**Architecture:** Extend `lib/format.ts` with pure `*WithLocale` date formatters (Intl.DateTimeFormat) + device-locale wrappers, mirroring the money pure/wrapper split. Validate existing foundations (`lib/money` exponents, `lib/rtl`) plus the new formatter with one matrix test.

**Tech Stack:** TypeScript, Intl, jest. No migration, no backend, no new deps.

## Global Constraints

- **Money is integer minor units + ISO currency; exponents from `lib/money`.**
- **Nothing hard-codes locale/currency/direction** — date formatters take an explicit locale (pure) or use `localeTag()` (device).
- **Formatters never throw** — invalid/empty input returns `''`.
- Verification: `npm run typecheck`, `npm test`.

---

### Task 1: Locale/timezone date formatters (TDD)

**Files:**
- Modify: `lib/format.ts`
- Test: `tests/lib/format.test.ts`

**Interfaces:**
- Consumes: `Intl`, existing `localeTag()`.
- Produces:
  - `formatDateWithLocale(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string`
  - `formatDateTimeWithLocale(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string`
  - `formatDate(iso: string): string`
  - `formatDateTime(iso: string): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/format.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/lib/format.test.ts`
Expected: FAIL — `formatDateWithLocale`/`formatDateTimeWithLocale` are not exported.

- [ ] **Step 3: Implement in `lib/format.ts`**

Add to `lib/format.ts` (keep the existing `localeTag` + `formatAmount`):

```typescript
const DATE_OPTS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

function parse(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locale-explicit date formatter (pure). Empty string on invalid input. */
export function formatDateWithLocale(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = parse(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...opts }).format(d);
}

/** Locale-explicit date+time formatter (pure). Empty string on invalid input. */
export function formatDateTimeWithLocale(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const d = parse(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale, { ...DATE_OPTS, ...TIME_OPTS, ...opts }).format(d);
}

/** Device-locale date. */
export function formatDate(iso: string): string {
  return formatDateWithLocale(iso, localeTag());
}

/** Device-locale date + time. */
export function formatDateTime(iso: string): string {
  return formatDateTimeWithLocale(iso, localeTag());
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts tests/lib/format.test.ts
git commit -m "feat(i18n): locale/timezone-aware date formatters + tests"
```

---

### Task 2: Wire the formatter into the FX rates screen

**Files:**
- Modify: `app/finance/rates.tsx`

**Interfaces:**
- Consumes: `formatDate` from `@/lib/format`.

- [ ] **Step 1: Use `formatDate` for the as-of date**

In `app/finance/rates.tsx`:

Ensure `formatDate` is imported from the format module. If the file already imports
from `@/lib/format` (e.g. `import { formatAmount } from '@/lib/format';`), extend
it to `import { formatAmount, formatDate } from '@/lib/format';`. Otherwise add the
import line.

Replace the raw date call (around line 101):

```typescript
                  {new Date(r.as_of).toLocaleDateString()} · {r.source}
```

with:

```typescript
                  {formatDate(r.as_of)} · {r.source}
```

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/finance/rates.tsx
git commit -m "feat(i18n): use locale-aware formatDate on the FX rates screen"
```

---

### Task 3: Globalization validation matrix

**Files:**
- Create: `tests/lib/globalization.test.ts`

**Interfaces:**
- Consumes: `minorExponent`, `toMinorUnits`, `toMajorUnits` (`@/lib/money`);
  `isRTLLanguage` (`@/lib/rtl`); `formatDateWithLocale` (`@/lib/format`).

- [ ] **Step 1: Write the matrix test**

Create `tests/lib/globalization.test.ts`:

```typescript
import { minorExponent, toMajorUnits, toMinorUnits, money } from '@/lib/money';
import { isRTLLanguage } from '@/lib/rtl';
import { formatDateWithLocale } from '@/lib/format';

// Priority markets (spec 05): core + GCC.
const EXP2 = ['USD', 'CAD', 'PHP', 'GBP', 'AUD', 'SGD', 'NZD', 'SAR', 'AED', 'QAR'];
const EXP3 = ['KWD', 'BHD', 'OMR'];

describe('currency exponents across priority markets', () => {
  it('uses 2 minor digits for standard priority currencies', () => {
    for (const c of EXP2) expect(minorExponent(c)).toBe(2);
  });
  it('uses 3 minor digits for the Gulf currencies', () => {
    for (const c of EXP3) expect(minorExponent(c)).toBe(3);
  });
  it('uses 0 minor digits for JPY (sanity)', () => {
    expect(minorExponent('JPY')).toBe(0);
  });
});

describe('minor-unit round-trip', () => {
  it('round-trips an exp-2 currency', () => {
    const minor = toMinorUnits(12.34, 'PHP'); // 1234
    expect(minor).toBe(1234);
    expect(toMajorUnits(money(minor, 'PHP'))).toBeCloseTo(12.34, 5);
  });
  it('round-trips an exp-3 currency', () => {
    const minor = toMinorUnits(12.345, 'KWD'); // 12345
    expect(minor).toBe(12345);
    expect(toMajorUnits(money(minor, 'KWD'))).toBeCloseTo(12.345, 5);
  });
});

describe('RTL detection across supported languages', () => {
  it('flags Arabic as RTL', () => {
    expect(isRTLLanguage('ar')).toBe(true);
    expect(isRTLLanguage('ar-SA')).toBe(true);
  });
  it('flags English and Filipino as LTR', () => {
    expect(isRTLLanguage('en')).toBe(false);
    expect(isRTLLanguage('fil')).toBe(false);
    expect(isRTLLanguage('tl')).toBe(false);
  });
});

describe('date formatting across supported locales', () => {
  const iso = '2026-08-12T00:00:00Z';
  it('produces non-empty output per locale and empty for bad input', () => {
    for (const loc of ['en-US', 'fil-PH', 'ar-SA']) {
      expect(formatDateWithLocale(iso, loc, { timeZone: 'UTC' }).length).toBeGreaterThan(0);
    }
    expect(formatDateWithLocale('', 'en-US')).toBe('');
  });
});
```

- [ ] **Step 2: Run the matrix test**

Run: `npx jest tests/lib/globalization.test.ts`
Expected: PASS. (If any priority currency fails the exponent check, extend the
`MINOR_EXPONENTS` table in `lib/money.ts` — but the current table already covers
KWD/BHD/OMR=3 and defaults the rest to 2, so it should pass as-is.)

- [ ] **Step 3: Commit**

```bash
git add tests/lib/globalization.test.ts
git commit -m "test(i18n): globalization matrix — priority-market exponents, RTL, dates"
```

---

### Task 4: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
```
Expected: typecheck clean; all suites pass, incl. `tests/lib/format.test.ts` and
`tests/lib/globalization.test.ts`. (No `test:rls` change — Phase 7 adds no DB.)

---

## Self-Review

**Spec coverage:**
- locale/timezone date formatters (pure + device) → Task 1 ✓
- graceful empty-string on bad input → Task 1 ✓
- wire into FX rates screen → Task 2 ✓
- validation matrix (exponents, round-trip, RTL, dates) across priority markets → Task 3 ✓
- out-of-scope (regional pricing 6b, privacy/retailer-availability, new languages) → not built ✓

**Placeholder scan:** No TBD/TODO; all code complete.

**Type consistency:** `formatDateWithLocale`/`formatDateTimeWithLocale`/`formatDate`
(Task 1) consumed in Tasks 2/3 with matching signatures. Matrix test uses existing
`minorExponent`/`toMinorUnits`/`toMajorUnits`/`money` (lib/money) and `isRTLLanguage`
(lib/rtl) — all already exported.
