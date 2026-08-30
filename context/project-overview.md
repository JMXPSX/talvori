# Project Overview

> Absorbs: `00_README_START_HERE.md`, `01_MASTER_PROJECT_CONTEXT.md`,
> `05_GLOBALIZATION_MARKETS_OFW_SPEC.md`, `07_PRODUCT_MODULES_AND_MVP.md`, and the `impeccable`
> product record (formerly `PRODUCT.md`). Defers to [`architecture.md`](architecture.md) and
> [`build-plan.md`](build-plan.md) for structural/roadmap depth. (The `impeccable` skill may
> regenerate a `PRODUCT.md` at the repo root on its next run — re-fold or repoint it if so.)

Internal codename: **Global Household App**. (No consumer branding/logos/bundle IDs until
trademark/legal clearance.)

## About the project

A universal Expo app (iOS / Android / Web-PWA) for **global household finance**: budgeting,
shared shopping, retail price intelligence, and multi-currency money, on a Supabase backend.
Not just an expense tracker — its differentiation is **household finance + shared
collaboration + shopping intelligence + retailer pricing/coupons + international
multi-currency**.

## The problem it solves

**Core promise:** *One household, one synchronized financial picture — even when members use
different devices, currencies, retailers, addresses, branches, or live in different countries.*

Cloud data is authoritative: one member adds "Milk" on Android, another sees it on iPhone or
PC, marks it purchased, and the first device reflects the change. A lost/replaced phone never
means lost household data.

## Positioning

Not "just an expense tracker." The defensible combination a neighboring product cannot copy
piecemeal:

> household finance **+** real-time shared collaboration **+** shopping / basket intelligence
> **+** branch-level retailer pricing & coupons **+** first-class international multi-currency
> (cross-border, remittance, FX).

## Target user

Individuals, couples, families, roommates — and especially **OFWs, migrant workers, expats,
and cross-border households**. Not a US-only app and not branded only for OFWs; the
architecture serves international families globally.

## Pages / navigation

Bottom tabs (native) / side nav (web): **Home, Budget, Transactions, Grocery, More.** Feature
stacks under `app/<domain>/`: Household, Goals, Debts, Retailers/Compare (Shop hub), Security,
Subscription, Settings. Routing is Expo Router, file-based under `app/`.

## Core functional areas

Auth & security · household membership & permissions · income/expenses/transactions ·
budgets · bills/recurring · debts · savings goals · shared grocery/shopping lists · retail
product catalog · branch-specific pricing · coupons/promotions/loyalty · basket comparison ·
multi-currency households · FX history/snapshots · cross-border/OFW tracking · premium
subscriptions.

## Data architecture

See `architecture.md`. Money is always integer minor units + ISO currency code; RLS is the
security boundary; every household record is `household_id`-scoped.

## Globalization

- **Priority markets:** US, Canada, Philippines, UK, Australia, Singapore, New Zealand; plus
  GCC — Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman. Retail coverage may be beta/partial
  per country while finance/household is fully available.
- **Languages from day 1:** English, Filipino/Tagalog, Arabic (matching i18n key sets).
- **RTL** is real, first-class (Arabic).
- Country, currency, language, timezone, retailer, tax, date/number format, and text
  direction are never hard-coded. User locale model: country_code, locale, language,
  currency_code, timezone.
- **Cross-border/OFW:** one household may span countries (e.g. member in SA/SAR + member in
  PH/PHP, reporting in PHP). Onboarding may ask "Do members of your household live in
  different countries?" and activate remittance/cross-border UX.
- **Subscription pricing is regional**, not USD-only; use platform regional pricing, allow
  purchasing-power/local-market pricing later — not mechanical FX conversion alone.

## Features in / out of scope

**In (MVP/core):** auth & security, household + RLS isolation, finance core (accounts,
income/expense/transfer, categories, budgets, goals, debts, multi-currency + FX snapshots,
dashboard), shared shopping (grocery lists, realtime sync, added/purchased-by, est/actual
cost, convert purchase → expense), iOS/Android/Web-PWA.

**Architect now, implement incrementally:** retail connector framework, normalized
products/variants, store/branch model, price snapshots, coupon/promotion model, loyalty
integrations, basket comparison.

**Out / later unless approved:** full bank sync, receipt OCR, AI financial adviser,
investment/brokerage sync, remittance *execution*, price prediction, merchant advertising,
full merchant portal, travel-optimized multi-store routing, enterprise features.

## Product principles

1. **Global from day one** — currency, language, locale, timezone, and direction are data,
   never baked-in assumptions.
2. **One household, one synchronized truth** — cloud-authoritative; every member sees the same
   current picture across devices and countries.
3. **Money is exact and never mixed** — integer minor units + ISO code; correctness over convenience.
4. **Security by database policy** — RLS is the boundary, not the interface.
5. **MVP simplicity over premature enterprise complexity** — ship the shared, correct, global
   core before breadth.

Also load-bearing: retail data authorized/licensed only · store/branch matters · price freshness
visible · subscription pricing regional (never USD-only).

## Durable constraints (future work must preserve)

Engineering invariants live in [`architecture.md`](architecture.md); the product-level commitments:

- **Money is exact** — integer minor units + ISO code, never float; never mix currencies.
- **Security in the database (RLS), not the UI** — every table household-scoped.
- **Globalization is not optional** — country, currency, language, timezone, tax, date format,
  and text direction are never hard-coded.
- **Adaptive platform, single design language** — one Expo codebase for iOS/Android/Web-PWA; no
  per-OS design fork; no native desktop app for MVP (installable PWA covers Windows/macOS).
- **Retail data must be authorized / licensed / permitted.**
- **Regional subscription pricing** — support local/regional currencies; never USD-only.
- **Price freshness must be visible; store/branch matters.**
- *Explicitly undecided (do not fabricate):* the public product name/brand.

## Brand commitments

- **No confirmed public brand name yet** — an open decision; future work must not invent one.
  Internal codename: *"Global Household App."*
- **Shipped design direction:** *"ibilly / Expertly Approachable"* — indigo `#4343D5`, burnt-
  orange accent, cool blue-white canvas, white bento tiles (per `components/theme.ts`; transcribed
  in [`ui-tokens.md`](ui-tokens.md)). A vermilion "Broadsheet Ledger" redesign is *proposed, not
  shipped* — see the Appendix in [`ui-tokens.md`](ui-tokens.md). Visual decisions belong to
  `impeccable`, not to this record.
- Voice / personality: not yet formally established.

## Accessibility & inclusion

- **RTL / Arabic is a first-class requirement**, not an afterthought.
- **Multilingual parity** (English / Filipino / Arabic) is required for all UI copy.
- No formal WCAG level is set yet — treat standard mobile/web accessibility as the working floor
  and record a specific standard here when the team commits to one.

## Success criteria

A real household can use the app daily across multiple devices; household isolation holds
(unauthorized users can't read/write another household's data); money/FX is exact and
currency-safe; the app runs on iOS, Android, and web from one codebase.

## Current status

Phases 1–8 built and verified. Phase 9 (Beta) is entry-gated on external accounts (web host,
Apple/Google dev, Sentry). See `build-plan.md` and `progress-tracker.md`.
