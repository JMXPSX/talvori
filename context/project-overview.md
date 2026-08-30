# Project Overview

> Absorbs: `00_README_START_HERE.md`, `01_MASTER_PROJECT_CONTEXT.md`,
> `05_GLOBALIZATION_MARKETS_OFW_SPEC.md`, `07_PRODUCT_MODULES_AND_MVP.md`. A short index
> that defers to [`architecture.md`](architecture.md) and [`build-plan.md`](build-plan.md) for
> depth, and to [`product.md`](product.md) for the full product-intent record (positioning,
> brand commitments, durable constraints, accessibility).

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

Global from day one · mobile + web from one codebase · security by database policy not just
UI · money calculations exact · retail data authorized/licensed only · store/branch matters ·
price freshness visible · subscription pricing regional · MVP simplicity over premature
complexity.

## Success criteria

A real household can use the app daily across multiple devices; household isolation holds
(unauthorized users can't read/write another household's data); money/FX is exact and
currency-safe; the app runs on iOS, Android, and web from one codebase.

## Current status

Phases 1–8 built and verified. Phase 9 (Beta) is entry-gated on external accounts (web host,
Apple/Google dev, Sentry). See `build-plan.md` and `progress-tracker.md`.
