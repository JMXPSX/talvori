# Build Plan

> Absorbs: `08_DEVELOPMENT_PHASES.md` and the MVP boundary from `07_PRODUCT_MODULES_AND_MVP.md`.
> Per-slice design history lives in `context/specs/` + `context/plans/`.
> Live status is tracked in `progress-tracker.md` (and claude-mem).

## Core principle

Ship in bounded, atomic slices: **brainstorm → spec → plan → execute** per slice, with a
typecheck/test/lint gate before each commit. Architect the retail/commerce surfaces early;
implement them incrementally. MVP simplicity beats premature enterprise complexity.

## Phase status legend

✅ built & verified · 🧩 architected, incremental · 🔒 gated on external accounts · ⏳ future

---

## Phase 0 — Product / architecture freeze ✅
PRD/TRD, architecture diagram, ERD, screen map, permission matrix, RLS plan, MVP backlog,
ADR starter. → captured across `context/` + `context/adr/`.

## Phase 1 — Technical foundation ✅
Expo universal app, TypeScript, Expo Router, Supabase client, env strategy, localization,
RTL readiness, validation, error handling, logging, design-system skeleton, testing
foundation, Git.
**Exit:** runs on iOS/Android/web; dev backend connects; no business data yet.

## Phase 2 — Authentication & household security ✅
Registration/login, email verification, email/SMS OTP, Google, Apple, MFA/TOTP,
passkey-ready flow, biometrics, recovery, sessions/devices, households, invitations, roles,
RLS.
**Exit:** household-isolation tests pass; unauthorized users can't read/write other household
data. (RLS drill green.)

## Phase 3 — Financial core ✅
Accounts, transactions, income/expense/transfer, categories, budgets, savings goals, debts,
multi-currency money engine, FX snapshot foundation, dashboard.

## Phase 4 — Shared household shopping ✅
Grocery lists, realtime sync, added/purchased-by, estimated/actual cost, notifications where
appropriate, expense conversion.
**Exit:** a real household can use the app daily across devices. (Migration applied,
RLS/realtime verified live.)

## Phase 5 — Retail intelligence (beta) ✅ / 🧩
Products, variants, retailers, store branches, price snapshots, connector interface, unit-price
normalization, branch/location selection, coupon/promotion schema. Foundation (5a), coupons,
and price comparison verified live. **Deferred (5d):** live connectors, the Edge Function
around `ingestFromConnector`, loyalty OAuth, and a global catalog — until an authorized data
source exists. The connector interface + a mock connector + the ingest pipeline already exist.

## Phase 6 — Commercialization ✅ / 🧩
6a: `household_subscriptions` model + entitlements/gating + a **dev-gated** (`__DEV__`) manual
owner plan toggle in `app/subscription.tsx` (so it can't be a free-premium hole in prod) —
complete & verified live. **Deferred (6b):** Apple IAP / Google Play / Stripe-web + webhooks,
regional pricing, restore purchase — needs store/processor accounts. 6b writes the same
subscription row via its `source` field.

## Phase 7 — Globalization ✅
Validated priority markets for currencies, languages, dates/numbers, timezones, RTL,
subscriptions, privacy flows, retailer availability. "Ledger & Remittance"/"ibilly" design
system + script-aware fonts landed here.

## Phase 8 — Security / QA / hardening ✅
RLS audit, secret audit, auth tests, money/FX tests + fix, session tests, account
deletion/export (verified live, incl. `protect_last_owner` cascade fix), forgot-password flow,
app-wide guarded deletes, retry UX, ActionSheet web fallback, network-failure handling.
**Deferred w/ reason:** payment tests (6b), crash monitoring (needs account), backup review
(ops), list virtualization (feeds are capped).

## Phase 9 — Beta 🔒
Founder → spouse → developer/consultant → trusted users, then TestFlight / Google testing
track / web beta. **Gated on external accounts:** web host, Apple/Google dev, Sentry, real
Site URL. Runbook: `context/specs/2026-08-13-phase9-beta-runbook.md`.

## Phase 10 — Production launch ⏳
Apple App Store, Google Play, Web/PWA, staged country rollout; retail price coverage may be
separately marked beta/supported.

---

## UX overhaul track (post-Phase-8, on `design/ibilly-adoption`)

Phases A–F delivered: A (component layer), B (screens 3a/3b/1a/1b), C (2b table/form caps/2a
Plan desktop), D (3c modals, 1d grocery, 2c segmented Shop hub), E (4a login+eye, 3e
subscription, 2d insights), F (5a retailer directory). Retail follow-ups: 4d Stores upgrade,
4e coupon→grocery matching, 5b branch picker, 2c rank-by-net Compare.

**Remaining (architectural):** 4b onboarding, 4c dark theme (provider refactor), full-2c Shop
tab, 5b branch-picker follow-ups.

## MVP boundary reminders

- **Out unless approved:** bank sync, receipt OCR, AI adviser, brokerage sync, remittance
  execution, price prediction, merchant ads, merchant portal, multi-store routing, enterprise.
- Don't over-design navigation before core flows are validated.
