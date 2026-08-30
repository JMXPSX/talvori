# Architecture

> Absorbs: `02_NON_NEGOTIABLE_ARCHITECTURE_RULES.md`, `03_SECURITY_AUTHENTICATION_SPEC.md`,
> `04_DATABASE_MONEY_MULTICURRENCY_SPEC.md`, and the retail/backend patterns from
> `06_RETAIL_PRICE_COUPON_ENGINE_SPEC.md`. This is the shared mental model of how the
> app is organized, what belongs where, and how data flows end-to-end.

## Stack

| Layer | Choice | Purpose |
|-------|--------|---------|
| App | Expo + React Native + Expo Router | One universal codebase → iOS, Android, Web/PWA |
| Language | TypeScript (strict) | `tsc --noEmit` is a gate on every change |
| Backend | Supabase | Postgres + Auth + Realtime/Broadcast + Edge Functions + Storage |
| DB | PostgreSQL | RLS is the security boundary (not the client) |
| Validation | zod | `lib/validation.ts` `validate(schema, input)` |
| i18n | custom + Intl | `lib/i18n.ts`, `lib/format.ts`; en / fil / ar |

**Architecture shape:** a **modular monolith** — `Expo universal app → Supabase → authorized
external providers`. No microservices in MVP. Future extraction (price intelligence,
catalog, notifications, analytics) only when scale demands it.

## Folder structure

```text
app/          Expo Router file-based routes. app/_layout.tsx is the root.
components/    Design system: theme.ts + ui/ primitives.
features/      Feature modules: auth, household, finance, grocery, retail, billing.
lib/           Shared libs: money, format, fonts, rtl, supabase, errors, validation, i18n.
locales/       en.json / fil.json / ar.json (key sets MUST match).
supabase/      Hand-authored SQL migrations.
tests/         Jest unit/component tests + the live RLS isolation drill.
```

Path alias: `@/*` → repo root (e.g. `import { money } from '@/lib/money'`).

## System boundaries

- **Screens never call `getSupabase()` directly.** Only `features/*/api.ts` touches the
  Supabase client. This is the strict data-access boundary.
- Each feature module owns its `api.ts` (data access), `schemas.ts` (zod), and pure helpers.
- Query results are cast to the hand-maintained types in `lib/database.types.ts` **at the
  api boundary** (the Supabase client is intentionally schema-agnostic).
- Keep pure logic separate from I/O so it stays jest-testable. Example: `features/retail/
  ingest.ts` is pure; `ingestRunner.ts` does I/O. Importing the Supabase client into a
  jest-tested module breaks under jest.
- No privileged secrets client-side. Only `EXPO_PUBLIC_*` reaches the client; service-role,
  Stripe, retailer, SMS, FX, and RevenueCat secrets live in Edge Function secrets.

## Provider tree & auth gate

`app/_layout.tsx` loads fonts (gate), then nests:

```text
AuthProvider → ActiveHouseholdProvider → EntitlementsProvider → RootNavigator
```

and enforces the auth gate (redirect to `/login`). Tabs live in `app/(tabs)/`; feature
stacks in `app/<domain>/`.

## Data flows

- **Write:** screen → `features/<domain>/api.ts` → Supabase (RLS enforces household scope).
- **Money at the boundary:** UI enters *major* units; conversion to integer minor units
  happens at the screen boundary via `lib/money.ts`. Persisted/transported money is always
  integer minor units + ISO currency code.
- **Realtime:** grocery and other shared entities sync via Supabase Realtime/Broadcast;
  cloud data is authoritative (a lost device never means lost household data).
- **Retail (backend access pattern):** `Mobile/Web → our Price API/Edge Function →
  normalized cache/DB → retailer connectors → authorized external sources`. Never call
  many retailer APIs directly from the client — protects secrets, controls rate limits,
  normalizes output, enables caching + freshness monitoring + data-source governance.

## Database

Household-owned tables carry `household_id` and are protected by RLS. Conceptual domains:

- **Identity/Household** — profiles, households, household_members, household_invitations, household_settings
- **Finance** — accounts, categories, transactions, transaction_splits, budgets, budget_allocations, debts, debt_payments, savings_goals, goal_contributions
- **Currency** — currencies, fx_rate_snapshots
- **Shopping** — grocery_lists, grocery_items
- **Retail** — retailers, retailer_regions, stores, products, product_variants, retailer_products, price_snapshots, promotions, coupons, retailer_loyalty_connections (later)
- **Commercial** — plans, subscriptions, entitlements (`household_subscriptions`)
- **System** — audit_logs, notifications, attachments

Migrations are **hand-authored** SQL under `supabase/migrations/` (`YYYYMMDDNNNNNN_*.sql`),
applied by hand (paste into Supabase SQL editor → "Success. No rows returned" = applied).
Keep `lib/database.types.ts` in sync with each migration by hand. There is no local Postgres
and the Supabase CLI is not wired.

### Money rules (critical)

- Never persist money as float. Use `amount_minor` (integer) + `currency_code`.
- Minor-unit exponent is currency-specific (JPY=0, USD=2, KWD/BHD/OMR=3) via `lib/money.ts`.
- **Never mix currencies** in one value/transaction; DB triggers re-enforce this (a price's
  currency follows its store; a transaction's follows its account).
- Preserve original amount + currency on a transaction; store conversion context (original
  amount/currency, reporting amount/currency, FX rate, provider, timestamp) without
  destroying the original. Historical reporting must not silently move with today's rate.
- Never hard-code `$`, `USD`, two decimals, or US-only date/number formats.

## Authentication & security

- **Provider:** Supabase Auth. Methods (built + roadmap): email/password, email verification,
  email OTP, SMS OTP (international from day one), Google, Apple, TOTP/MFA, passkey-ready,
  biometric app unlock (Face ID / Touch ID / Android biometric), account recovery, session
  & device visibility, sign-out-other-devices, rate limiting, audit events.
- **Biometrics** unlock an existing valid device session; they are not the sole cloud
  identity: `cloud login → valid session → secure local storage → biometric unlock`.
- **Step-up auth** for high-risk actions (change ownership, change MFA, export/delete data,
  connect financial institutions).
- **Roles:** generic authorization — Owner, Admin, Member, Viewer. Never husband/wife.

## RLS — the security boundary

Every household table uses the same policy shape:

- `SELECT using (public.is_member_of(household_id))`
- writes `using / with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))`
- deletes often narrowed to `['owner','admin']`

Never trust a client-provided `household_id` alone. Cross-household mutations that RLS must
forbid are asserted in `tests/integration/rls-isolation.mjs` — **extend that script for every
new table.**

## Retail connector pattern

Retailer-specific calls are never scattered across screens. A standard connector interface:

```ts
interface RetailerConnector {
  retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
  checkAvailability?(input: AvailabilityInput): Promise<AvailabilityResult[]>;
}
```

Pricing is **store/branch/address-specific** (`Country → Region → Retailer → Store/Branch →
Product/Variant → Price Snapshot`), never `Walmart = $X`. Price freshness must be visible
(`Last updated 12 minutes ago`). Product matching normalizes by GTIN/UPC/EAN + brand/size/
pack, never display name alone. **Only authorized data sources** — official API, licensed
feed, partner/affiliate, permitted dataset, merchant data. No unauthorized scraping; never
fake coupon clipping or bypass retailer account protections.

## Invariants (non-negotiable)

1. RLS is the security boundary, not the client. Every household table is `household_id`-scoped.
2. Money is always integer minor units + ISO currency code. Never float. Never mix currencies.
3. Screens never call `getSupabase()` — only `features/*/api.ts`.
4. Migrations are hand-authored + hand-applied; `lib/database.types.ts` kept in sync by hand.
5. No server secrets client-side; only `EXPO_PUBLIC_*` reaches the client.
6. i18n parity across en/fil/ar; RTL is first-class (use `lib/rtl.ts`, never raw left/right).
7. Never `Alert.alert` (no-op on web) — use `useActionSheet`. Every entity has a guarded delete.
8. Retail data must come from authorized sources only.
