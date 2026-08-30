# Phase 7 — Globalization (validation + date gap-fill) — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Phase 7 = "validate priority countries for currencies, languages, dates/numbers,
timezones, RTL, subscriptions, privacy flows, retailer availability." Most of the
foundation already exists and is tested:
- i18n en/fil/ar (`lib/i18n`, `locales/*`) with key-parity tests.
- RTL utilities (`lib/rtl`: `isRTLLanguage`, `applyDirectionForLanguage`,
  direction-aware primitives).
- Exponent-aware money (`lib/money`) + locale-aware `formatAmount` (`lib/format`).
- Subscription regional pricing: 6a stores only `plan_code`; regional prices come
  from stores/processors in 6b (already documented — nothing to build here).

The one real gap is **date / time / timezone formatting** — there is no date
helper, and `app/finance/rates.tsx` formats a date with a bare
`new Date(x).toLocaleDateString()` (implicit locale, no timezone control).

So Phase 7 delivers: (1) a locale/timezone-aware date formatter that fills the
gap, and (2) a globalization validation matrix that proves the phase's claims
across the priority markets.

## Priority markets (from spec 05)

Core: US, CA, PH, UK, AU, SG, NZ. GCC: SA, AE, QA, KW, BH, OM.
Currencies: USD, CAD, PHP, GBP, AUD, SGD, NZD (exp 2); SAR, AED, QAR (exp 2);
**KWD, BHD, OMR (exp 3)**. Languages: en, fil, ar (ar is RTL).

## Deliverables

### 1. Date/time formatting — `lib/format.ts`

Mirror the money split (pure core + device wrapper):

```
formatDateWithLocale(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string
formatDateTimeWithLocale(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string
formatDate(iso: string): string        // device locale
formatDateTime(iso: string): string    // device locale
```

- Built on `Intl.DateTimeFormat`. `formatDateWithLocale` defaults to
  `{ year: 'numeric', month: 'short', day: 'numeric' }`; the datetime variant adds
  `{ hour: 'numeric', minute: '2-digit' }`. Callers may pass a `timeZone` via opts.
- Invalid/empty input returns `''` (never throws) so screens degrade gracefully.
- The `*WithLocale` functions are pure (explicit locale) → unit-testable; the
  device wrappers reuse the existing `localeTag()`.

Wire-in: `app/finance/rates.tsx` replaces
`new Date(r.as_of).toLocaleDateString()` with `formatDate(r.as_of)`.

### 2. Validation matrix — `tests/lib/globalization.test.ts`

Assert, in one place, that the priority markets are handled correctly:
- **Currency exponents:** `minorExponent(code)` returns 3 for KWD/BHD/OMR and 2 for
  USD/CAD/PHP/GBP/AUD/SGD/NZD/SAR/AED/QAR — so `toMinorUnits`/`formatMoney` never
  mis-round a market's currency. Include a JPY=0 sanity case.
- **Round-trip:** for a representative amount, `toMinorUnits(major, code)` then
  `toMajorUnits` returns the original for exp-2 and exp-3 currencies.
- **RTL:** `isRTLLanguage('ar')` is true; `'en'`/`'fil'`/`'tl'` are false.
- **Dates:** `formatDateWithLocale(iso, locale)` returns a non-empty string for
  `en-US`, `fil-PH`, and `ar-SA`, and empty string for `''`/invalid input.

## Out of scope
Regional subscription pricing (comes from stores/processors — 6b ADR); privacy
flows and retailer-availability-by-country (product/legal work, not code here);
adding new languages (post-MVP). No migration, no backend, no new dependencies.

## Success criteria
- Locale/timezone-aware date formatting exists, is used on the FX rates screen,
  and degrades gracefully on bad input.
- The globalization matrix test passes, proving currency-exponent, RTL, and date
  handling across the priority markets.
- `typecheck` clean; all unit tests pass.
