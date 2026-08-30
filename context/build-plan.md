# Build Plan

> Absorbs: `08_DEVELOPMENT_PHASES.md` and the MVP boundary from `07_PRODUCT_MODULES_AND_MVP.md`.
> Per-slice design history is folded into this file: **[Appendix A — design specs](#appendix-a--per-slice-design-specs)**
> and **[Appendix B — execution plans](#appendix-b--per-slice-execution-plans)** (anchor forms
> `#spec-<stem>` / `#plan-<stem>`). Live status is tracked in `progress-tracker.md` (and claude-mem).

## Core principle

Ship in bounded, atomic slices: **brainstorm → spec → plan → execute** per slice, with a
typecheck/test/lint gate before each commit. Architect the retail/commerce surfaces early;
implement them incrementally. MVP simplicity beats premature enterprise complexity.

## Phase status legend

✅ built & verified · 🧩 architected, incremental · 🔒 gated on external accounts · ⏳ future

---

## Phase 0 — Product / architecture freeze ✅
PRD/TRD, architecture diagram, ERD, screen map, permission matrix, RLS plan, MVP backlog,
ADR starter. → captured across `context/`; decision log in `architecture.md` §"Key decisions & rationale".

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
Site URL. Runbook: `#spec-2026-08-13-phase9-beta-runbook`.

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

---

# Appendix A — Per-slice design specs

> Folded in from the former `context/specs/` (now in git history). Frozen per-slice
> design contracts — one section per slice; anchor form `#spec-<stem>`.


## spec 2026-08-12-phase4-shared-shopping-design

# Phase 4 — Shared Household Shopping (Grocery) — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Goal

Deliver the MVP "Shared Shopping" module: multiple named grocery lists per
household, edited live across devices, with per-item attribution and a
"complete shopping trip" checkout that produces one clean household expense.

Builds on the established patterns from Phases 1–3: Supabase + RLS (writer vs
viewer roles), integer-minor-unit money, `features/<domain>/api.ts` as the data
boundary, screens under `app/`, i18n in three locales, and pure helpers unit
tested.

## Locked design decisions

1. **Realtime strategy: true Supabase Realtime.** `postgres_changes`
   subscriptions so a change on one device appears on another within ~1s, no
   refresh. This is the spec's exit criterion ("test multi-device concurrency")
   and establishes the realtime foundation the app reuses later.
2. **Purchase → expense: per-list checkout.** Shop, mark items purchased with
   actual prices, then "Complete shopping trip" creates ONE expense transaction
   for the trip total against a chosen account + category. Item detail stays on
   the list. Mirrors a real receipt; keeps the ledger readable.
3. **Currency: one currency per list.** Each list has a `currency_code`
   (defaults client-side to the household `reporting_currency_code`). All item
   prices are integer minor units in that currency. Checkout requires an account
   in the same currency. Matches "one trip, one store, one currency" and the
   money engine's no-mixing invariant.
4. **Notifications: attribution only.** Show who added / who purchased each item
   plus "last updated by". Realtime covers live awareness. No push
   notifications this phase (defers expo-notifications + device tokens).

Confirmed: **multiple named lists per household** (not a single global list).

## Data model — migration `20260812000005_grocery.sql`

### `grocery_lists`

| column                     | type          | notes                                             |
|----------------------------|---------------|---------------------------------------------------|
| `id`                       | uuid pk       | `gen_random_uuid()`                               |
| `household_id`             | uuid          | fk → households, `on delete cascade`              |
| `name`                     | text not null | trimmed, non-empty (client validated)             |
| `currency_code`            | text not null | `~ '^[A-Z]{3}$'`; client defaults to household ccy |
| `status`                   | text not null | check `('active','completed','archived')` default `active` |
| `created_by`               | uuid not null | fk → auth.users                                   |
| `completed_at`             | timestamptz   | nullable; set at checkout                         |
| `completed_transaction_id` | uuid          | nullable; fk → transactions, set at checkout      |
| `created_at`               | timestamptz   | default now()                                     |
| `updated_at`               | timestamptz   | default now(); `set_updated_at()` trigger         |

### `grocery_items`

| column                  | type           | notes                                             |
|-------------------------|----------------|---------------------------------------------------|
| `id`                    | uuid pk        | `gen_random_uuid()`                               |
| `list_id`               | uuid not null  | fk → grocery_lists, `on delete cascade`           |
| `household_id`          | uuid not null  | denormalized from list; needed for RLS + realtime filtering |
| `name`                  | text not null  | trimmed, non-empty                                |
| `quantity`              | numeric        | default 1                                         |
| `unit`                  | text           | nullable ("kg", "pcs")                            |
| `estimated_price_minor` | bigint         | nullable; LINE total in list currency, minor units |
| `actual_price_minor`    | bigint         | nullable; LINE total in list currency, minor units |
| `is_purchased`          | boolean        | default false                                     |
| `added_by`              | uuid not null  | fk → auth.users                                   |
| `purchased_by`          | uuid           | nullable; fk → auth.users                         |
| `purchased_at`          | timestamptz    | nullable                                          |
| `sort_order`            | integer        | default 0                                         |
| `created_at`            | timestamptz    | default now()                                     |
| `updated_at`            | timestamptz    | default now(); `set_updated_at()` trigger         |

Constraints: prices `>= 0` when present; `quantity > 0`.

### Trigger `grocery_items_enforce_list`

Before insert/update: look up the parent list's `household_id`, force
`new.household_id` to match, and raise if the item claims a different household.
Mirrors `transactions_enforce_account`. `security definer`, `set search_path=''`.

## Checkout — `complete_grocery_list(_list_id, _account_id, _category_id)` RPC

`language plpgsql`, `security definer`, `set search_path = ''`. Atomic.

1. `_uid := auth.uid()`; resolve the list's household.
2. Verify `has_role_in(household, ['owner','admin','member'])` for `_uid`.
3. Verify list exists, belongs to that household, and `status = 'active'`.
4. Resolve account; verify it belongs to the same household and
   `account.currency_code = list.currency_code` (else raise).
5. If `_category_id` is provided, verify it belongs to the household.
6. `_total := coalesce(sum(actual_price_minor), 0)` over `is_purchased` items.
7. Insert one `transactions` row: `type='expense'`, `direction='out'`,
   `amount_minor=_total`, `currency_code=list.currency_code`, chosen
   account/category, `description='Grocery: '||list.name`, `created_by=_uid`,
   `occurred_at=now()`. (The existing `transactions_enforce_account` trigger
   re-confirms account/household/currency.)
8. Update list: `status='completed'`, `completed_at=now()`,
   `completed_transaction_id=<new tx id>`.
9. Return the transaction id.

Edge cases: zero purchased items → still allowed (records a 0 expense) OR
reject — **decision: reject** with a clear error ("nothing purchased yet"), so
we never create meaningless 0-value transactions. Already-completed list →
reject.

## RLS (mirrors finance exactly)

Both tables: `enable row level security`.

- **SELECT:** `is_member_of(household_id)`
- **INSERT:** `has_role_in(household_id, ['owner','admin','member'])`
  and `created_by = auth.uid()` (lists) / `added_by = auth.uid()` (items)
- **UPDATE:** `has_role_in(household_id, ['owner','admin','member'])` (using + with check)
- **DELETE:** items → writers; lists → `has_role_in(household_id, ['owner','admin'])`
- Grants: `select, insert, update, delete` to `authenticated`.
- Add both tables to the `supabase_realtime` publication
  (`alter publication supabase_realtime add table ...`). `postgres_changes`
  streams honor RLS for the authenticated role.

## Client — `features/grocery/`

- **`schemas.ts`** — zod schemas: `createListSchema`, `addItemSchema`,
  `updateItemSchema`, `checkoutSchema`. Money entered as major units in UI,
  converted to minor via the existing money helpers.
- **`api.ts`** — data boundary:
  - `listLists(householdId)`, `createList`, `archiveList`
  - `getListWithItems(listId)`, `addItem`, `updateItem` (rename, qty, prices,
    toggle purchased → sets `purchased_by`/`purchased_at`), `deleteItem`
  - `completeList(listId, accountId, categoryId)` → `complete_grocery_list` RPC
  - `subscribeToLists(householdId, cb)` and `subscribeToItems(listId, cb)` —
    return an unsubscribe fn; wrap channel lifecycle.
- **`totals.ts`** — pure helpers: `estimatedTotalMinor(items)`,
  `actualTotalMinor(items)`, `purchasedCount(items)`. Integer minor units.
- Screens:
  - `app/(tabs)/grocery.tsx` — lists index: create list, active + completed
    sections, tap to open. Live via `subscribeToLists`.
  - `app/grocery/_layout.tsx` — stack layout (localized titles).
  - `app/grocery/[id].tsx` — list detail: add item, per-item toggle purchased +
    enter actual price, live estimated-vs-actual totals + purchased count,
    attribution ("added by / purchased by"), "Complete shopping trip" →
    account + category picker → `completeList`. Live via `subscribeToItems`.
- Optimistic UI for the current user's own edits; realtime reconciles.
- **i18n:** add `grocery.*` keys to `locales/en`, `locales/fil`, `locales/ar`
  (existing `screens.groceryTitle/groceryBody` get real content).
- **Types:** add `GroceryListRow`, `GroceryItemRow`, and the
  `complete_grocery_list` RPC signature to `lib/database.types.ts`.

## Tests

- **Unit** — `tests/grocery/totals.test.ts`: estimated/actual totals, purchased
  count, empty list, missing prices treated as 0.
- **RLS** — extend `tests/integration/rls-isolation.mjs`:
  - Household B cannot select/insert/update/delete Household A's lists or items.
  - `complete_grocery_list` refuses a caller who isn't a writer.
  - Currency mismatch (account ccy ≠ list ccy) is rejected.
  - Checkout produces exactly one expense transaction equal to the purchased sum.
- **Realtime concurrency** — best-effort automated: two authenticated clients in
  the same household; client B subscribes, client A inserts an item, assert B
  receives the change within a timeout. Documented manual multi-device check as
  backup (realtime in headless node can be flaky).

## Out of scope (this phase)

Push notifications; item-level (non-checkout) expense conversion; barcode /
price lookup; store/branch selection (that's Phase 5 retail).

## Success criteria

- Two devices in one household see each other's list edits live.
- Completing a trip creates one correct expense in the list currency, linked to
  the list, visible in the transactions feed and dashboard.
- Household isolation holds for all grocery tables (RLS test passes).
- `typecheck` clean, all unit tests pass.


## spec 2026-08-12-phase5a-retail-foundation-design

# Phase 5 Slice 5a — Retail Foundation & Browsing — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Phase 5 (Retail Intelligence) is the app's signature long-term capability and is
too large for one spec. It decomposes into:

- **5a — Retail foundation & browsing** (this doc): the household-scoped catalog
  hierarchy, unit-price normalization, price-freshness labels, saved shopping
  locations (+ GPS nearest-branch), the connector *interface* (types only), and
  read-only/entry browsing UI seeded with manual data.
- **5b — Coupons & promotions:** coupon/promotion schema, Level-1 discovery,
  matching to grocery items, expected savings / final price.
- **5c — Price comparison / basket:** compare a grocery list against a branch's
  prices; cheapest single-store basket (no travel routing).
- **5d — Live connectors & loyalty (later):** backend Price API/Edge Function +
  first *authorized* connector, OAuth loyalty linking, global authorized catalog.

Builds on Phases 1–4 patterns: Supabase + RLS (writer/viewer), integer-minor-unit
money, `features/<domain>` data boundary, screens under `app/`, i18n in three
locales, pure helpers unit-tested.

## Locked design decisions

1. **Data source: manual only.** Households enter retailers, branches, products,
   retailer mappings, and price snapshots by hand. The full schema + a connector
   *interface* are built now so a live adapter drops in later (5d) with no schema
   change. Zero legal/data-source risk; honors "architect now, implement
   incrementally."
2. **Location: manual saved locations + branch picker AND GPS.** Users save named
   locations (Home/Work/…) tied to a branch and switch the active one; they can
   also tap "use current location" to sort branches by proximity. Adds
   `expo-location` with a `navigator.geolocation` web fallback.
3. **Catalog scope: household-scoped.** Every retail table carries `household_id`
   and reuses the finance/grocery RLS pattern. Each household curates its own
   retail data — clean isolation, no moderation. A global authorized catalog is a
   5d concern layered in separately.
4. **No separate variants table.** Each `products` row is one purchasable variant
   (size/pack/identifiers). Cross-SKU master-product matching is deferred to 5d.

## Money & currency invariants

- All prices are integer minor units (`lib/money.ts`), in the store's currency.
- A price snapshot's `currency_code` follows its store's `currency_code`
  (client sets it; a trigger re-confirms — see below). Never mix currencies.

## Data model — migration `20260812000006_retail.sql`

All tables: `household_id uuid not null references households(id) on delete cascade`,
`created_by uuid not null references auth.users(id)`, `created_at`/`updated_at`
(via shared `set_updated_at()` trigger where updates are expected).

### `retailers`
`id`, `household_id`, `name` (not null), `country_code text check (~ '^[A-Z]{2}$')`
nullable, `website text` nullable, `notes text` nullable, `created_by`, timestamps.

### `retailer_stores` (branches)
`id`, `household_id`, `retailer_id` (fk→retailers, cascade), `name` (not null),
`street`, `city`, `region`, `postal_code`, `country_code` (`^[A-Z]{2}$`),
`latitude numeric` nullable, `longitude numeric` nullable,
`currency_code text not null check (~ '^[A-Z]{3}$')`,
`is_online boolean not null default false`, `timezone text` nullable,
`created_by`, timestamps.

### `products`
`id`, `household_id`, `name` (not null), `brand text` nullable,
`gtin text` / `upc text` / `ean text` nullable, `size_value numeric` nullable,
`size_unit text` nullable, `pack_count integer not null default 1 check (> 0)`,
`category text` nullable, `created_by`, timestamps.

### `retailer_products`
`id`, `household_id`, `product_id` (fk→products, cascade), `retailer_id`
(fk→retailers, cascade), `retailer_sku text` nullable, `display_name text`
nullable, `created_by`, timestamps. Unique `(household_id, product_id, retailer_id)`.

### `price_snapshots`
`id`, `household_id`, `retailer_product_id` (fk→retailer_products, cascade),
`store_id` (fk→retailer_stores, nullable — null = retailer-wide/online),
`regular_price_minor bigint not null check (>= 0)`,
`sale_price_minor bigint check (>= 0)` nullable,
`member_price_minor bigint check (>= 0)` nullable,
`currency_code text not null check (~ '^[A-Z]{3}$')`,
`observed_at timestamptz not null default now()`,
`valid_until timestamptz` nullable,
`source text not null default 'manual'`, `created_by`, `created_at`.
Index `(household_id, retailer_product_id, observed_at desc)`.

Trigger `price_snapshots_enforce_store` (`security definer`, `search_path=''`):
when `store_id` is set, force `currency_code` to that store's currency and reject
a store from another household; when null, leave currency as provided. Mirrors
`transactions_enforce_account`.

### `saved_locations`
`id`, `household_id`, `label text not null`, `store_id` (fk→retailer_stores,
cascade), `is_active boolean not null default false`, `created_by`, timestamps.
Partial unique index enforcing at most one active per household:
`create unique index uniq_saved_location_active on saved_locations (household_id) where is_active;`
Set-active is done via an RPC that clears the prior active then sets the new one
atomically (avoids a brief two-active window that the partial index would reject).

### RLS (mirrors finance)
For every table: `enable row level security`.
- SELECT: `is_member_of(household_id)`
- INSERT: `has_role_in(household_id, ['owner','admin','member'])` and
  `created_by = auth.uid()`
- UPDATE: `has_role_in(household_id, ['owner','admin','member'])` (using + check)
- DELETE: catalog tables (retailers, retailer_stores, products, retailer_products)
  → `['owner','admin']`; price_snapshots + saved_locations → writers
- Grants: `select, insert, update, delete` to `authenticated`.

### `set_active_saved_location(_id uuid)` RPC
`security definer`, `search_path=''`. Verifies caller is a writer of the row's
household; sets all the household's `saved_locations.is_active=false` then the
target to true; returns void.

## Pure helpers (unit-tested) — `features/retail/`

### `unitPrice.ts`
```
type BaseUnit = 'g' | 'ml' | 'piece';
normalizeSize(sizeValue, sizeUnit, packCount): { base: number, unit: BaseUnit } | null
unitPriceMinor(priceMinor, sizeValue, sizeUnit, packCount): { perBaseMinor: number, unit: BaseUnit } | null
```
Conversion table: weight g/kg/mg/oz/lb → g; volume ml/l/floz/gal → ml; count
piece/pc/pack/ct → piece. Unknown unit → null. `perBaseMinor` is a float (minor
units per base unit) used only for comparison/display, never persisted.

### `freshness.ts`
```
type Freshness = 'fresh' | 'recent' | 'stale';
freshnessOf(observedAtMs, nowMs): Freshness   // <24h fresh, <7d recent, else stale
```
(Relative label rendering stays in the screen via existing formatting.)

### `distance.ts`
```
haversineKm(a: {lat,lng}, b: {lat,lng}): number
```
Standard haversine, Earth radius 6371 km.

## Connector interface — `features/retail/connector.ts` (types only)
```
interface ProductSearchInput { query: string; countryCode?: string }
interface NormalizedProduct { gtin?: string; name: string; brand?: string;
  sizeValue?: number; sizeUnit?: string; packCount?: number }
interface PriceLookupInput { retailerProductId: string; storeId?: string }
interface NormalizedPrice { regularMinor: number; saleMinor?: number;
  memberMinor?: number; currencyCode: string; observedAt: string;
  validUntil?: string; source: string }
interface RetailerConnector {
  retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
}
```
No implementations this slice. Not imported by UI. Documents the 5d contract.

## Data layer — `features/retail/{schemas.ts, api.ts}`

`schemas.ts` — zod: `createRetailerSchema`, `createStoreSchema`,
`createProductSchema`, `createRetailerProductSchema`, `createPriceSchema`,
`createSavedLocationSchema`. Prices entered in major units → minor at the screen.

`api.ts` — CRUD for all tables plus:
- `listRetailers(hid)`, `createRetailer`, `deleteRetailer`
- `listStores(retailerId)`, `createStore`
- `listProducts(hid)`, `createProduct`
- `listRetailerProducts(productId)`, `createRetailerProduct`
- `listPricesForProduct(productId)` → snapshots joined with retailer_product,
  retailer, and store (name/currency/lat/lng) for display + unit-price + distance
- `createPrice`, `deletePrice`
- `listSavedLocations(hid)`, `createSavedLocation`, `setActiveLocation(id)` (RPC)

## Screens — `app/retail/` stack (entered from More tab)
- `_layout.tsx` — stack with localized titles.
- `index.tsx` — retail hub: active-location switcher (from saved locations),
  retailers list + add, links to Products and Saved Locations.
- `[retailerId].tsx` — a retailer's branches list + add branch.
- `products.tsx` — products list + add product; tap → product detail.
- `product/[id].tsx` — a product's prices across branches: each row shows store
  name, price (regular/sale/member), normalized unit-price, and freshness label;
  sorted cheapest-first (and nearest-first when GPS coords are available). Add a
  price snapshot (pick a retailer_product + optional store). Uses `unitPrice`,
  `freshness`, `distance`.
- `locations.tsx` — saved locations list + add (label + pick a branch) + set
  active; "use current location" requests GPS (`expo-location`, web fallback via
  `navigator.geolocation`) and lists nearest branches by `haversineKm`.

The More tab (`app/(tabs)/more.tsx`) gains a link to `/retail`.

## Other
- Add dependency `expo-location` (Expo SDK-matched version).
- `retail.*` i18n keys in `locales/{en,fil,ar}.json` (matching key sets).
- Row types in `lib/database.types.ts`: `RetailerRow`, `RetailerStoreRow`,
  `ProductRow`, `RetailerProductRow`, `PriceSnapshotRow`, `SavedLocationRow`.

## Tests
- Unit: `tests/retail/unitPrice.test.ts`, `tests/retail/freshness.test.ts`,
  `tests/retail/distance.test.ts`.
- RLS: extend `tests/integration/rls-isolation.mjs` — A creates a
  retailer/store/product/retailer_product/price + saved location; B (non-member)
  cannot read/write any; `set_active_saved_location` refuses a non-writer;
  price currency follows the store; after joining B can read them.

## Success criteria
- A household can build a retail catalog by hand and view a product's prices
  across its branches with normalized unit-price + freshness, cheapest-first.
- Saved locations can be added, switched, and sorted by GPS proximity.
- Household isolation holds for all retail tables (RLS test passes).
- `typecheck` clean, all unit tests pass.

## Out of scope (this slice)
Coupons/promotions, basket/price comparison across a grocery list, live
connectors/Edge Function, loyalty OAuth, global catalog, separate variants table,
geocoding/postal-code search, travel-optimized routing.


## spec 2026-08-12-phase5b-coupons-design

# Phase 5 Slice 5b — Coupons — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5b of Phase 5 (Retail Intelligence). Builds on 5a's household-scoped retail
catalog (retailers, retailer_products, price_snapshots). Adds **coupons**: a
code/clip-able discount applied on top of the shelf/sale price, with a savings
engine and Level-1 discovery. Follows Phases 1–5a patterns: Supabase + RLS
(writer/viewer), integer-minor-unit money, `features/<domain>` boundary, screens
under `app/`, i18n in three locales, pure helpers unit-tested.

Phase 5 decomposition: 5a done; **5b (this doc) = coupons**; 5c = price
comparison / basket + grocery↔product linking; 5d = live connectors, loyalty
OAuth, global catalog.

## Locked design decisions

1. **Coupon model: fixed or percent**, with optional min-purchase threshold and
   an optional max-discount cap (percent). Scoped to a retailer, optionally
   narrowed to one `retailer_product`. Has an optional code, source URL (Level-1
   "where to clip"), and start/expiry dates. No BOGO / quantity tiers / usage
   limits / loyalty requirements this slice (5d).
2. **Grocery matching deferred to 5c.** 5b coupons live in the retail module.
   The grocery-list ↔ product bridge (and coupon-to-grocery-item surfacing) is
   designed holistically in 5c.
3. **No separate promotions table.** A "promotion" is already a price snapshot
   whose `sale_price_minor` is set (5a). A coupon stacks on top of the effective
   shelf price = `min(regular, sale)`.

## Money & currency invariants

- Fixed coupons carry `currency_code`; a fixed coupon applies only to a price in
  the same currency (the helper returns `applicable: false` otherwise).
- Percent coupons are currency-agnostic; savings compute in the price's currency.
- All amounts are integer minor units.

## Data model — migration `20260812000007_coupons.sql`

### `coupons`
| column                | type          | notes                                            |
|-----------------------|---------------|--------------------------------------------------|
| `id`                  | uuid pk       | `gen_random_uuid()`                              |
| `household_id`        | uuid          | fk → households, cascade                         |
| `retailer_id`         | uuid not null | fk → retailers, cascade                          |
| `retailer_product_id` | uuid          | nullable; fk → retailer_products, cascade        |
| `title`               | text not null |                                                  |
| `code`                | text          | nullable                                         |
| `source_url`          | text          | nullable (Level-1 link)                          |
| `notes`               | text          | nullable                                         |
| `discount_type`       | text not null | check `in ('fixed','percent')`                   |
| `discount_amount_minor` | bigint      | nullable; `>= 0`; set for fixed                  |
| `discount_percent`    | numeric       | nullable; `> 0 and <= 100`; set for percent      |
| `currency_code`       | text          | nullable; `^[A-Z]{3}$`; set for fixed            |
| `min_purchase_minor`  | bigint        | nullable; `>= 0`                                 |
| `max_discount_minor`  | bigint        | nullable; `>= 0` (cap, mainly for percent)       |
| `starts_at`           | timestamptz   | nullable                                         |
| `expires_at`          | timestamptz   | nullable                                         |
| `created_by`          | uuid not null | fk → auth.users                                  |
| `created_at`/`updated_at` | timestamptz | `set_updated_at()` trigger                      |

CHECK `chk_coupon_shape`:
`(discount_type = 'fixed'   and discount_amount_minor is not null and currency_code is not null and discount_percent is null)`
`or (discount_type = 'percent' and discount_percent is not null and discount_percent > 0 and discount_percent <= 100 and discount_amount_minor is null)`

Index `(household_id, retailer_id)` and `(retailer_product_id)`.

### RLS (mirrors retail price rows)
- SELECT `is_member_of(household_id)`
- INSERT `has_role_in(household_id, ['owner','admin','member'])` and `created_by = auth.uid()`
- UPDATE writers (using + check)
- DELETE writers (coupons churn like prices)
- Grants `select, insert, update, delete` to `authenticated`.

## Pure helper — `features/retail/coupon.ts` (unit-tested)

```
type CouponStatus = 'scheduled' | 'active' | 'expired';

interface CouponLike {
  discount_type: 'fixed' | 'percent';
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

couponStatus(c: Pick<CouponLike,'starts_at'|'expires_at'>, nowMs: number): CouponStatus
// expired if expires_at < now; scheduled if starts_at > now; else active.

interface ApplyResult {
  applicable: boolean;
  finalMinor: number;      // base when not applicable
  savingsMinor: number;    // 0 when not applicable
  reason?: 'expired' | 'scheduled' | 'currency' | 'min_purchase';
}
applyCoupon(c: CouponLike, basePriceMinor: number, currencyCode: string, nowMs: number): ApplyResult
```

Rules (in order): status must be `active` (else reason expired/scheduled);
for fixed, `c.currency_code === currencyCode` (else reason `currency`);
`min_purchase_minor == null || base >= min` (else reason `min_purchase`).
Savings: fixed → `min(discount_amount_minor, base)`; percent →
`min(round(base * pct / 100), max_discount_minor ?? Infinity, base)`.
`finalMinor = base - savingsMinor` (never below 0).

## Data layer — `features/retail/couponApi.ts`

- `listCoupons(hid): CouponWithRefs[]` — joined with retailer + retailer_product display.
- `listCouponsForProduct(productId): CouponWithRefs[]` — coupons scoped to any of the
  product's `retailer_products`, OR retailer-wide (null `retailer_product_id`) for any
  retailer the product is sold at. (Two-step: fetch the product's retailer_products →
  gather retailer ids + retailer_product ids → `or(...)` filter.)
- `createCoupon(hid, input): CouponRow`
- `deleteCoupon(id): void`

Types: `CouponRow` in `lib/database.types.ts`; `CouponWithRefs` exported from couponApi.
Schema: `createCouponSchema` in `features/retail/schemas.ts` (amounts entered in major
units → minor at the screen boundary; percent entered as a number 0–100).

## Screens

- `app/retail/coupons.tsx` — discovery hub: active vs expired sections (via
  `couponStatus`), each row shows retailer/product scope, the discount, code, and a
  Level-1 source link when present. Add-coupon form: pick retailer (chips), optional
  product (chips from that retailer's products), type (fixed/percent), value, optional
  min-purchase, optional cap, expiry, code, URL. Linked from the retail hub
  (`app/retail/index.tsx`) and the `_layout` gets a `coupons` screen entry.
- `app/retail/product/[id].tsx` — add a **Coupons** section: coupons applicable to the
  product (via `listCouponsForProduct`), each showing expected **final price / savings**
  computed with `applyCoupon` against the product's cheapest current effective price
  (`min(regular, sale)`), skipping non-applicable ones (or labeling why).

## Other
- `coupons.*` i18n namespace in `locales/{en,fil,ar}.json` (matching key sets).
- `app/retail/_layout.tsx`: add `<Stack.Screen name="coupons" .../>`.
- `app/retail/index.tsx`: add a link to `/retail/coupons`.

## Tests
- Unit `tests/retail/coupon.test.ts`: `couponStatus` (scheduled/active/expired),
  `applyCoupon` for fixed, percent, percent-with-cap, below-min-purchase,
  currency-mismatch, expired, and final-never-below-zero.
- RLS: extend `tests/integration/rls-isolation.mjs` — A creates a coupon; the CHECK
  constraint rejects a malformed coupon (percent with an amount); B (non-member)
  cannot read/write; after joining B can read.

## Success criteria
- A household can record coupons and browse them by active/expired status.
- A product screen shows applicable coupons with correct expected final price/savings.
- Household isolation holds for coupons (RLS test passes).
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice)
Grocery-item matching (5c); BOGO / quantity tiers; usage-limit tracking; loyalty
requirements; Level-2 deep-link and Level-3 native clipping/activation; a separate
promotions table.


## spec 2026-08-12-phase5c-price-comparison-design

# Phase 5 Slice 5c — Price Comparison & Basket — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5c of Phase 5. Bridges Phase 4 grocery lists and the 5a/5b retail catalog:
link grocery items to catalog products, then compare what a list costs across
branches, find the cheapest single-store basket, and surface applicable coupons
per item. Follows established patterns (Supabase + RLS, integer-minor-unit money,
`features/<domain>` boundary, pure helpers unit-tested, i18n ×3).

Phase 5 decomposition: 5a foundation ✓; 5b coupons ✓; **5c (this doc) = price
comparison + grocery↔product linking**; 5d = live connectors, loyalty OAuth,
global catalog.

## Locked design decisions

1. **Grocery↔product link:** a nullable `product_id` FK on the existing
   `grocery_items` table, tagged manually (no fuzzy matching). Only linked items
   participate in comparison.
2. **Comparison model:** single-store cheapest with coverage flagging (each
   column shows its total AND how many linked items are unpriced there), plus a
   "best price anywhere" floor (one number, no multi-store routing).
3. **Coupons:** shown as *potential* savings per item (via 5b `applyCoupon`);
   ranked totals stay pre-coupon (we don't bake in min-purchase/usage/stacking
   assumptions we deliberately deferred).
4. **Currency:** comparison runs in the household **reporting currency**. Prices
   in other store currencies are excluded from ranked totals and flagged.
   Cross-currency comparison (FX) is deferred — the money invariant forbids
   mixing, and FX-converted rankings would be uncertain.

## Data model — migration `20260812000008_grocery_product_link.sql`

```sql
alter table public.grocery_items
  add column if not exists product_id uuid references public.products (id) on delete set null;
create index if not exists idx_grocery_items_product on public.grocery_items (product_id);
```

Extend `public.grocery_items_enforce_list()` (created in the Phase 4 migration) so
that, in addition to forcing `household_id` from the parent list, it verifies a
non-null `product_id` belongs to the same household:

```sql
create or replace function public.grocery_items_enforce_list()
returns trigger language plpgsql security definer set search_path = '' as $$
declare _h uuid; _ph uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then raise exception 'grocery list not found'; end if;
  new.household_id := _h;
  if new.product_id is not null then
    select household_id into _ph from public.products where id = new.product_id;
    if _ph is null or _ph <> _h then
      raise exception 'product does not belong to this household';
    end if;
  end if;
  return new;
end; $$;
```

(The trigger itself is unchanged — only the function body is replaced. RLS on
`grocery_items` is unchanged.)

## Pure helper — `features/retail/basket.ts` (unit-tested)

Keyed by an opaque `columnKey` so the helper stays pure; the caller (screen/api)
maps a physical branch or an online retailer to a `columnKey` + human label.

```
interface BasketItem { productId: string }
interface PricePoint { productId: string; columnKey: string; effectiveMinor: number }
interface ColumnTotal { columnKey: string; totalMinor: number; pricedCount: number; missingCount: number }

// Per column: sum effectiveMinor of items priced there; missingCount = linked
// items with NO price in that column. Sorted by totalMinor ascending.
compareColumns(items: BasketItem[], prices: PricePoint[]): ColumnTotal[]

// Best (lowest) price per item across ALL columns, summed. pricedCount = items
// that have at least one price anywhere. The theoretical floor.
bestFloorMinor(items: BasketItem[], prices: PricePoint[]): { totalMinor: number; pricedCount: number }
```

`effectiveMinor` is `min(regular_price_minor, sale_price_minor ?? regular)`, computed
by the caller when building `PricePoint`s. If an item appears multiple times in one
column (shouldn't after latest-reduction), the lowest is used.

## Data layer

- `features/grocery/api.ts`: add
  `setGroceryItemProduct(itemId: string, productId: string | null): Promise<void>`
  (updates `grocery_items.product_id`; the trigger validates household).
- `features/retail/basketApi.ts`:
  `getBasketPrices(productIds: string[], currencyCode: string): Promise<{ prices: PricePoint[]; labels: Record<string, string> }>`
  - Query `price_snapshots` joined `retailer_product:retailer_products(product_id, retailer:retailers(id,name))`,
    `store:retailer_stores(id,name,currency_code)`, filtered to `currency_code = currencyCode`
    and the products' `retailer_products`. (Fetch the products' retailer_product ids first, like couponApi.)
  - Build `columnKey` = `store.id` for a branch, or `online:{retailerId}` when `store_id` is null.
  - `label` = branch name, or `"Online · {retailer name}"`.
  - Reduce to the latest snapshot per `(productId, columnKey)`; `effectiveMinor = min(regular, sale ?? regular)`.

## Screens

- `app/grocery/[id].tsx` (edit): for each item show its linked product (or a
  "Link product" affordance) that routes to `/grocery/link/{itemId}`; add a
  **Compare prices** button routing to `/grocery/compare/{listId}` (only when the
  list has ≥1 linked item). Requires new stack entries in
  `app/grocery/_layout.tsx` for `link/[itemId]` and `compare/[id]`.
- `app/grocery/link/[itemId].tsx` (new): lists the household's products; tapping
  one calls `setGroceryItemProduct(itemId, productId)` and navigates back; an
  "Unlink" action clears it.
- `app/grocery/compare/[id].tsx` (new): loads the list's linked items, calls
  `getBasketPrices` with the reporting currency, runs `compareColumns` +
  `bestFloorMinor`, and renders:
  - a ranked list of columns: `label`, total (in reporting currency), and coverage
    (`pricedCount`/total, `missingCount` flagged)
  - the best-price-anywhere floor
  - per-item potential coupon savings: for each linked item, `listCouponsForProduct`
    + `applyCoupon` against the item's best price; sum the applicable savings into a
    single "potential coupon savings" figure (shown separately, not deducted).

## Other
- `GroceryItemRow` in `lib/database.types.ts` gains `product_id: string | null`.
- i18n: add `grocery.linkProduct`, `grocery.linkedTo`, `grocery.unlink`,
  `grocery.compareCta`, and a `grocery.compare.*` sub-block (title, columnTotal,
  coverage, floor, potentialSavings, noLinked, notInCurrency) in en/fil/ar with
  matching key sets.

## Tests
- Unit `tests/retail/basket.test.ts`: `compareColumns` (totals, coverage/missing,
  sorting), `bestFloorMinor` (floor across columns, pricedCount), empty inputs.
- RLS: extend `tests/integration/rls-isolation.mjs` — A links a grocery item to a
  product (via update); the trigger rejects linking a product from another household
  (use B's household product id — expect error); after linking, the item's
  `product_id` reads back.

## Success criteria
- A household can link list items to catalog products and see per-branch basket
  totals (reporting currency) with coverage, a best-price floor, and potential
  coupon savings.
- The trigger blocks cross-household product links.
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice)
Multi-store routing optimization; cross-currency (FX) comparison; auto-applying
coupons into ranked totals; live price sourcing (5d).


## spec 2026-08-12-phase5d-connector-architecture

# Phase 5 Slice 5d (architecture subset) — Connector Pipeline — Design & ADR

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5d of Phase 5 is **live retailer connectors + loyalty OAuth + a global
catalog**. Those require external prerequisites that don't exist yet — an
authorized retailer API / licensed feed / partnership, and registered OAuth apps.
The retail spec (06) is explicit: **never scrape, never fake clipping, never put
retailer secrets in client code**, and live calls must flow
`Mobile/Web → our Price API/Edge Function → normalized cache → connectors →
authorized sources`.

So this slice builds only the **architecture subset that needs no credentials**:
the normalization→persist pipeline, a reference (mock) connector proving the
interface, and this ADR documenting how real adapters will plug in. No migration,
no live network calls, no UI, no faked clipping.

## Locked scope

Build:
1. Pure `buildPriceInserts(...)` — map connector `NormalizedPrice[]` → `price_snapshots` insert rows.
2. `mockConnector` — a `RetailerConnector` backed by a static fixture (dev/test only).
3. `ingestFromConnector(...)` — reference runner composing connector → normalize → persist.
4. Unit tests for the pure mapping and the mock connector.
5. This ADR.

Explicitly deferred (needs an authorized source / credentials):
- Any real retailer adapter (Walmart/Kroger/etc.).
- The deployed Supabase Edge Function that runs real connectors server-side.
- Loyalty account linking via OAuth.
- The populated global (cross-household) catalog.

## Reuses (no new schema)

- `price_snapshots` table (5a) — ingest target.
- `features/retail/connector.ts` (5a) — the types-only interface: `RetailerConnector`,
  `NormalizedProduct`, `NormalizedPrice`, `ProductSearchInput`, `PriceLookupInput`.
- `features/retail/api.ts` `createPrice(hid, CreatePriceMinorInput)` — persistence.

## Components

### 1. Pure normalization — `features/retail/ingest.ts`

```
interface PriceInsertRow {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;   // uppercased, validated ^[A-Z]{3}$
  source: string;
}

buildPriceInserts(
  retailerProductId: string,
  storeId: string | undefined,
  prices: NormalizedPrice[],
): PriceInsertRow[]
```

Rules: skip any `NormalizedPrice` with an invalid currency (`!/^[A-Z]{3}$/`) or a
non-finite/negative `regularMinor`; uppercase the currency; carry through
`saleMinor`/`memberMinor` only when present and `>= 0`; default `source` to the
connector value or `'connector'`. Pure — no I/O, fully unit-testable. Shape aligns
with `CreatePriceMinorInput` so the runner can persist directly.

### 2. Reference connector — `features/retail/connectors/mockConnector.ts`

A `RetailerConnector` whose `searchProducts` / `fetchPrice` return values from a
static in-memory fixture. Header comment states plainly: **dev/test fixture only,
not a live retailer, performs no network calls and no coupon clipping.** Exists to
prove the interface is implementable and to exercise the pipeline in tests.

### 3. Reference ingest runner — `features/retail/ingest.ts`

```
ingestFromConnector(
  householdId: string,
  connector: RetailerConnector,
  retailerProductId: string,
  storeId?: string,
): Promise<number>   // count of snapshots inserted
```

Composes `connector.fetchPrice({ retailerProductId, storeId })` →
`buildPriceInserts(...)` → `createPrice(householdId, row)` per row; returns the
count. This is the exact logic a production **Edge Function** would run
server-side. Locally it works against `mockConnector`. Not wired to any screen.

## ADR — how real connectors plug in later

- **Where they run:** real adapters run inside a Supabase **Edge Function**, never
  on device. The client calls the Edge Function ("our Price API"); the function
  holds retailer credentials (from Edge secrets), calls the authorized source,
  normalizes, and upserts `price_snapshots`. `ingestFromConnector` is that
  function's core, already written and tested here.
- **Interface stability:** new adapters implement `RetailerConnector`; no schema or
  pipeline change needed — only a new file + registration in the Edge Function.
- **Loyalty:** OAuth/account-linking per retailer, tokens stored server-side
  (encrypted), never in the client. A future `loyalty_connections` table + an Edge
  Function OAuth callback. Out of scope until a retailer program is available.
- **Global catalog:** an authorized feed populates a read-only global catalog
  (separate from household-scoped rows); households reference global products.
  Requires a governed data source; out of scope now.
- **Data-source rule:** only official APIs / licensed feeds / partner / permitted
  affiliate / authorized datasets / merchant-provided data. No unauthorized
  scraping. No guaranteed real-time checkout-price claims unless the source
  contract supports it.

## Tests — `tests/retail/ingest.test.ts`

- `buildPriceInserts`: maps a valid `NormalizedPrice` (regular+sale) to one row;
  uppercases currency; skips an invalid-currency entry; skips a negative regular;
  omits `saleMinor`/`memberMinor` when absent; empty input → `[]`.
- `mockConnector`: `fetchPrice` returns the fixture's prices for a known id and
  `[]` for an unknown id; `buildPriceInserts` over `mockConnector.fetchPrice(...)`
  yields the expected rows (pipeline composition, no DB).

## Success criteria
- `buildPriceInserts` and `mockConnector` are unit-tested and pass.
- `ingestFromConnector` typechecks and composes the tested pieces.
- The ADR documents the real-connector / loyalty / global-catalog boundary.
- `typecheck` clean; all unit tests pass. (No migration, no `test:rls` change.)

## Out of scope
Everything requiring credentials or an authorized data source (see "deferred"),
plus any UI. When a source exists, execute the ADR: add a real adapter + deploy
the Edge Function around `ingestFromConnector`.


## spec 2026-08-12-phase6a-entitlements-design

# Phase 6 Slice 6a — Entitlements & Feature Gating — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Phase 6 (Commercialization) = plans, entitlements, Apple/Google/web billing,
regional pricing, restore, webhooks. The live billing pieces are blocked on
external accounts (App Store Connect, Play Console, Stripe) and a backend. So
Phase 6 splits:

- **6a (this doc) — entitlements & feature gating:** the plan/entitlement model,
  a pure resolver, a client provider + gate mechanism, a manual (pre-billing)
  grant, and real gates on two premium features. Fully buildable now.
- **6b — billing integrations:** Apple IAP / Google Play / Stripe-web adapters, a
  webhook reconciliation Edge Function, restore purchase, regional pricing.
  Deferred; documented as an ADR so it drops onto 6a's model unchanged.

Follows established patterns: Supabase + RLS, `features/<domain>` boundary, a
React context provider (like `ActiveHouseholdProvider`), pure helpers unit-tested,
i18n ×3.

## Locked design decisions

1. **Per-household entitlement.** A subscription covers the whole household; gates
   check the *active household's* plan. (App-store purchases, tied to one payer's
   account, map to "payer upgrades the household.")
2. **Capability flags.** Each plan grants a set of named capabilities; a gate is
   "does the active plan include capability X?" The plan→capabilities map lives in
   one module. No numeric limits this slice.
3. **Manual grant (pre-billing).** An owner can switch the household plan on a
   Subscription screen for now; the row carries a `source` so 6b billing writes
   the same table. Owner-gated, labeled a placeholder, flagged for removal/guard
   before launch.

## Data model — migration `20260812000009_entitlements.sql`

### `household_subscriptions`
| column               | type          | notes                                              |
|----------------------|---------------|----------------------------------------------------|
| `id`                 | uuid pk       | `gen_random_uuid()`                                |
| `household_id`       | uuid not null | fk → households, cascade; **unique** (one per hh)  |
| `plan_code`          | text not null | check `in ('free','premium')`, default `'free'`    |
| `status`             | text not null | check `in ('active','canceled','expired')`, default `'active'` |
| `source`             | text not null | check `in ('manual','apple','google','stripe')`, default `'manual'` |
| `current_period_end` | timestamptz   | nullable (null = no expiry, e.g. manual/free)      |
| `updated_by`         | uuid          | fk → auth.users, nullable                          |
| `created_at`/`updated_at` | timestamptz | `set_updated_at()` trigger                        |

**No row = free** (the resolver treats absence as the free plan).

### RLS
- SELECT: `is_member_of(household_id)` (all members see the plan)
- INSERT/UPDATE/DELETE: `has_role_in(household_id, ['owner'])` — only the owner
  manages the subscription directly. (6b billing writes via the service role in a
  webhook Edge Function, which bypasses RLS.)
- Grants: `select, insert, update, delete` to `authenticated`.

### RPC `set_household_plan(_household_id uuid, _plan_code text) returns void`
`security definer`, `search_path=''`. Verifies caller `has_role_in(hh, ['owner'])`
and `_plan_code in ('free','premium')`; upserts the household's row
(`on conflict (household_id) do update`) setting `plan_code`, `status='active'`,
`source='manual'`, `current_period_end=null`, `updated_by=auth.uid()`. This is the
6a manual grant.

## Pure plan logic — `features/billing/plans.ts` (unit-tested)

```
export type PlanCode = 'free' | 'premium';
export type Capability =
  | 'multi_currency_dashboard'
  | 'retail_comparison'
  | 'coupons'
  | 'multiple_households'
  | 'unlimited_goals';

export const PLAN_CAPABILITIES: Record<PlanCode, Capability[]>;
// free: []; premium: [all five]

planIncludes(plan: PlanCode, cap: Capability): boolean

interface SubscriptionLike {
  plan_code: PlanCode; status: string; current_period_end: string | null;
}
resolvePlan(sub: SubscriptionLike | null, nowMs: number): PlanCode
// null -> 'free'; status !== 'active' -> 'free';
// plan 'premium' with current_period_end < now -> 'free'; else sub.plan_code
```

## Client

- `features/billing/api.ts`:
  - `getHouseholdSubscription(householdId): Promise<HouseholdSubscriptionRow | null>`
  - `setHouseholdPlan(householdId, planCode: PlanCode): Promise<void>` (RPC)
- `features/billing/EntitlementsProvider.tsx`: on active-household change, loads the
  subscription, computes `plan = resolvePlan(sub, Date.now())` and the capability
  set. Exposes `usePlan(): { plan: PlanCode; has: (c: Capability) => boolean; loading: boolean; refresh: () => void }`.
  Mounted inside `ActiveHouseholdProvider` in `app/_layout.tsx` (or the provider
  tree that already wraps authed screens).
- `app/subscription.tsx`: shows the current plan and its capabilities. If the
  caller is the household **owner**, shows a free/premium toggle (calls
  `setHouseholdPlan` then `refresh()`), with a visible "pre-billing placeholder"
  note. Linked from `app/(tabs)/more.tsx`.
- **Gates on real features:**
  - `app/grocery/compare/[id].tsx` → requires `retail_comparison`
  - `app/retail/coupons.tsx` → requires `coupons`
  Locked state: a card with a "Premium feature" message + a link to `/subscription`,
  shown instead of the feature body when `!has(capability)`.

## Other
- `HouseholdSubscriptionRow` (and reuse `PlanCode` from `plans.ts`) in
  `lib/database.types.ts`.
- `billing.*` i18n in en/fil/ar (plan names, capability labels, manage/toggle,
  locked-feature prompt, placeholder note) with matching key sets.
- `app/_layout.tsx` (or wherever `ActiveHouseholdProvider` is mounted): wrap with
  `EntitlementsProvider`.

## Tests
- Unit `tests/billing/plans.test.ts`: `planIncludes` (free excludes, premium
  includes); `resolvePlan` (null→free, canceled→free, expired premium→free, active
  premium→premium, active free→free).
- RLS: extend `tests/integration/rls-isolation.mjs` — owner A sets the household to
  premium via `set_household_plan` and it reads back; a non-owner member cannot set
  the plan (RPC raises); B (non-member) cannot read or set A's subscription; after
  B joins as a member, B can read the plan but still cannot set it.

## Success criteria
- An owner can switch the household plan on the Subscription screen; gated features
  lock/unlock accordingly across the household.
- `resolvePlan` correctly treats missing/expired/canceled as free.
- RLS: only owners write the subscription; members read; non-members are blocked.
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice → 6b)
Any real purchase flow (Apple IAP, Google Play, Stripe/web), webhooks and state
reconciliation, restore purchase, regional pricing, numeric/metered limits. The
manual toggle is a placeholder to be guarded/removed before launch. See the 6b ADR
(`2026-08-12-phase6b-billing-architecture.md`).


## spec 2026-08-12-phase6b-billing-architecture

# Phase 6 Slice 6b — Billing Integrations — ADR (deferred)

Date: 2026-08-12
Status: Deferred — blocked on external accounts. Documented so it executes onto
6a's model unchanged when accounts exist.

## Why deferred

Live billing needs external prerequisites that don't exist yet:
- **Apple:** App Store Connect account, subscription products, StoreKit.
- **Google:** Play Console account, subscription products, Play Billing.
- **Web:** a payment processor account (e.g. Stripe) with API keys.
- **Backend:** a server (Supabase Edge Function) to receive webhooks and hold
  secrets — retailer/processor secrets must never ship in the client.

Building these against nonexistent credentials would be speculative scaffolding.
6a already ships the model and gates everything writes into.

## The contract 6b writes into (from 6a)

`household_subscriptions` — one row per household, with `plan_code`, `status`,
`source` (`manual|apple|google|stripe`), `current_period_end`. 6a's manual grant
writes `source='manual'`. Every 6b path writes the SAME row with its own `source`;
`resolvePlan(sub, now)` already turns that row into the effective plan. No schema
change is required for 6b — only new writers.

## Architecture

```
Mobile (Apple/Google IAP)  ─┐
Web (Stripe Checkout)       ─┼─> purchase → store/processor
                             │
store/processor webhook  ──> Supabase Edge Function (secrets server-side)
                             └─> verify → upsert household_subscriptions (service role)
                                   plan_code/status/source/current_period_end
Client reads household_subscriptions via RLS → EntitlementsProvider → gates
```

- **Apple IAP:** `expo-in-app-purchases` or RevenueCat; verify receipts
  server-side; map product → `plan_code`; write row `source='apple'`.
- **Google Play billing:** Play Billing via the same IAP layer / RevenueCat;
  verify purchase tokens server-side; write `source='google'`.
- **Web:** Stripe Checkout + Customer Portal; Stripe webhooks
  (`checkout.session.completed`, `customer.subscription.updated/deleted`) →
  Edge Function → write `source='stripe'`, set `current_period_end`.
- **Restore purchase:** re-query the store for active entitlements; re-upsert the
  row. (Web: the portal is the source of truth.)
- **Regional pricing:** prices come from the store/processor per storefront —
  never a single USD model. The client displays store-provided localized prices;
  our DB stores only the resulting `plan_code`, not prices.
- **Cancellation/expiry:** webhooks set `status='canceled'` / `current_period_end`;
  `resolvePlan` downgrades to free automatically at expiry.

## Payer → household mapping

A purchase is tied to one Apple/Google/Stripe account (the payer). On success the
Edge Function upserts the payer's **active household** subscription (or a household
id passed through the purchase metadata). Per-household entitlement (6a decision)
means one payer upgrades the whole household.

## Security / rules

- Secrets (receipt-validation keys, Stripe secret key, webhook signing secrets)
  live in Edge Function secrets — never in `EXPO_PUBLIC_*` or client code.
- Webhook handlers verify signatures before writing.
- The 6a **manual toggle must be removed or hard-guarded** (e.g. dev-only build
  flag) before production launch — it's a free-premium hole otherwise.

## Reuses (already built in 6a)

- `household_subscriptions` table + RLS.
- `features/billing/plans.ts` (`resolvePlan`, `PLAN_CAPABILITIES`).
- `EntitlementsProvider` / `usePlan()` — no change; it just reads the row.
- `app/subscription.tsx` — becomes the real "Manage subscription" entry point
  (buttons route to store purchase / Stripe Checkout instead of the manual toggle).

## When to execute

When there is at least one funded store/processor account + a deployed Edge
Function. Start with one path (likely Stripe web or one store), verify the
webhook→row→gate loop end-to-end, then add the others.


## spec 2026-08-12-phase7-globalization-design

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


## spec 2026-08-12-phase8-security-audit

# Phase 8 — Security / QA / Hardening — Audit

Date: 2026-08-12 (closed 2026-08-13)
Status: **COMPLETE** for everything buildable without external accounts.
Deferred with reasons: payment tests (blocked on 6b billing accounts), crash
monitoring (needs a Sentry-class account), backup/PITR review (Supabase
dashboard ops, human), list virtualization (feeds are query-capped at 50 —
revisit with pagination). Session assertions were added to `rls-isolation.mjs`
and run on the next service-key drill.

Next phase: **Phase 9 — Beta** (founder + spouse + trusted users, then
TestFlight / Play testing track / web beta). Entry needs human decisions:
web hosting target for the PWA, Apple/Google developer accounts, and a real
Site URL + redirect allow-list in Supabase auth settings.

## Secret & client-surface audit — PASS

- **No service-role or non-public secret in client code** (`app/`, `features/`,
  `lib/`, `components/`). The only `service_role` reference is `lib/logger.ts`'s
  redaction denylist (scrubs `token`/`secret`/`service_role`/`cvv`/… from logs) —
  defensive, not a leak.
- **No non-public `process.env` reads** in client code — env flows only through
  `lib/env` (`EXPO_PUBLIC_*`).
- **Service-role key confined to `tests/integration/rls-isolation.mjs`** (added to
  `.env` temporarily for the RLS test, then removed).
- **`.env` is git-ignored and not tracked.** No hardcoded JWTs / `sk_live` /
  `sk_test` / api keys / bearer tokens anywhere in client code.

## RLS / data-layer audit — PASS (already verified live)

- Every household-scoped table has RLS enabled with the uniform pattern
  (`is_member_of` select; `has_role_in` writes). Verified end-to-end by
  `npm run test:rls` — **62/62** including cross-household denial + post-join access.
- `security definer` RPCs all set `search_path = ''` and re-check role
  (`create_transfer`, `complete_grocery_list`, `set_active_saved_location`,
  `set_household_plan`). Triggers enforce household + currency invariants.
- Monetization: subscription writes are owner-only; the 6a manual plan toggle is
  `__DEV__`-gated (no free-premium hole in production).

## Remaining Phase 8 QA items (scoped for a focused session)

These are the roadmap's remaining hardening items (`context/build-plan.md`); each
is buildable without external accounts except where noted:

1. **Auth / session tests** — ✅ pure slice DONE (2026-08-13): `mapAuthError`
   extracted to `features/auth/errors.ts` + mapping/locale-resolution tests
   (`tests/auth/errors.test.ts`). REMAINING: live sign-in/out + session
   persistence assertions in the integration harness (needs the temporary
   service-role key drill, human-run like `test:rls`).
2. **Money / FX tests** — ✅ DONE (2026-08-13): fixed `toMinorUnits` negative-half
   rounding (was toward +∞, now half-away-from-zero per its contract), added
   deterministic property round-trips across exponents 0/2/3, float-trap cases,
   and `sumInReporting` edges (deduped missing, empty, case, negatives, KWD).
3. **Account deletion / data export** — ✅ DONE & VERIFIED LIVE (2026-08-13; see
   `2026-08-13-account-deletion-export-design.md` + plan): `delete_my_account()`
   RPC with owner-handoff block, attribution FKs → set-null, full-household JSON
   export (client-side over RLS readers), `/account` screen behind More.
   Migrations `20260813000010_account_deletion.sql` AND
   `20260813000011_fix_last_owner_guard.sql` applied; `test:rls` **72/72**.
   The drill surfaced a Phase-2 latent bug: `protect_last_owner()` fired on the
   member-row FK cascade and made ALL household deletion impossible — fixed by
   early-returning when the household row is already gone. Bonus: 19 orphaned
   test users from every prior `test:rls` run (cleanup had been silently
   blocked by that same bug) were purged via the new RPC.
4. **Network-failure UX** — ✅ DONE (2026-08-13): `ErrorNotice` primitive
   (message + Retry) wired into home / transactions / grocery / budgets error
   states; `common.retry` in en/fil/ar. Remaining screens (retail/household/
   goals/debts) can adopt it opportunistically when next touched.
5. **Performance** — list virtualization DEPRIORITIZED for now: every feed is
   query-capped (`listTransactions` limit 50; other lists similarly bounded), so
   ScrollView+map is fine at current scale. Revisit if caps are raised or
   pagination lands.
6. **Crash monitoring** — wire an error reporter (e.g. Sentry) — needs an account.
7. **Backup/recovery review** — Supabase PITR / backup policy (ops, not code).

Also DONE (2026-08-13, adjacent hardening): `useActionSheet`/`ActionSheetDialog`
— Alert.alert is a no-op on react-native-web, so the transactions "+" chooser
and delete confirm now fall back to a token-styled modal on web (native keeps
the platform Alert).


## spec 2026-08-13-account-deletion-export-design

# Account deletion & data export — design

Date: 2026-08-13
Status: Approved (Approach A: SQL RPC deletion + client-side export)
Phase: 8 (Security/QA/Hardening), QA item 3

## Goal

GDPR-style self-service: a signed-in user can (a) download everything their RLS
access already lets them see, and (b) permanently delete their account, without
support tickets, service keys on the client, or new infrastructure.

## Decisions (user-approved)

1. **Owner handoff is blocking.** Deleting an account that owns a household with
   other members is refused with a typed error; the user must transfer
   ownership, remove the members, or delete the household first. Households
   where the user is the **sole member** are deleted with all their data.
2. **Export = full household JSON.** One JSON file containing every household
   the user belongs to, with all rows their RLS access returns. No CSVs, no
   personal-data-only filtering.
3. **Mechanism = Approach A.** Deletion is a `security definer` RPC in a
   hand-applied migration; export is pure client code over the existing
   `features/*/api.ts` readers. No Edge Functions.

## 1. Migration `supabase/migrations/20260813000010_account_deletion.sql`

### 1a. FK groundwork (verified against existing migrations)

Already correct: every `household_id` FK cascades from `households`;
`household_members.user_id` and `profiles.id` cascade from `auth.users`.

Must change — columns referencing `auth.users` with NO delete action (deleting
the auth row would violate them in surviving shared households):

| Change to `on delete set null` + drop `not null` | Tables |
|---|---|
| `created_by` | households, accounts*, categories*, transactions, fx_rate_snapshots, budgets, budget_allocations*, goals, goal_contributions, debts, debt_payments, grocery_lists, retailers, retailer_stores, products, retailer_products, prices, coupons |
| `added_by`, `purchased_by` (already nullable) | grocery_list_items |

\* only where the column exists — the implementation enumerates by grepping each
`create table` in the migrations; any table without the column is skipped.

| Change to `on delete cascade` | Tables |
|---|---|
| `invited_by` | household_invitations (pending invites die with the inviter) |

`household_subscriptions.updated_by` is already nullable → just add
`on delete set null`.

Semantics: shared history **survives** a member's departure; attribution is
removed (UI already falls back, e.g. `grocery.someone`).

### 1b. RPC

```sql
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
```

Steps (single transaction, `auth.uid()` as `_uid`, raise `unauthorized` if null):

1. **Block:** if any household exists where `_uid` has role `owner` and the
   household has ≥ 2 members → `raise exception using errcode = 'P0001',
   message = 'owner_handoff_required'`.
2. **Sole-member households:** delete every household where `_uid` is the only
   member (any role — includes orphaned memberships). Cascades wipe all data.
3. **Leave the rest:** nothing to do explicitly — `household_members.user_id`
   cascades when the auth row goes; content FKs null out per 1a.
4. `delete from auth.users where id = _uid;`

`grant execute on function public.delete_my_account() to authenticated;`
(revoke from `anon`/`public`.)

## 2. Export — `features/account/`

- **`export.ts` (pure, unit-tested):** `buildExport(input) -> AccountExport` —
  takes already-fetched per-household row bundles plus `exportedAt: string`
  (ISO) and shapes `{ exportedAt, user: { id, email }, households: [{ household,
  members, accounts, balances, categories, transactions, fxRates, budgets,
  allocations (status rows), goals, contributions?, debts, grocery: { lists,
  items }, retail: { retailers, stores, products, retailerProducts, prices },
  coupons }] }`. Also `exportFilename(exportedAt)` →
  `household-export-YYYYMMDD-HHmmss.json`. Contribution/payment child rows are
  included where an existing list API exists; none are added just for export.
- **`exportApi.ts` (IO):** loops the user's households, calls the existing
  readers (`features/household|finance|grocery|retail/api.ts` +
  `planningApi`/`fxApi`/`couponApi`), returns the bundles. RLS is the scope
  boundary — the export can never contain more than the user can already read.
- **`api.ts` (IO):** `deleteMyAccount()` → `rpc('delete_my_account')`; maps the
  `owner_handoff_required` message to `AppError('forbidden', messageKey:
  'account.errors.ownerHandoff')`; other failures →
  `account.errors.deleteFailed`.
- **Delivery:** web → `Blob` + anchor download; native → `expo-file-system`
  cache write + `expo-sharing` share sheet (install `expo-sharing` if absent).
  Platform fork lives in one small `saveExport.ts` helper.

## 3. UI — `app/account.tsx`

New stack route (native header, title `account.title`), reached from a new
`ListRow` (icon `user`) on the More tab, placed above the sign-out button.

- **Export card:** body copy + secondary Button `account.exportCta`; busy
  spinner while assembling; errors via `ErrorNotice` (retry).
- **Danger zone card:** heading `account.deleteTitle`, warning copy
  `account.deleteWarning` (irreversible; owner-handoff rule mentioned), then
  the arm-and-confirm flow: TextField `account.typeEmailLabel` — the destructive
  Button `account.deleteCta` stays disabled until the input equals the user's
  email (case-insensitive) — then an ActionSheet confirm
  (`account.confirmTitle` / `account.confirmBody`) actually calls
  `deleteMyAccount()`. On success: local `signOut()`; the auth gate lands on
  /login. `owner_handoff_required` renders inline via `ErrorNotice` (no retry).

This is the interim step-up per `context/architecture.md` §security (real MFA/biometric step-up is a
later phase).

## 4. i18n (en/fil/ar, matching key sets)

`account.title, .open, .exportTitle, .exportBody, .exportCta, .deleteTitle,
.deleteWarning, .typeEmailLabel, .deleteCta, .confirmTitle, .confirmBody,
.errors.ownerHandoff, .errors.deleteFailed, .errors.exportFailed`

## 5. Types

`lib/database.types.ts`: affected `created_by`-style Row fields become
`string | null` (Insert paths unchanged — the app still writes them).

## 6. Testing

- **Unit:** `tests/account/export.test.ts` — shaping, filename, empty
  households, multi-household ordering.
- **Live RLS (extend `tests/integration/rls-isolation.mjs`):**
  1. owner-with-member calls RPC → refused with `owner_handoff_required`;
  2. after removing the member, RPC succeeds → auth user gone, household rows
     gone;
  3. a second household where the deleted user was a plain member survives with
     their transactions intact and `created_by` null;
  4. `anon` cannot execute the RPC.
- Gates: `tsc --noEmit`, `npm test`, `expo lint`, i18n parity, web export.

## Out of scope

MFA/biometric step-up, CSV export, Edge Functions, export of other users'
emails beyond what member listing already exposes, scheduled/automatic exports.

## Manual steps (human)

1. Paste `20260813000010_account_deletion.sql` into the Supabase SQL editor.
2. Temporarily add `SUPABASE_SERVICE_ROLE_KEY` to `.env` → `npm run test:rls`
   → remove the key.


## spec 2026-08-13-phase9-beta-runbook

# Phase 9 — Beta runbook

Date: 2026-08-13
Status: ENTRY — blocked on human decisions/accounts listed below; everything
code-side is ready (Phases 1–8 complete, suite at 135 tests + live RLS drill).

## Step 0 — What already works today (no deployment)

- Founder beta on this machine: `npm run web` (any port) against the live
  Supabase project. Sign-in, households, money, grocery, retail all live.
- Spouse-on-same-WiFi beta: Expo Go on a phone pointed at the dev server
  (`npx expo start`, scan the QR). Same backend, same data.

## Step 1 — Web beta (first real deployment)

1. **Decide a host** for the static web build (any static host works; the
   build is `npx expo export --platform web` → `dist/`). Candidates:
   Cloudflare Pages / Netlify / Vercel — all have free tiers. **[HUMAN: pick
   one + create account]**
2. Deploy `dist/`, note the URL (e.g. `https://app.example.com`).
3. **Supabase auth settings** (dashboard → Auth → URL Configuration):
   - Site URL → the deployed URL (today it is `http://localhost:3000`).
   - Redirect allow-list → add `<url>` and `<url>/reset-password`.
4. Smoke: sign-up with a fresh email, confirm, sign in, create household,
   invite the spouse's email, spouse accepts on their device.

## Step 2 — Native beta

- **Apple**: Apple Developer account ($99/yr) → EAS Build → TestFlight.
- **Google**: Play Console account ($25 once) → EAS Build → internal testing
  track.
- Both use `eas build` / `eas submit` (Expo account needed; EAS free tier is
  fine for this volume). **[HUMAN: accounts]**
- Before store builds: app icon/splash are still Expo defaults — needs a
  design pass; bundle identifiers must be chosen in `app.json`.

## Step 3 — Beta-quality gates (from Phase 8 deferrals)

- **Crash monitoring**: create a Sentry account → `npx expo install
  @sentry/react-native` + wire in `app/_layout.tsx`. Do this BEFORE inviting
  non-family testers.
- **Backup review**: Supabase dashboard → Database → Backups; free tier has
  daily backups, PITR needs Pro. Decide before real financial data grows.
- **Payment tests + 6b billing**: store accounts above unblock 6b (Apple IAP /
  Play Billing / Stripe web), which then unblocks payment tests.

## Known cosmetic backlog (fine for beta, listed for honesty)

- ~~Auth screens show the title twice on web~~ FIXED 2026-08-13 (native headers off).
- ~~Avatar initials derive from the email local-part~~ FIXED 2026-08-13 (display name first).
- ~~Categories had no delete~~ FIXED 2026-08-13 (guarded; history becomes uncategorized).
- Native data-export shares JSON as text (upgrade to expo-sharing when needed).
- App icon/splash are Expo defaults — design pass before store builds.


## spec 2026-08-15-stitch-design-adoption-design

# Stitch "ibilly" design adoption — design

**Date:** 2026-08-15
**Status:** Approved for slices A+B
**Source:** `stitch_universal_budget_tracker/` export (Google Stitch), `ibilly/DESIGN.md`

## Intent

Replace the "Ledger & Remittance" design direction (money-teal + remittance-gold on
warm paper) with the Stitch-generated "ibilly" system: indigo primary on cool
blue-white, Plus Jakarta Sans, borderless bento cards with soft ambient shadows.

This is a **rebrand, not a reskin**. The teal/gold identity is retired.

## Source material

The export contains four screen mocks (`ibilly_dashboard`, `ibilly_web_dashboard`,
`budget_settings`, `money_flow`) plus `ibilly/DESIGN.md`, which carries the design
system as YAML frontmatter (~40 Material 3 colour tokens, 8 typography roles, radius
and spacing scales) followed by prose on brand, elevation, shape and components.

The mocks cover roughly two of the app's 38 screens. `budget_settings` fuses budgets,
loyalty cards and settings into one page; `money_flow` has no direct equivalent and is
closest to the Transactions tab. **The remaining ~36 screens have no visual reference**
and must be derived from the system, not copied from a mock.

### Deviations from DESIGN.md prose

- **Gradients are dropped.** The prose calls for gradient primary buttons, gradient
  headline fills and a radial background wash. The exported PNGs render all of these
  flat. React Native has no CSS gradients; matching the prose would cost
  `expo-linear-gradient`, an SVG layer beneath all 38 screens, and a masked-view
  package for text fills. We use solid fills. Revisit additively if missed.
- **`title` is 28px**, not their `headline-lg` 32 (a desktop size) nor
  `headline-lg-mobile` 24 (which would collide with `heading`).
- **Loyalty "Cards" does not become a tab.** It is deferred 5d work with no backend.

## Decomposition

Full adoption is four sub-projects. Each gets its own spec → plan → execute cycle.

| Slice | Scope | Depends on |
|---|---|---|
| **A** Token layer | `theme.ts`, `fonts.ts`, chart series | — |
| **B** Primitives | the 11 components in `components/ui/` | A |
| **C** Flagship screens | dashboard, budget, transactions (the mocked ones) | B |
| **D** Long tail | remaining ~33 screens conformed to C's patterns | C |

**A+B are specced and executed together** as one foundation slice.

### Status (updated 2026-08-15)

A and B are complete. Slice C then absorbed a requirement the original
decomposition did not anticipate — **adaptive navigation** — and was executed
incrementally rather than from its own spec:

- **C0 adaptive nav (done)** — sidebar above 1024px, bottom tabs below, split by
  viewport width rather than `Platform.OS` because the app ships as a Web-PWA.
  Reuses the existing Tabs navigator via `tabBarPosition: 'left' | 'right'`.
- **C1 bento grid + dashboard (done)** — `BentoRow` / `BentoPage`; the dashboard
  moves from a flat stack to weighted tiles in two rows.
- **C2 tab screens (done)** — budget, transactions, grocery, account conformed;
  `Screen` now caps content width on wide viewports, which propagates the
  desktop treatment to every route that uses it.
- **C3 finance detail screens (done)** — budgets/goals/debts/categories, plus the
  two primitives they were each hand-rolling: `ProgressRing` (the mock's
  per-category ring) and `Chip`. Slice B deliberately deferred these until real
  screens defined their requirements, which is how it played out — `ProgressRing`
  took ProgressBar's `(fraction, state)` contract, and `Chip` gained a `tint`
  prop that a mockup-first design would have missed.

- **D long tail (done)** — applied by codemod rather than hand edits, because the
  screens repeated three declarations verbatim: the bordered card style (15
  files), the uncapped scroll content container (26 files), and the outlined chip
  (8 files). No JSX was restructured; the chips' existing label-colour logic
  already matched the `Chip` primitive, so only fills changed.

**Known debt.** Several screens still declare their own `card` and `chip` styles
rather than using the `Card` / `Chip` primitives. The styles now match, so they
render correctly and the palette flows from the theme, but the duplication should
collapse into the primitives when those screens are next opened for other
reasons. Doing it now would mean restructuring JSX in ~20 files that cannot be
visually verified from here.

**Verification ceiling.** Everything past the login screen sits behind the auth
gate, so the primitives are verified exhaustively at `/dev/theme` while the real
screens are verified only by typecheck, lint, tests, and the fact that they
consume verified primitives. A human pass while signed in is the outstanding
step for slices C and D.

## Guiding principle: keep the names, change the values

Existing token and variant *names* are the public API that all 38 screens call. They
stay. Only their values change. This keeps the foundation slice to a handful of files
and lets every screen reskin for free.

Trade-off accepted: our vocabulary drifts from Stitch's, so a future Stitch export
needs manual mapping again. Worth it against renaming across 38 screens.

## Slice A — Token layer

### Palette

Same 12 names, new values:

| Token | Old | New | Stitch source |
|---|---|---|---|
| `brand` | `#0E6E5C` | `#4343D5` | `primary` |
| `brandDeep` | `#0A4E42` | `#2E2BC2` | `on-primary-fixed-variant` |
| `brandMuted` | `#D5E7E1` | `#E1E0FF` | `primary-fixed` |
| `accent` | `#E0A72E` | `#944A1C` | `secondary` |
| `accentMuted` | `#F6E7C4` | `#FFDBCA` | `secondary-fixed` |
| `text` | `#12211C` | `#161D1F` | `on-surface` |
| `textMuted` | `#4F5C54` | `#464555` | `on-surface-variant` |
| `background` | `#F3F5F2` | `#F4FAFD` | `surface` |
| `surface` | `#FFFFFF` | `#FFFFFF` | `surface-container-lowest` |
| `border` | `#E1E7E2` | `#C7C4D7` | `outline-variant` |
| `danger` | `#B23A2E` | `#BA1A1A` | `error` |
| `success` | `#1E7B45` | `#1E7B45` | *unchanged — Stitch has no success token* |
| `white` | `#FFFFFF` | `#FFFFFF` | — |

Four additions:

| Token | Value | Purpose | Stitch source |
|---|---|---|---|
| `field` | `#F1F3F9` | input fills | Components §Input Fields |
| `tertiary` | `#00617E` | chart series, informational | `tertiary` |
| `surfaceMuted` | `#E8EFF1` | inset panels, segmented tracks | `surface-container` |
| `dangerMuted` | `#FFDAD6` | ErrorNotice fill | `error-container` |

### Chart series

`features/finance/donut.ts` currently hardcodes `CATEGORY_COLORS` with the old hexes
(`'#0E6E5C', // teal (brand)`, `'#E0A72E', // gold (accent)`). This is a token leak:
editing `theme.ts` alone would leave the dashboard donut rendering teal and gold on an
indigo app.

Move the series to `theme.ts` as `chartSeries`:
`[brand, accent, tertiary, danger, '#7C5CBF', success]`, and have `donut.ts` import it.
`donut.ts` stays a pure module (theme is plain consts), so its jest tests are unaffected.

### Contrast

Verified ≥4.5:1: `text` and `textMuted` on both `surface` and `background`; `white` on
`brand`; `accent` and `danger` on `surface`.

**Rule:** never place white text on `accentMuted`, `brandMuted`, `dangerMuted` or
`field` — these are light fills and take dark ink only.

### Radius

`sm` 6→4, `md` 12 (unchanged), `lg` 18→16, `pill` 999 (unchanged). Adding `xl` 24 for
hero/bento containers and `control` 8 for buttons and chips (`DESIGN.md` `0.5rem`).

49 `radius.*` call sites across 31 files keep working: their names already align with
Stitch's own scale, and only `sm` and `lg` shift, each by 2px.

### Spacing

No change. The existing scale is already 8px-based, and Stitch's `margin-mobile` 16 and
`gutter` 24 equal the existing `md` and `lg`.

### Typography

Six variant names kept, all restyled. Line heights become RN absolute pixels.

| Variant | Old | New | Stitch source |
|---|---|---|---|
| `title` | 28/700, ls −0.5 | 28/700, lh 34, ls −0.5 | between `headline-lg` and `-mobile` |
| `heading` | 20/600, ls −0.2 | 24/600, lh 31 | `headline-md` |
| `body` | 16/400 | 16/400, lh 26 | `body-md` |
| `caption` | 13/400 | 12/500, lh 14 | `label-sm` |
| `button` | 16/600, ls +0.3 | 16/600, lh 19, ls 0 | `label-md` |
| `eyebrow` | 12/700, ls +1.1, **uppercase** | 14/600, lh 17, ls 0.14 | `label-md` |

**`eyebrow` loses its uppercase and tracking.** It is used app-wide for section labels
and the dashboard household name. Stitch has no uppercase label style — every section
label in the mocks is sentence-case. This is the single most visible break from the old
identity and is intentional. The variant name is retained so no call site changes.

### Fonts

Add `@expo-google-fonts/plus-jakarta-sans` at weights 400/500/600/700. Weight 800 is
skipped (`display-lg` has no consumer).

Arabic keeps Readex Pro entirely — Plus Jakarta Sans has no Arabic coverage. The
script-aware resolver in `lib/fonts.ts` already handles this.

`fontFamilyFor` gains a `caption` case (caption now wants weight 500; RN selects weight
by family name). Arabic caption falls back to `ReadexPro_400Regular`, as Readex has no
medium.

Once migrated, remove `@expo-google-fonts/inter` and `@expo-google-fonts/space-grotesk`.

## Slice B — Primitives

All 11 components in `components/ui/`. No new primitives: the segmented control, toggle
and progress ring the mocks show are built in slice C, against real screen requirements
rather than guessed ones.

| Component | Change |
|---|---|
| `Card` | Borderless. `boxShadow: '0px 4px 20px rgba(0,0,0,0.04)'`, `radius.lg`, padding `spacing.lg` (24). `accented` keeps its name but renders an `accentMuted` tinted surface instead of the gold left rule. |
| `Button` | Flat `brand` fill, white label, `radius.control`. Secondary is ghost: transparent with a 1px `border` hairline. |
| `TextField` | `field` fill, no resting border, 2px `brand` focus ring, `radius.control`. |
| `Text` | New variant styles; resolver gains the `caption` weight case. |
| `Screen` | `background` token, `spacing.lg` gutter. |
| `ListRow` | Borderless rows for use inside cards; separation by spacing, not rules. |
| `ProgressBar` | Rounded caps, `brandMuted` track, `brand` fill. |
| `Donut` | Rounded stroke caps ("soft stroke"), series from `chartSeries`. |
| `EmptyState` | Token pass. |
| `ErrorNotice` | `dangerMuted` fill, `danger` ink. |
| `ActionSheet` | Web modal restyled to bento (borderless, shadowed, `radius.xl`). |

### Shadow migration

The dev server currently warns `"shadow*" style props are deprecated. Use "boxShadow"`
from `Card.tsx` and the dashboard hero. `DESIGN.md`'s shadow is already written in
`boxShadow` syntax, so slice B clears this deprecation rather than carrying it forward.

## Verification

The codebase has **no screen rendering tests** by deliberate convention — screens are
verified by typecheck, the live RLS drill, and manual run. `tsc` will not catch a single
visual regression in this slice.

**Dev-only theme gallery.** Add `app/dev/theme.tsx`, `__DEV__`-gated the same way the 6a
plan toggle in `app/subscription.tsx` is, rendering every primitive in every state on one
scrollable page: all six text variants in Latin and Arabic, Card default and tinted,
Button primary/ghost/disabled, TextField idle/focused/error, ListRow, ProgressBar, Donut,
EmptyState, ErrorNotice, ActionSheet.

This is the only practical way to see the transient states (focus, error, empty) and the
Arabic faces before shipping them. It stays useful for slices C and D.

Then: `npm run typecheck`, `npm test` (the donut and component unit tests must stay
green), `npm run lint`, and a manual spot-check of five real screens.

## Out of scope

- **Dark mode.** `DESIGN.md` ships a light-only palette; the app has no dark mode today.
- **Screen layouts.** Slices C and D.
- **New primitives.** Slice C.
- **Renaming the app to "ibilly".** That is Stitch's invented brand, not a decision made here.


## spec 2026-08-22-2c-compare-coupon-savings-design

# 2c — Coupon savings in Compare (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 2c hook — roll coupon savings into the basket comparison

## Intent

`app/grocery/compare/[id].tsx` ranks store columns by pre-coupon list price and
shows a single coupon "potential savings" figure computed against the theoretical
floor (global best price per product) — disconnected from the ranked columns.
Make the columns **coupon-aware** so the best basket reflects applicable coupons:
each column's total nets out coupons valid at that column's retailer, and the
ranking uses the **net** total.

## Pure module (tested)

`features/retail/basketCoupons.ts`:

```
compareColumnsWithCoupons(items, prices, columnRetailer, couponsByProduct, ccy, nowMs)
  → ColumnTotalCoupon[]   // { columnKey, grossMinor, savingsMinor, netMinor,
                          //   pricedCount, missingCount }, sorted by netMinor asc
```

- Lowest price per (product, column), same as `compareColumns`.
- Per column: `retailerId = columnRetailer[columnKey]`. For each priced item, best
  savings = max `applyCoupon(coupon, base, ccy, now).savingsMinor` over
  `couponsByProduct[productId]` whose `retailerId` matches the column's retailer
  (coupons are retailer-scoped). `net = gross − savings`.
- No matching coupons → `savingsMinor 0`, `net == gross` (identical ordering to
  `compareColumns`). Reuses the existing pure `applyCoupon`.
- Unit-tested: retailer scoping (a coupon only helps its own retailer's column),
  ranking flips by net, cap/percent, empty inputs.

## Data

`getBasketPrices` also returns `columnRetailer: Record<columnKey, retailerId>`
(the retailer is already on each row — store column → its retailer, online column
→ the embedded id). No new query. The screen builds `couponsByProduct: Map<
productId, {retailerId, coupon}[]>` from the `listCouponsForProduct` calls it
**already makes** — each coupon carries `retailer_id`.

## Screen

- Columns ranked by **net**; the card headline amount is the net total.
- Cards with `savingsMinor > 0` show an accent line **"🏷 {amount} off with
  coupons"**. Cheapest (index 0) keeps its badge; coverage/missing unchanged.
- Keep the theoretical-floor card; **remove** the old floor-based
  `potentialSavings` line and its coupon loop (superseded).

## i18n

Add `grocery.compare.couponSaved` = "🏷 {{amount}} off with coupons"; remove
`grocery.compare.potentialSavings` from en/fil/ar (key sets stay matched).

## Non-goals

- The theoretical-floor figure stays pre-coupon (it's the split-shopping floor, a
  different concept).
- No schema change; coupons and prices already exist.

## Testing

`compareColumnsWithCoupons` unit-tested. Screen via `typecheck` + i18n parity +
manual. `applyCoupon`/`compareColumns` keep their existing tests.


## spec 2026-08-22-4b-onboarding-cross-border-design

# 4b — Onboarding cross-border question (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4b (subset — the cross-border question only)

## Intent

The UX-overhaul mockup 4b frames "Do members of your household live in
different countries?" as step 2 of a 3-step onboarding wizard. This repo already
ships a create-household screen (`app/household/new.tsx`, slice 3c) with name +
reporting currency + a plain cross-border `Switch`. Rather than build a second,
overlapping wizard, we **fold the 4b cross-border question into the existing
create screen**, upgrading the bland Switch into the mockup's two-card decision.

Scope is deliberately the cross-border *question* — not the full wizard, not a
new route, not a data-model change.

## Non-goals

- No `/onboarding` route or multi-step wizard (name/currency already collected on
  this screen; invite members already exists at `app/household/[id].tsx`).
- No schema/RPC change: `households.is_cross_border` and `createHousehold`
  (`_is_cross_border`) already exist and are unchanged.
- No change to what cross-border *activates* downstream (2d insights card,
  remittance category) — only how the choice is presented.

## Change

In `app/household/new.tsx`, replace the `switchRow` block (the `Switch` +
label/explainer) with a cross-border question block. Name + `CurrencyField`,
the Create button, and the "Join instead" link are unchanged.

The block:

1. **Question** — a heading: *"Do members of your household live in different
   countries?"*
2. **Two selectable cards** — a radio pair bound to the existing `crossBorder`
   boolean:
   - **"We're all in one country"** — *"One currency, one set of choices."*
     (selects `crossBorder = false`)
   - **"We live in different countries"** — *"e.g. working abroad, family at
     home"* + activation line *"Turns on remittance tracking, money sent and
     received home, FX history, and totals in your chosen currency."*
     (selects `crossBorder = true`)
3. **Footer note** (muted caption): *"You can change this anytime in Household
   settings."*

## Behavior

- Default selection is **"one country" (`crossBorder = false`)**, matching the
  screen's current default. There is always exactly one selected card; no forced
  empty state.
- Selecting a card sets `crossBorder`; submission is unchanged
  (`validate(createHouseholdSchema, { …, isCrossBorder: crossBorder })`).

## Visual (tokens only)

- Selected card: `palette.brandMuted` fill, 2px `palette.brand` border, a trailing
  ✓ badge.
- Unselected card: `palette.surface` fill, 1px `palette.border`.
- Radius `radius.lg`, padding `spacing.md`, gap `spacing.sm`.
- The ✓ glyph is a non-color selection cue, satisfying the F30 rule (selection is
  never color-only). `accessibilityRole="radio"`, `accessibilityState.selected`,
  ≥44px hit target.

## Component

`OptionCard` — a small radio-style card — lives locally in `new.tsx`. It is
screen-specific for now (YAGNI); promote to `components/ui` only if a later
onboarding slice needs it.

## i18n

Add to `locales/{en,fil,ar}.json` under `household` (matching key sets):

- `crossBorderQuestion`
- `crossBorderOneCountryTitle`, `crossBorderOneCountryCaption`
- `crossBorderMultiTitle`, `crossBorderMultiCaption`, `crossBorderActivates`
- `crossBorderChangeNote`
- `crossBorderSelected` (a11y label suffix, e.g. "selected")

Remove the now-unused `crossBorderLabel` and `crossBorderExplainer` (used only by
this screen). Key-set parity is enforced by `tests/lib/i18n.test.ts`.

## Testing

Selection is trivial boolean UI state — no new pure module to unit-test.
Verification: `npm run typecheck`, the i18n parity test, and a manual look on
web. Consistent with the project's "screens are not render-tested" convention.


## spec 2026-08-22-4d-shop-stores-design

# 4d — Shop → Stores (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4d — the Stores segment of the retail hub

## Intent

The Stores segment of `app/retail/index.tsx` currently lists retailers as bare
cards (name + country only) under a plain active-location card. 4d makes it the
mockup's store hub: a location banner, retailer cards that show reach ("N
branches · N prices") and **price freshness** (the spec's visible-freshness
rule), and a clear add-retailer affordance. Responsive — 3-up on wide viewports,
stacked below — via the app's `useIsWideLayout` (≥1024px).

## Non-goals

- Coupons and Locations segments unchanged (4e / later).
- No schema/RPC change and no new migration: metrics are aggregated from existing
  household-scoped tables client-side.
- Not moving the products list into each retailer's detail (a separate nav
  change); the existing products link stays.

## Data layer (no migration)

- **Pure module** `features/retail/retailerStats.ts`:
  `computeRetailerStats(stores, retailerProducts, prices) → Map<retailerId,
  RetailerStat>` where `RetailerStat = { branches, prices, lastObservedAt: string
  | null }`. Counts branches per retailer, maps `retailer_product_id →
  retailer_id` to count prices, and keeps the newest `observed_at`. Pure →
  jest-unit-tested.
- **`listRetailerStats(hid)`** in `features/retail/api.ts`: three minimal
  household-scoped selects (`retailer_stores.retailer_id`,
  `retailer_products{id,retailer_id}`, `price_snapshots{retailer_product_id,
  observed_at}`) run in parallel, fed to the pure aggregator. Added to the hub's
  `load()` Promise.all; a retailer with no entry renders as zeros.

## UI

**Active-location banner** (top of hub, all segments): a map-pin tile, a caption
(*"Shopping near"* / *"No location set"*), the `label — store` line, a
why-it-matters caption, and a pill that switches to the Locations segment
(*"Change location"* / *"Set location"*).

**Retailer cards** (Stores segment, `RetailerCard` local component): name,
country, **"{branches} · {prices}"** (plural keys), and a **freshness pill** from
`freshnessOf(Date.parse(lastObservedAt), now)`:
- `null` → muted **"No prices yet"** (`field`/`textMuted`)
- fresh | recent → **"Updated {date}"** (`successMuted`/`success`)
- stale → **"Stale — {date}"** (`dangerMuted`/`danger`)

Date via `formatDate`. Card tap → `/retail/[id]`. A persistent **"＋ Add
retailer"** row (→ `/retail/new`) sits above the grid; the `EmptyState` stays for
zero retailers.

**Saved-location rows** (Locations segment): minor polish — `✓ Active` (brand)
vs a `Set active` pill (already present; aligned to tokens).

## i18n

New `retail.*` keys in en/fil/ar (matching sets): `branchCount`/`branchCount_other`,
`priceCount`/`priceCount_other`, `updated`, `stale`, `noPricesYet`, `shoppingNear`,
`setLocationPrompt`, `locationWhy`, `changeLocation`, `setLocation`, `addRetailer`
(reuse if present). Plurals follow the existing `itemsCount` base + `_other`
pattern.

## Testing

`computeRetailerStats` gets unit tests (branch/price counts, newest-date
selection, unknown retailer_product ignored, empty inputs). The screen is
verified by `typecheck` + i18n parity + manual. Freshness bucketing is already
covered by `tests/retail/freshness.test.ts`.


## spec 2026-08-22-4e-shop-coupons-design

# 4e — Shop → Coupons (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4e — the Coupons screen tied to the active list

## Intent

Rework `app/retail/coupons.tsx` so coupons connect to what the household is
actually buying: match coupons to the current grocery list, surface a **dollar
savings** banner, and make each card show its offer, urgency, and list link.
Also make **US/USD the default** country/currency so the sample market (and this
banner) reads in dollars.

## Matching + savings (pure, tested)

New `features/retail/couponMatch.ts`:

```
computeListCouponSavings(coupons, listItems, listCurrency, nowMs)
  → { matches: { coupon, matchedItemName: string|null, savingsMinor: number }[],
      totalSavingsMinor: number }
```

- **Match** by `coupon.retailer_product.product_id === item.product_id`.
  Retailer-wide coupons (no product) and coupons whose product isn't on the list
  are `matchedItemName: null`, `savingsMinor: 0`.
- **Savings** for a matched item with an estimated price:
  `applyCoupon(coupon, item.estimatedPriceMinor, listCurrency, nowMs).savingsMinor`
  (reuses existing pure coupon math — fixed coupons must match `listCurrency`,
  percent always applies; no estimated price → 0).
- **Total** takes the **best coupon per item** (max savings per `product_id`) so
  two coupons on one item don't double-count.
- Unit-tested: match, currency mismatch, percent, best-per-item, missing price,
  expired coupon → 0.

## Data

Load alongside coupons: the **most recent non-archived grocery list**
(`listLists(hid)[0]`) and its items (`listItems`, using `product_id`, `name`,
`estimated_price_minor`). Extend the coupon select + `CouponWithRefs` to include
`retailer_product.product_id` (additive).

## UI (`app/retail/coupons.tsx`)

- **PREMIUM pill** at the top (screen already premium-gated).
- **Savings banner** (accent surface): *"{amount} in coupon savings on
  {listName}"* when `totalSavingsMinor > 0`; hidden otherwise. Amount via
  `formatAmount(total, listCurrency)`.
- **Coupon cards** (matched first): a 4px accent inline-start bar, title, the
  discount/savings in accent (₱/$ or %), a meta line *"retailer · code · until
  {date}"* with **expiry < 7 days in `danger`**, and — when matched — *"On your
  list ✓ — {item}"* in `brand`. **Non-matching coupons render at 85% opacity.**
- Active/expired grouping and the existing add-coupon form stay.

## Default country = USA (fallback)

New `lib/defaults.ts`: `DEFAULT_COUNTRY = 'US'`, `DEFAULT_CURRENCY = 'USD'`,
`defaultCurrencyCode()` = device currency **or** `USD`, `defaultCountryCode()` =
device region **or** `US`. Device locale still wins when present (this is a
fallback, not a forced override — correct for a global app). Wired into:
- `app/household/new.tsx` reporting-currency default (replaces its local
  `deviceCurrency()`).
- `app/retail/new.tsx` retailer-directory country default.

## Non-goals

- No "roll savings into Compare (2c)" — that's a Compare-screen integration for a
  later 2c slice.
- Coupon base price uses the item's **estimated** price, not `price_snapshots`
  (which list items rarely have); good enough for a planning-time figure.
- The retail-hub Coupons *preview* (`app/retail/index.tsx`) is unchanged.

## Testing

`computeListCouponSavings` unit-tested. Screen + defaults via `typecheck` + i18n
parity + manual. Existing `applyCoupon`/`couponStatus` tests already cover the
math underneath.


## spec 2026-08-22-5b-branch-picker-design

# 5b — Branch picker (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 5b — retailer branch picker

## Intent

`app/retail/[retailerId].tsx` is already the retailer's Branches screen (list +
add-branch form). 5b upgrades it into a **picker** that ends in "set this as my
shopping location": search + nearest-first branches, a selectable list, an
explainer, and a one-tap manual add that also activates. No new route (entry
point already exists — tapping a retailer in the hub). The global saved-locations
manager (`locations.tsx`) is unchanged.

## Pure module (tested)

`features/retail/branchRank.ts` — `rankBranches(stores, coords, query)`:
- Filters by a **city/ZIP/name** query (`name`, `city`, `region`, `postal_code`,
  case-insensitive `includes`).
- Sorts **nearest-first** when `coords` present (existing pure `haversineKm`);
  branches without lat/lng fall to the bottom; with no coords at all, sorts
  alphabetically.
- Returns `{ store, km: number | null }[]`. Unit-tested: filter, distance sort,
  no-coords fallback, coords-missing branch ordering.

## API

`saveAndActivateLocation(hid, storeId, label)` in `features/retail/api.ts`:
reuses an existing `saved_location` for that store if one exists (no duplicates),
else creates one, then `setActiveLocation`. This is the shared "make it active"
glue for both paths below.

## UI (upgraded `[retailerId].tsx`)

- **City/ZIP search** field filtering the branch list (via `rankBranches`).
- **"Use current location"** button → GPS (expo-location) → reorders nearest
  first, each row showing `· {km}` (existing `retail.distanceKm`).
- **Selectable branch rows**: name + address line (+ distance); the selected row
  is `brandMuted` + ✓, `accessibilityRole="radio"`.
- **Ink explainer card** (`tertiary` surface): "Prices are per branch. Compare
  ranks branches, and each price shows how fresh it is."
- **Primary CTA "Save & set as my location"** — enabled once a branch is
  selected → `saveAndActivateLocation(store.name)`, then back to `/retail`.
- **Dashed "Branch not listed? Add it manually"** → the existing add-branch form
  (name / city / currency / coords). Its button **"Add & set as my location"**
  chains `createStore` → `saveAndActivateLocation` in **one tap**.

## i18n

New `retail.*` keys (en/fil/ar): `branchSearch`, `saveAndSetActive`,
`addAndSetActive`, `branchNotListed`, `branchExplainer`, `selected`. Reuse
existing `useCurrentLocation`, `distanceKm`, `addBranch`, `branchName`, `city`,
`currency`, `latitude`, `longitude`, `noBranches`.

## Non-goals

- No seeded/directory branch data (arrives with connectors); branches remain
  household-created rows.
- No change to `locations.tsx` or the store/saved-location schema.

## Testing

`rankBranches` unit-tested. Screen + the api chain via `typecheck` + i18n parity
+ manual. `haversineKm` already has its own tests.


---

# Appendix B — Per-slice execution plans

> Folded in from the former `context/plans/` (now in git history). Frozen per-slice
> execution checklists — anchor form `#plan-<stem>`.


## plan 2026-08-12-phase4-shared-shopping

# Phase 4 — Shared Household Shopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multiple named grocery lists per household that sync live across devices, track who added/purchased each item, and convert a completed shopping trip into one household expense.

**Architecture:** Two new Postgres tables (`grocery_lists`, `grocery_items`) with RLS mirroring the finance tables, added to the `supabase_realtime` publication. A `security definer` RPC (`complete_grocery_list`) atomically sums purchased items and creates one expense transaction. The client follows the established `features/<domain>` boundary: pure `totals.ts` helper (unit tested), zod `schemas.ts`, `api.ts` data-access + realtime subscription helpers, and Expo Router screens under `app/`. i18n in all three locales.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS + Realtime), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.** Use `lib/money.ts` (`toMinorUnits`, `formatAmount`).
- **No mixing currencies in one transaction.** One currency per list; checkout account currency must equal list currency.
- **No service-role key in client code or `EXPO_PUBLIC_*`.** It is only used in `tests/integration/*.mjs`.
- **RLS is the security boundary.** Every table: SELECT via `public.is_member_of(household_id)`; writes via `public.has_role_in(household_id, array[...]::public.household_role[])`.
- **Data access only through `features/<domain>/api.ts`.** Screens never call `getSupabase()` directly. Query results are cast to `lib/database.types.ts` types at that boundary.
- **All user-facing strings are i18n keys** present in `locales/en.json`, `locales/fil.json`, `locales/ar.json`.
- **Migration files are immutable once applied.** New migration file, timestamp-ordered: `20260812000005_grocery.sql`.
- Verification commands: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Database migration — grocery schema, RLS, realtime, checkout RPC

**Files:**
- Create: `supabase/migrations/20260812000005_grocery.sql`

**Interfaces:**
- Consumes: existing `public.households`, `public.accounts`, `public.categories`, `public.transactions`; helpers `public.is_member_of(uuid)`, `public.has_role_in(uuid, public.household_role[])`, `public.set_updated_at()`; publication `supabase_realtime`.
- Produces: tables `public.grocery_lists`, `public.grocery_items`; RPC `public.complete_grocery_list(_list_id uuid, _account_id uuid, _category_id uuid) returns uuid`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260812000005_grocery.sql`:

```sql
-- ============================================================================
-- Phase 4 — Shared household shopping (grocery lists + items)
-- ============================================================================
-- Multiple named lists per household, edited live via Supabase Realtime. Prices
-- are integer minor units in the LIST's currency (no per-item currency). A
-- "shopping trip" is completed via complete_grocery_list(), which sums purchased
-- items into ONE expense transaction (money invariants unchanged).
-- ============================================================================

create table if not exists public.grocery_lists (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  name                     text not null,
  currency_code            text not null check (currency_code ~ '^[A-Z]{3}$'),
  status                   text not null default 'active'
                             check (status in ('active','completed','archived')),
  completed_at             timestamptz,
  completed_transaction_id uuid references public.transactions (id) on delete set null,
  created_by               uuid not null references auth.users (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_grocery_lists_household
  on public.grocery_lists (household_id, status, created_at desc);

drop trigger if exists trg_grocery_lists_updated_at on public.grocery_lists;
create trigger trg_grocery_lists_updated_at
  before update on public.grocery_lists
  for each row execute function public.set_updated_at();

create table if not exists public.grocery_items (
  id                    uuid primary key default gen_random_uuid(),
  list_id               uuid not null references public.grocery_lists (id) on delete cascade,
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null,
  quantity              numeric not null default 1 check (quantity > 0),
  unit                  text,
  estimated_price_minor bigint check (estimated_price_minor >= 0),
  actual_price_minor    bigint check (actual_price_minor >= 0),
  is_purchased          boolean not null default false,
  added_by              uuid not null references auth.users (id),
  purchased_by          uuid references auth.users (id),
  purchased_at          timestamptz,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_grocery_items_list
  on public.grocery_items (list_id, sort_order, created_at);
create index if not exists idx_grocery_items_household
  on public.grocery_items (household_id);

drop trigger if exists trg_grocery_items_updated_at on public.grocery_items;
create trigger trg_grocery_items_updated_at
  before update on public.grocery_items
  for each row execute function public.set_updated_at();

-- Force item.household_id to match its parent list; block cross-household writes.
create or replace function public.grocery_items_enforce_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then
    raise exception 'grocery list not found';
  end if;
  new.household_id := _h; -- household always follows the parent list
  return new;
end;
$$;

drop trigger if exists trg_grocery_items_enforce_list on public.grocery_items;
create trigger trg_grocery_items_enforce_list
  before insert or update on public.grocery_items
  for each row execute function public.grocery_items_enforce_list();

-- ---------------------------------------------------------------------------
-- complete_grocery_list: sum purchased items into ONE expense, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.complete_grocery_list(
  _list_id uuid,
  _account_id uuid,
  _category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid      uuid := (select auth.uid());
  _hid      uuid;
  _lname    text;
  _lccy     text;
  _lstatus  text;
  _acc_h    uuid;
  _acc_ccy  text;
  _cat_h    uuid;
  _total    bigint;
  _tx_id    uuid;
begin
  select household_id, name, currency_code, status
    into _hid, _lname, _lccy, _lstatus
  from public.grocery_lists where id = _list_id;

  if _hid is null then
    raise exception 'grocery list not found';
  end if;
  if not public.has_role_in(_hid, array['owner','admin','member']::public.household_role[]) then
    raise exception 'not authorized to complete this list';
  end if;
  if _lstatus <> 'active' then
    raise exception 'list is not active';
  end if;

  select household_id, currency_code into _acc_h, _acc_ccy
  from public.accounts where id = _account_id;
  if _acc_h is null or _acc_h <> _hid then
    raise exception 'account does not belong to this household';
  end if;
  if _acc_ccy <> _lccy then
    raise exception 'account currency does not match list currency';
  end if;

  if _category_id is not null then
    select household_id into _cat_h from public.categories where id = _category_id;
    if _cat_h is null or _cat_h <> _hid then
      raise exception 'category does not belong to this household';
    end if;
  end if;

  select coalesce(sum(actual_price_minor), 0) into _total
  from public.grocery_items
  where list_id = _list_id and is_purchased = true;

  if _total <= 0 then
    raise exception 'nothing purchased yet';
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor,
    currency_code, category_id, description, occurred_at, created_by
  ) values (
    _hid, _account_id, 'expense', 'out', _total,
    _lccy, _category_id, 'Grocery: ' || _lname, now(), _uid
  ) returning id into _tx_id;

  update public.grocery_lists
    set status = 'completed', completed_at = now(), completed_transaction_id = _tx_id
  where id = _list_id;

  return _tx_id;
end;
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;

-- grocery_lists
drop policy if exists grocery_lists_select on public.grocery_lists;
create policy grocery_lists_select on public.grocery_lists
  for select using (public.is_member_of(household_id));

drop policy if exists grocery_lists_insert on public.grocery_lists;
create policy grocery_lists_insert on public.grocery_lists
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists grocery_lists_update on public.grocery_lists;
create policy grocery_lists_update on public.grocery_lists
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists grocery_lists_delete on public.grocery_lists;
create policy grocery_lists_delete on public.grocery_lists
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
  );

-- grocery_items
drop policy if exists grocery_items_select on public.grocery_items;
create policy grocery_items_select on public.grocery_items
  for select using (public.is_member_of(household_id));

drop policy if exists grocery_items_insert on public.grocery_items;
create policy grocery_items_insert on public.grocery_items
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and added_by = (select auth.uid())
  );

drop policy if exists grocery_items_update on public.grocery_items;
create policy grocery_items_update on public.grocery_items
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists grocery_items_delete on public.grocery_items;
create policy grocery_items_delete on public.grocery_items
  for delete using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

-- ===========================================================================
-- Grants + realtime
-- ===========================================================================
grant select, insert, update, delete on public.grocery_lists to authenticated;
grant select, insert, update, delete on public.grocery_items to authenticated;

-- Stream row changes to subscribed clients (RLS still applies per row).
alter publication supabase_realtime add table public.grocery_lists;
alter publication supabase_realtime add table public.grocery_items;
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply via the Supabase SQL editor (paste the file) or CLI. This project applies
migrations manually (no local Postgres). Confirm no errors.

Note: if `alter publication supabase_realtime add table ...` errors with "already
member", that's safe to ignore. If the publication doesn't exist, create it first:
`create publication supabase_realtime;` (Supabase-hosted projects have it by default).

- [ ] **Step 3: Smoke-verify in the SQL editor**

Run and confirm both tables + the function exist:

```sql
select table_name from information_schema.tables
  where table_schema='public' and table_name in ('grocery_lists','grocery_items');
select proname from pg_proc where proname='complete_grocery_list';
select relname from pg_publication_tables where pubname='supabase_realtime'
  and tablename in ('grocery_lists','grocery_items');
```

Expected: 2 tables, 1 function, 2 publication rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000005_grocery.sql
git commit -m "feat(grocery): Phase 4 schema — lists, items, RLS, realtime, checkout RPC"
```

---

### Task 2: TypeScript database types

**Files:**
- Modify: `lib/database.types.ts` (append a Phase 4 section)

**Interfaces:**
- Produces: `GroceryListStatus`, `GroceryListRow`, `GroceryItemRow` types used by all client code.

- [ ] **Step 1: Append the grocery types**

At the end of `lib/database.types.ts`, before any final `Database`/helper block
if present (otherwise at EOF), add:

```typescript
// --- Phase 4: shared shopping (grocery) ------------------------------------
export type GroceryListStatus = 'active' | 'completed' | 'archived';

export interface GroceryListRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  status: GroceryListStatus;
  completed_at: string | null;
  completed_transaction_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryItemRow {
  id: string;
  list_id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_price_minor: number | null;
  actual_price_minor: number | null;
  is_purchased: boolean;
  added_by: string;
  purchased_by: string | null;
  purchased_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(grocery): add GroceryListRow/GroceryItemRow types"
```

---

### Task 3: Pure totals helper (TDD)

**Files:**
- Create: `features/grocery/totals.ts`
- Test: `tests/grocery/totals.test.ts`

**Interfaces:**
- Consumes: `GroceryItemRow` from `lib/database.types`.
- Produces: `estimatedTotalMinor(items)`, `actualTotalMinor(items)`, `purchasedCount(items)`, all `(items: Pick<GroceryItemRow, ...>[]) => number`.

- [ ] **Step 1: Write the failing test**

Create `tests/grocery/totals.test.ts`:

```typescript
import {
  actualTotalMinor,
  estimatedTotalMinor,
  purchasedCount,
} from '@/features/grocery/totals';

type Item = Parameters<typeof estimatedTotalMinor>[0][number];

function item(over: Partial<Item>): Item {
  return {
    estimated_price_minor: null,
    actual_price_minor: null,
    is_purchased: false,
    ...over,
  } as Item;
}

describe('grocery totals', () => {
  it('sums estimated prices, treating null as 0', () => {
    const items = [
      item({ estimated_price_minor: 1000 }),
      item({ estimated_price_minor: 250 }),
      item({ estimated_price_minor: null }),
    ];
    expect(estimatedTotalMinor(items)).toBe(1250);
  });

  it('sums only purchased items for the actual total', () => {
    const items = [
      item({ actual_price_minor: 999, is_purchased: true }),
      item({ actual_price_minor: 500, is_purchased: false }),
      item({ actual_price_minor: 1, is_purchased: true }),
    ];
    expect(actualTotalMinor(items)).toBe(1000);
  });

  it('treats a purchased item with a null actual price as 0', () => {
    const items = [item({ actual_price_minor: null, is_purchased: true })];
    expect(actualTotalMinor(items)).toBe(0);
  });

  it('counts purchased items', () => {
    const items = [
      item({ is_purchased: true }),
      item({ is_purchased: false }),
      item({ is_purchased: true }),
    ];
    expect(purchasedCount(items)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(estimatedTotalMinor([])).toBe(0);
    expect(actualTotalMinor([])).toBe(0);
    expect(purchasedCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/grocery/totals.test.ts`
Expected: FAIL — cannot find module `@/features/grocery/totals`.

- [ ] **Step 3: Write the implementation**

Create `features/grocery/totals.ts`:

```typescript
/**
 * Pure grocery math in integer minor units (list currency). No I/O — unit
 * tested and reusable in the list UI. Null prices count as 0.
 */

import type { GroceryItemRow } from '@/lib/database.types';

type PriceItem = Pick<
  GroceryItemRow,
  'estimated_price_minor' | 'actual_price_minor' | 'is_purchased'
>;

/** Sum of every item's estimated price (null → 0). */
export function estimatedTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce((sum, it) => sum + (it.estimated_price_minor ?? 0), 0);
}

/** Sum of actual prices for purchased items only (null → 0). */
export function actualTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce(
    (sum, it) => sum + (it.is_purchased ? it.actual_price_minor ?? 0 : 0),
    0,
  );
}

/** How many items are marked purchased. */
export function purchasedCount(items: readonly PriceItem[]): number {
  return items.reduce((n, it) => n + (it.is_purchased ? 1 : 0), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/grocery/totals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add features/grocery/totals.ts tests/grocery/totals.test.ts
git commit -m "feat(grocery): pure totals helpers with unit tests"
```

---

### Task 4: Validation schemas

**Files:**
- Create: `features/grocery/schemas.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `createListSchema`, `addItemSchema`, `updateItemSchema`, `checkoutSchema` (zod schemas) and their inferred types `CreateListInput`, `AddItemInput`, `UpdateItemInput`, `CheckoutInput`.

- [ ] **Step 1: Write the schemas**

Create `features/grocery/schemas.ts` (mirrors the style of
`features/finance/planningSchemas.ts` — major-unit money entered as strings/numbers,
converted to minor in the screen via `toMinorUnits`):

```typescript
/**
 * Grocery form validation. Prices are entered in MAJOR units here and converted
 * to integer minor units at the screen boundary (see lib/money.toMinorUnits).
 */

import { z } from 'zod';

const currency = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' });

const name = z.string().trim().min(1).max(120);
const optionalMajor = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: 'invalid_amount',
  });

export const createListSchema = z.object({
  name,
  currencyCode: currency,
});

export const addItemSchema = z.object({
  name,
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 1 : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, { message: 'invalid_quantity' }),
  unit: z.string().trim().max(24).optional().transform((v) => (v ? v : undefined)),
  estimatedMajor: optionalMajor,
});

export const updateItemSchema = z.object({
  name: name.optional(),
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: 'invalid_quantity',
    }),
  unit: z.string().trim().max(24).optional(),
  estimatedMajor: optionalMajor,
  actualMajor: optionalMajor,
  isPurchased: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/grocery/schemas.ts
git commit -m "feat(grocery): zod validation schemas for lists and items"
```

---

### Task 5: Data access + realtime API

**Files:**
- Create: `features/grocery/api.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `AppError`, `GroceryListRow`, `GroceryItemRow`.
- Produces:
  - `listLists(householdId): Promise<GroceryListRow[]>`
  - `createList(householdId, { name, currencyCode }): Promise<GroceryListRow>`
  - `archiveList(id): Promise<void>`
  - `getList(id): Promise<GroceryListRow | null>`
  - `listItems(listId): Promise<GroceryItemRow[]>`
  - `addItem(listId, { name, quantity, unit?, estimatedPriceMinor? }): Promise<GroceryItemRow>`
  - `updateItem(id, patch): Promise<GroceryItemRow>` where patch may set purchased state + prices
  - `setPurchased(id, isPurchased, actualPriceMinor?): Promise<GroceryItemRow>`
  - `deleteItem(id): Promise<void>`
  - `completeList(listId, accountId, categoryId?): Promise<string>` (RPC → transaction id)
  - `subscribeToLists(householdId, onChange): () => void`
  - `subscribeToItems(listId, onChange): () => void`

- [ ] **Step 1: Write the API module**

Create `features/grocery/api.ts`:

```typescript
/**
 * Grocery data access. Household scoping + writer/viewer permission are enforced
 * by RLS; realtime subscriptions stream row changes (RLS still applies per row).
 * All money crosses this boundary as integer minor units in the list currency.
 */

import type { GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// --- lists -----------------------------------------------------------------
export async function listLists(householdId: string): Promise<GroceryListRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('household_id', householdId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryListRow[];
}

export async function getList(id: string): Promise<GroceryListRow | null> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? null) as GroceryListRow | null;
}

export async function createList(
  householdId: string,
  input: { name: string; currencyCode: string },
): Promise<GroceryListRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.listFailed', error);
  return data as GroceryListRow;
}

export async function archiveList(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_lists')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) fail('grocery.errors.saveFailed', error);
}

// --- items -----------------------------------------------------------------
export async function listItems(listId: string): Promise<GroceryItemRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryItemRow[];
}

export async function addItem(
  listId: string,
  input: { name: string; quantity: number; unit?: string; estimatedPriceMinor?: number },
): Promise<GroceryItemRow> {
  const addedBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_items')
    // household_id is set by the grocery_items_enforce_list trigger.
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000',
      name: input.name,
      quantity: input.quantity,
      unit: input.unit ?? null,
      estimated_price_minor: input.estimatedPriceMinor ?? null,
      added_by: addedBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.itemFailed', error);
  return data as GroceryItemRow;
}

export async function updateItem(
  id: string,
  patch: Partial<{
    name: string;
    quantity: number;
    unit: string | null;
    estimatedPriceMinor: number | null;
    actualPriceMinor: number | null;
    isPurchased: boolean;
  }>,
): Promise<GroceryItemRow> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.estimatedPriceMinor !== undefined) row.estimated_price_minor = patch.estimatedPriceMinor;
  if (patch.actualPriceMinor !== undefined) row.actual_price_minor = patch.actualPriceMinor;
  if (patch.isPurchased !== undefined) row.is_purchased = patch.isPurchased;

  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

/** Toggle purchased state, stamping purchaser + optional actual price. */
export async function setPurchased(
  id: string,
  isPurchased: boolean,
  actualPriceMinor?: number,
): Promise<GroceryItemRow> {
  const purchasedBy = isPurchased ? await currentUserId() : null;
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update({
      is_purchased: isPurchased,
      purchased_by: purchasedBy,
      purchased_at: isPurchased ? new Date().toISOString() : null,
      ...(actualPriceMinor !== undefined ? { actual_price_minor: actualPriceMinor } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('grocery_items').delete().eq('id', id);
  if (error) fail('grocery.errors.deleteFailed', error);
}

/** Complete a trip: sums purchased items into one expense; returns its tx id. */
export async function completeList(
  listId: string,
  accountId: string,
  categoryId?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accountId,
    _category_id: categoryId ?? null,
  });
  if (error) fail('grocery.errors.checkoutFailed', error);
  return data as string;
}

// --- realtime --------------------------------------------------------------
/** Subscribe to any list change in a household. Returns an unsubscribe fn. */
export function subscribeToLists(householdId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_lists:${householdId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_lists', filter: `household_id=eq.${householdId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}

/** Subscribe to item changes within one list. Returns an unsubscribe fn. */
export function subscribeToItems(listId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_items:${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
```

Note on `addItem`: the client sends a placeholder `household_id`; the
`grocery_items_enforce_list` trigger overwrites it with the parent list's
household before the RLS `with check` is evaluated against the final row.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/grocery/api.ts
git commit -m "feat(grocery): data-access + realtime subscription helpers"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`
- Modify: `app/(tabs)/grocery.tsx` screen strings already reference `screens.grocery*`; those stay but the real screens use `grocery.*`.

**Interfaces:**
- Produces: a `grocery` namespace present in all three locale files with identical key sets.

- [ ] **Step 1: Add the `grocery` block to `locales/en.json`**

Add a top-level `"grocery"` object (place it after `"fx"`):

```json
"grocery": {
  "title": "Grocery",
  "empty": "No lists yet. Create one below.",
  "activeSection": "Active",
  "completedSection": "Completed",
  "newListTitle": "New list",
  "nameLabel": "List name",
  "currencyLabel": "Currency",
  "createCta": "Create list",
  "openCta": "Open",
  "itemsCount": "{{count}} item",
  "itemsCount_other": "{{count}} items",
  "estimatedTotal": "Estimated",
  "actualTotal": "Spent",
  "purchasedOf": "{{done}} of {{total}} purchased",
  "addItemTitle": "Add item",
  "itemNameLabel": "Item",
  "quantityLabel": "Qty",
  "unitLabel": "Unit",
  "estimatedLabel": "Est. price",
  "actualLabel": "Actual price",
  "addCta": "Add",
  "markPurchased": "Mark purchased",
  "markUnpurchased": "Undo",
  "addedBy": "Added by {{name}}",
  "purchasedBy": "Bought by {{name}}",
  "deleteItem": "Delete",
  "completeTitle": "Complete shopping trip",
  "accountLabel": "Pay from account",
  "categoryLabel": "Category (optional)",
  "completeCta": "Complete trip",
  "completedNote": "Completed — logged as an expense.",
  "someone": "someone",
  "errors": {
    "loadFailed": "Couldn't load grocery lists.",
    "listFailed": "Couldn't create the list.",
    "itemFailed": "Couldn't add the item.",
    "saveFailed": "Couldn't save changes.",
    "deleteFailed": "Couldn't delete the item.",
    "checkoutFailed": "Couldn't complete the trip. Check the account currency matches the list.",
    "noAccount": "Add an account in this currency first."
  }
}
```

- [ ] **Step 2: Add the same block to `locales/fil.json`** (Filipino translations)

```json
"grocery": {
  "title": "Groseri",
  "empty": "Wala pang listahan. Gumawa ng isa sa ibaba.",
  "activeSection": "Aktibo",
  "completedSection": "Tapos na",
  "newListTitle": "Bagong listahan",
  "nameLabel": "Pangalan ng listahan",
  "currencyLabel": "Pera",
  "createCta": "Gumawa ng listahan",
  "openCta": "Buksan",
  "itemsCount": "{{count}} item",
  "itemsCount_other": "{{count}} na item",
  "estimatedTotal": "Tinatantya",
  "actualTotal": "Nagastos",
  "purchasedOf": "{{done}} sa {{total}} nabili",
  "addItemTitle": "Magdagdag ng item",
  "itemNameLabel": "Item",
  "quantityLabel": "Dami",
  "unitLabel": "Yunit",
  "estimatedLabel": "Tinatayang presyo",
  "actualLabel": "Aktwal na presyo",
  "addCta": "Idagdag",
  "markPurchased": "Markahang nabili",
  "markUnpurchased": "Ibalik",
  "addedBy": "Idinagdag ni {{name}}",
  "purchasedBy": "Binili ni {{name}}",
  "deleteItem": "Burahin",
  "completeTitle": "Tapusin ang pamimili",
  "accountLabel": "Bayad mula sa account",
  "categoryLabel": "Kategorya (opsyonal)",
  "completeCta": "Tapusin",
  "completedNote": "Tapos na — naitala bilang gastos.",
  "someone": "isang tao",
  "errors": {
    "loadFailed": "Hindi ma-load ang mga listahan.",
    "listFailed": "Hindi magawa ang listahan.",
    "itemFailed": "Hindi maidagdag ang item.",
    "saveFailed": "Hindi ma-save ang mga pagbabago.",
    "deleteFailed": "Hindi mabura ang item.",
    "checkoutFailed": "Hindi matapos. Tiyaking tugma ang pera ng account sa listahan.",
    "noAccount": "Magdagdag muna ng account sa perang ito."
  }
}
```

- [ ] **Step 3: Add the same block to `locales/ar.json`** (Arabic translations, RTL)

```json
"grocery": {
  "title": "البقالة",
  "empty": "لا توجد قوائم بعد. أنشئ واحدة أدناه.",
  "activeSection": "نشطة",
  "completedSection": "مكتملة",
  "newListTitle": "قائمة جديدة",
  "nameLabel": "اسم القائمة",
  "currencyLabel": "العملة",
  "createCta": "إنشاء قائمة",
  "openCta": "فتح",
  "itemsCount": "عنصر {{count}}",
  "itemsCount_other": "{{count}} عناصر",
  "estimatedTotal": "المقدّر",
  "actualTotal": "المصروف",
  "purchasedOf": "{{done}} من {{total}} تم شراؤها",
  "addItemTitle": "إضافة عنصر",
  "itemNameLabel": "العنصر",
  "quantityLabel": "الكمية",
  "unitLabel": "الوحدة",
  "estimatedLabel": "السعر المقدّر",
  "actualLabel": "السعر الفعلي",
  "addCta": "إضافة",
  "markPurchased": "تحديد كمشترى",
  "markUnpurchased": "تراجع",
  "addedBy": "أضافه {{name}}",
  "purchasedBy": "اشتراه {{name}}",
  "deleteItem": "حذف",
  "completeTitle": "إنهاء رحلة التسوق",
  "accountLabel": "الدفع من حساب",
  "categoryLabel": "الفئة (اختياري)",
  "completeCta": "إنهاء",
  "completedNote": "اكتمل — سُجّل كمصروف.",
  "someone": "شخص ما",
  "errors": {
    "loadFailed": "تعذّر تحميل القوائم.",
    "listFailed": "تعذّر إنشاء القائمة.",
    "itemFailed": "تعذّرت إضافة العنصر.",
    "saveFailed": "تعذّر حفظ التغييرات.",
    "deleteFailed": "تعذّر حذف العنصر.",
    "checkoutFailed": "تعذّر الإنهاء. تأكد من تطابق عملة الحساب مع القائمة.",
    "noAccount": "أضف حسابًا بهذه العملة أولاً."
  }
}
```

- [ ] **Step 4: Verify the i18n test + typecheck pass**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (the i18n test verifies locale files parse / key parity if implemented).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(grocery): i18n strings for en, fil, ar"
```

---

### Task 7: Lists index screen + stack layout

**Files:**
- Create: `app/grocery/_layout.tsx`
- Modify (replace placeholder): `app/(tabs)/grocery.tsx`

**Interfaces:**
- Consumes: `listLists`, `createList`, `subscribeToLists` from `features/grocery/api`; `createListSchema`; `useActiveHousehold`; `GroceryListRow`.
- Produces: navigable list index; taps route to `/grocery/[id]`.

- [ ] **Step 1: Create the grocery stack layout**

Create `app/grocery/_layout.tsx`:

```typescript
/** Grocery section stack (list detail screens open on top of the tab). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function GroceryLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Replace the grocery tab placeholder with the lists index**

Replace the entire contents of `app/(tabs)/grocery.tsx`:

```typescript
/** Grocery tab: household shopping lists (live) + create. */

import { getLocales } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createList, listLists, subscribeToLists } from '@/features/grocery/api';
import { createListSchema } from '@/features/grocery/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(fallback: string): string {
  try {
    return getLocales()[0]?.currencyCode ?? fallback;
  } catch {
    return fallback;
  }
}

export default function GroceryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [lists, setLists] = useState<GroceryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setLists(await listLists(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live updates while the tab is mounted.
  useEffect(() => {
    if (!active) return;
    if (!currency) setCurrency(deviceCurrency(active.reporting_currency_code));
    const unsub = subscribeToLists(active.id, () => void load());
    return unsub;
  }, [active, currency, load]);

  async function onCreate() {
    if (!active) return;
    const result = validate(createListSchema, { name, currencyCode: currency });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createList(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
      });
      setName('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const active_ = lists.filter((l) => l.status === 'active');
  const completed = lists.filter((l) => l.status === 'completed');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : lists.length === 0 ? (
          <Text muted>{t('grocery.empty')}</Text>
        ) : (
          <View style={styles.groups}>
            {active_.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.activeSection')}</Text>
                {active_.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{l.currency_code}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {completed.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.completedSection')}</Text>
                {completed.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{t('grocery.completedNote')}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('grocery.newListTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('grocery.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('grocery.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <Button
            label={submitting ? t('auth.processing') : t('grocery.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/grocery/_layout.tsx "app/(tabs)/grocery.tsx"
git commit -m "feat(grocery): live lists index + section stack layout"
```

---

### Task 8: List detail screen (items, purchase, checkout)

**Files:**
- Create: `app/grocery/[id].tsx`

**Interfaces:**
- Consumes: `getList`, `listItems`, `addItem`, `setPurchased`, `deleteItem`, `completeList`, `subscribeToItems` from `features/grocery/api`; `addItemSchema`; `estimatedTotalMinor`, `actualTotalMinor`, `purchasedCount`; `listAccounts`, `listCategories` from `features/finance/api`; `formatAmount`, `toMinorUnits`.
- Produces: the interactive per-list screen.

- [ ] **Step 1: Create the list detail screen**

Create `app/grocery/[id].tsx`:

```typescript
/** Grocery list detail: live items, purchase toggle, totals, and checkout. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
import {
  addItem,
  completeList,
  deleteItem,
  getList,
  listItems,
  setPurchased,
  subscribeToItems,
} from '@/features/grocery/api';
import { addItemSchema } from '@/features/grocery/schemas';
import { actualTotalMinor, estimatedTotalMinor, purchasedCount } from '@/features/grocery/totals';
import type { AccountRow, CategoryRow, GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function GroceryListScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);

  const [list, setList] = useState<GroceryListRow | null>(null);
  const [items, setItems] = useState<GroceryItemRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [est, setEst] = useState('');
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    setErrorKey(null);
    try {
      const l = await getList(listId);
      setList(l);
      const [its, accs] = await Promise.all([
        listItems(listId),
        l ? listAccounts(l.household_id) : Promise.resolve([]),
      ]);
      setItems(its);
      setAccounts(accs.filter((a) => !l || a.currency_code === l.currency_code));
      if (l) setCategories(await listCategories(l.household_id, 'expense'));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const unsub = subscribeToItems(listId, () => void load());
    return unsub;
  }, [listId, load]);

  async function onAdd() {
    const result = validate(addItemSchema, { name, quantity: qty, estimatedMajor: est });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    try {
      const ccy = list?.currency_code ?? 'USD';
      await addItem(listId, {
        name: result.data.name,
        quantity: result.data.quantity,
        unit: result.data.unit,
        estimatedPriceMinor:
          result.data.estimatedMajor === undefined
            ? undefined
            : toMinorUnits(result.data.estimatedMajor, ccy),
      });
      setName('');
      setQty('');
      setEst('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onToggle(item: GroceryItemRow) {
    try {
      const ccy = list?.currency_code ?? 'USD';
      const raw = actualInputs[item.id];
      const actualMinor =
        !item.is_purchased && raw ? toMinorUnits(Number(raw), ccy) : undefined;
      await setPurchased(item.id, !item.is_purchased, actualMinor);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onDelete(item: GroceryItemRow) {
    try {
      await deleteItem(item.id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onComplete() {
    if (!list || accounts.length === 0) {
      setErrorKey('grocery.errors.noAccount');
      return;
    }
    setCheckingOut(true);
    try {
      // MVP: pay from the first same-currency account; category optional (first expense category).
      await completeList(listId, accounts[0].id, categories[0]?.id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  const ccy = list?.currency_code ?? 'USD';
  const isCompleted = list?.status === 'completed';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.summary}>
          <Text variant="caption" muted>
            {t('grocery.estimatedTotal')}: {formatAmount(estimatedTotalMinor(items), ccy)}
          </Text>
          <Text variant="caption" muted>
            {t('grocery.actualTotal')}: {formatAmount(actualTotalMinor(items), ccy)}
          </Text>
          <Text variant="caption" muted>
            {t('grocery.purchasedOf', { done: purchasedCount(items), total: items.length })}
          </Text>
        </View>

        <View style={styles.list}>
          {items.map((it) => (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text variant="heading" style={it.is_purchased ? styles.struck : undefined}>
                  {it.name}
                  {it.unit ? ` · ${it.quantity} ${it.unit}` : ` · ${it.quantity}`}
                </Text>
                <Text variant="caption" muted>
                  {formatAmount(it.actual_price_minor ?? it.estimated_price_minor ?? 0, ccy)}
                </Text>
              </View>
              {!isCompleted && (
                <View style={styles.inlineRow}>
                  {!it.is_purchased && (
                    <View style={styles.inlineField}>
                      <TextField
                        label={t('grocery.actualLabel')}
                        value={actualInputs[it.id] ?? ''}
                        onChangeText={(v) => setActualInputs((p) => ({ ...p, [it.id]: v }))}
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                  <Button
                    label={it.is_purchased ? t('grocery.markUnpurchased') : t('grocery.markPurchased')}
                    onPress={() => onToggle(it)}
                  />
                  <Pressable onPress={() => onDelete(it)}>
                    <Text variant="caption" style={{ color: palette.danger }}>
                      {t('grocery.deleteItem')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>

        {!isCompleted && (
          <>
            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.addItemTitle')}</Text>
            <View style={styles.form}>
              <TextField
                label={t('grocery.itemNameLabel')}
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                error={fieldErrors.name ? t('errors.validation') : undefined}
              />
              <TextField label={t('grocery.quantityLabel')} value={qty} onChangeText={setQty} keyboardType="numeric" />
              <TextField label={t('grocery.estimatedLabel')} value={est} onChangeText={setEst} keyboardType="numeric" />
              <Button label={t('grocery.addCta')} onPress={onAdd} />
            </View>

            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.completeTitle')}</Text>
            <Button
              label={checkingOut ? t('auth.processing') : t('grocery.completeCta')}
              onPress={onComplete}
              loading={checkingOut}
            />
          </>
        )}

        {isCompleted && <Text muted>{t('grocery.completedNote')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  summary: { gap: spacing.xs },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  struck: { textDecorationLine: 'line-through' },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  inlineField: { flex: 1 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

Note: the MVP checkout pays from the first same-currency account and uses the
first expense category. A picker UI can be added later; the RPC already accepts
explicit account/category ids.

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "app/grocery/[id].tsx"
git commit -m "feat(grocery): list detail — items, purchase toggle, totals, checkout"
```

---

### Task 9: Extend RLS + realtime integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `signedInClient`, `a`, `b`, `hid`, `accId`, `admin`).
- Produces: grocery isolation + checkout + realtime assertions.

- [ ] **Step 1: Add grocery setup where A owns the household (after the finance setup block)**

Inside `main()`, after A creates accounts/transactions (near the transfer
assertions, before the "B cannot read" section), add:

```javascript
  // --- grocery: A creates a list + item -------------------------------------
  const { data: gl, error: glErr } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'Weekly', currency_code: 'PHP', created_by: idA })
    .select('id')
    .single();
  ok('A can create a grocery list', !glErr && Boolean(gl?.id));
  const listId = gl?.id;

  const { data: gi, error: giErr } = await a
    .from('grocery_items')
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000', // overwritten by trigger
      name: 'Rice',
      quantity: 2,
      estimated_price_minor: 30000,
      added_by: idA,
    })
    .select('id, household_id')
    .single();
  ok('A can add an item; trigger sets household_id', !giErr && gi?.household_id === hid);

  // Mark purchased with an actual price, then complete the trip.
  await a
    .from('grocery_items')
    .update({ is_purchased: true, purchased_by: idA, actual_price_minor: 28500 })
    .eq('id', gi?.id);
  const { data: txId, error: coErr } = await a.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok('A can complete the trip (checkout RPC)', !coErr && Boolean(txId));

  const { data: coTx } = await a
    .from('transactions')
    .select('amount_minor, type')
    .eq('id', txId)
    .single();
  ok('checkout created one expense equal to purchased sum (28500)',
    coTx?.type === 'expense' && coTx?.amount_minor === 28500);
```

- [ ] **Step 2: Add the currency-mismatch rejection assertion**

Right after the checkout block above:

```javascript
  // A second list in a different currency cannot check out against a PHP account.
  const { data: gl2 } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'USD trip', currency_code: 'USD', created_by: idA })
    .select('id')
    .single();
  await a.from('grocery_items').insert({
    list_id: gl2?.id,
    household_id: '00000000-0000-0000-0000-000000000000',
    name: 'Item',
    quantity: 1,
    is_purchased: true,
    purchased_by: idA,
    actual_price_minor: 500,
    added_by: idA,
  });
  const { error: mismatchErr } = await a.rpc('complete_grocery_list', {
    _list_id: gl2?.id,
    _account_id: accId, // PHP account
    _category_id: null,
  });
  ok('checkout rejects account/list currency mismatch', Boolean(mismatchErr));
```

- [ ] **Step 3: Add B-cannot-access assertions (in the "B cannot read A" section, before B joins)**

```javascript
  // B CANNOT read or write A's grocery lists/items (not a member yet).
  const { data: bLists } = await b.from('grocery_lists').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery lists (RLS)", (bLists ?? []).length === 0);
  const { data: bItems } = await b.from('grocery_items').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery items (RLS)", (bItems ?? []).length === 0);
  const { error: bListErr } = await b
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'X', currency_code: 'PHP', created_by: idB });
  ok("B cannot create a list in A's household", Boolean(bListErr));
  const { error: bCoErr } = await b.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok("B cannot complete A's list via RPC", Boolean(bCoErr));
```

- [ ] **Step 4: Add a best-effort realtime propagation assertion (after B joins, at the end of `main()` before the closing brace)**

```javascript
  // --- realtime: B (now a member) receives A's item insert live -------------
  const received = await new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const channel = b
      .channel(`test_items:${listId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
        () => finish(true),
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await a.from('grocery_items').insert({
            list_id: listId,
            household_id: '00000000-0000-0000-0000-000000000000',
            name: 'Live item',
            quantity: 1,
            added_by: idA,
          });
        }
      });
    setTimeout(() => finish(false), 8000);
    // best effort: caller ignores channel cleanup; test process exits after.
  });
  ok('realtime delivers A\'s insert to member B within 8s', received === true);
```

- [ ] **Step 5: Run the RLS/integration suite**

Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `.env` temporarily, then:

Run: `npm run test:rls`
Expected: all assertions pass, including the new grocery ones. (If the realtime
assertion is flaky due to network, re-run; document a manual two-device check as
backup. Realtime must be enabled on the tables — done in Task 1.)

- [ ] **Step 6: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(grocery): RLS isolation, checkout, currency-guard, realtime propagation"
```

---

### Task 10: Final verification + memory/state note

**Files:** none (verification + optional cleanup)

- [ ] **Step 1: Full verification sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls
```
Expected: typecheck clean; all unit suites pass (now including `tests/grocery/totals.test.ts`); RLS suite passes including grocery assertions.

- [ ] **Step 2: Confirm the tab is wired**

`app/(tabs)/_layout.tsx` already registers the `grocery` tab (`nav.grocery`).
Manually confirm: open the app, Grocery tab → create a list → open it → add an
item → mark purchased with a price → Complete trip → verify an expense appears in
Transactions and the dashboard total. (Two devices/browsers for the live check.)

- [ ] **Step 3: Remove the temporary service-role key**

If added to `.env` for the RLS test, remove `SUPABASE_SERVICE_ROLE_KEY` again
(it must never ship).

- [ ] **Step 4: Final commit (if any stray changes)**

```bash
git status
# commit anything outstanding with an appropriate message
```

---

## Self-Review

**Spec coverage:**
- grocery_lists / grocery_items → Task 1 ✓
- realtime household sync → Task 1 (publication) + Task 5 (subscribe helpers) + Tasks 7/8 (screen wiring) + Task 9 (test) ✓
- added_by / purchased_by → Task 1 (columns) + Task 5 (`setPurchased`) + Task 8 (attribution display uses added_by/purchased_by; display names are out of scope — shows via caption) ✓
- quantity/unit → Task 1 + Task 8 ✓
- estimated/actual price (integer minor, list currency) → Tasks 1, 3, 5, 8 ✓
- convert purchase to household expense → Task 1 (`complete_grocery_list`) + Task 5 (`completeList`) + Task 8 (checkout) + Task 9 (assertion) ✓
- one currency per list → Task 1 (`currency_code` + RPC guard) + Task 8 (account filter) ✓
- attribution only, no push → nothing pulls expo-notifications ✓
- multiple named lists → Task 1 + Task 7 ✓
- multi-device concurrency + household isolation test → Task 9 ✓
- i18n en/fil/ar → Task 6 ✓
- types → Task 2 ✓
- unit tests for totals → Task 3 ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. The one design
decision "checkout rejects 0 purchased" is enforced in the RPC (`_total <= 0`).

**Type consistency:** `GroceryListRow`/`GroceryItemRow` (Task 2) are used verbatim
in Tasks 3/5/7/8. API function names (`listLists`, `createList`, `getList`,
`listItems`, `addItem`, `updateItem`, `setPurchased`, `deleteItem`, `completeList`,
`subscribeToLists`, `subscribeToItems`) are defined in Task 5 and consumed with the
same names/signatures in Tasks 7/8. Totals helpers (`estimatedTotalMinor`,
`actualTotalMinor`, `purchasedCount`) match between Task 3 and Task 8.

**Note on attribution display:** Task 8 tracks `added_by`/`purchased_by` ids;
resolving them to display names needs a profiles lookup. For this phase the
attribution keys (`grocery.addedBy`/`purchasedBy`) exist and the ids are stored;
wiring the name lookup is a small follow-up and does not block the phase goal.


## plan 2026-08-12-phase5a-retail-foundation

# Phase 5 Slice 5a — Retail Foundation & Browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a household-scoped, manually-entered retail catalog (retailers → branches → products → per-branch price snapshots) with unit-price normalization, freshness labels, saved shopping locations + GPS nearest-branch, and a types-only connector interface.

**Architecture:** Six new `household_id`-scoped Postgres tables with RLS mirroring finance, plus a `set_active_saved_location` RPC and a currency-enforcing trigger on price snapshots. Client follows the `features/<domain>` boundary: three pure helpers (unit-price, freshness, distance) unit-tested, a types-only connector interface, zod schemas, `api.ts` data access, and an `app/retail/` Expo Router stack reached from the More tab. i18n in three locales.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), zod, i18next, jest, expo-location.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.** Prices in the store's currency; use `lib/money.ts`.
- **No mixing currencies.** A price snapshot's currency follows its store (trigger-enforced when `store_id` set).
- **RLS is the security boundary.** SELECT `public.is_member_of(household_id)`; writes `public.has_role_in(household_id, array[...]::public.household_role[])`.
- **Catalog is household-scoped.** Every table carries `household_id`.
- **Data is manual this slice.** No live connectors, no Edge Function, no scraping. The connector interface is types only, not imported by UI.
- **Data access only through `features/retail/api.ts`.** Screens never call `getSupabase()` directly; results cast to `lib/database.types.ts` at that boundary.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000006_retail.sql`.
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls` (needs `SUPABASE_SERVICE_ROLE_KEY` temporarily in `.env`).

---

### Task 1: Database migration — retail schema, RLS, trigger, RPC

**Files:**
- Create: `supabase/migrations/20260812000006_retail.sql`

**Interfaces:**
- Consumes: `public.households`, helpers `public.is_member_of(uuid)`, `public.has_role_in(uuid, public.household_role[])`, `public.set_updated_at()`.
- Produces: tables `retailers`, `retailer_stores`, `products`, `retailer_products`, `price_snapshots`, `saved_locations`; RPC `public.set_active_saved_location(_id uuid) returns void`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260812000006_retail.sql`:

```sql
-- ============================================================================
-- Phase 5 slice 5a — Retail foundation (household-scoped, manual data)
-- ============================================================================
-- Hierarchy: retailer -> store/branch -> (product <-> retailer_product) -> price
-- snapshot. All household-scoped with finance-style RLS. Prices are integer
-- minor units in the store's currency. A types-only connector interface lives in
-- the client; live adapters + a global catalog arrive in slice 5d.
-- ============================================================================

create table if not exists public.retailers (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  website      text,
  notes        text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_retailers_household on public.retailers (household_id, name);

drop trigger if exists trg_retailers_updated_at on public.retailers;
create trigger trg_retailers_updated_at
  before update on public.retailers
  for each row execute function public.set_updated_at();

create table if not exists public.retailer_stores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  retailer_id   uuid not null references public.retailers (id) on delete cascade,
  name          text not null,
  street        text,
  city          text,
  region        text,
  postal_code   text,
  country_code  text check (country_code ~ '^[A-Z]{2}$'),
  latitude      numeric,
  longitude     numeric,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  is_online     boolean not null default false,
  timezone      text,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_stores_retailer on public.retailer_stores (retailer_id);
create index if not exists idx_stores_household on public.retailer_stores (household_id);

drop trigger if exists trg_stores_updated_at on public.retailer_stores;
create trigger trg_stores_updated_at
  before update on public.retailer_stores
  for each row execute function public.set_updated_at();

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  brand        text,
  gtin         text,
  upc          text,
  ean          text,
  size_value   numeric,
  size_unit    text,
  pack_count   integer not null default 1 check (pack_count > 0),
  category     text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_products_household on public.products (household_id, name);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.retailer_products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  retailer_id  uuid not null references public.retailers (id) on delete cascade,
  retailer_sku text,
  display_name text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, product_id, retailer_id)
);
create index if not exists idx_retailer_products_product on public.retailer_products (product_id);

drop trigger if exists trg_retailer_products_updated_at on public.retailer_products;
create trigger trg_retailer_products_updated_at
  before update on public.retailer_products
  for each row execute function public.set_updated_at();

create table if not exists public.price_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  retailer_product_id uuid not null references public.retailer_products (id) on delete cascade,
  store_id            uuid references public.retailer_stores (id) on delete cascade,
  regular_price_minor bigint not null check (regular_price_minor >= 0),
  sale_price_minor    bigint check (sale_price_minor >= 0),
  member_price_minor  bigint check (member_price_minor >= 0),
  currency_code       text not null check (currency_code ~ '^[A-Z]{3}$'),
  observed_at         timestamptz not null default now(),
  valid_until         timestamptz,
  source              text not null default 'manual',
  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default now()
);
create index if not exists idx_prices_lookup
  on public.price_snapshots (household_id, retailer_product_id, observed_at desc);

-- When a store is given, currency follows the store and cross-household is blocked.
create or replace function public.price_snapshots_enforce_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h   uuid;
  _ccy text;
begin
  if new.store_id is not null then
    select household_id, currency_code into _h, _ccy
    from public.retailer_stores where id = new.store_id;
    if _h is null then
      raise exception 'store not found';
    end if;
    if _h <> new.household_id then
      raise exception 'store does not belong to the given household';
    end if;
    new.currency_code := _ccy;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prices_enforce_store on public.price_snapshots;
create trigger trg_prices_enforce_store
  before insert or update on public.price_snapshots
  for each row execute function public.price_snapshots_enforce_store();

create table if not exists public.saved_locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label        text not null,
  store_id     uuid not null references public.retailer_stores (id) on delete cascade,
  is_active    boolean not null default false,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- At most one active saved location per household.
create unique index if not exists uniq_saved_location_active
  on public.saved_locations (household_id) where is_active;

drop trigger if exists trg_saved_locations_updated_at on public.saved_locations;
create trigger trg_saved_locations_updated_at
  before update on public.saved_locations
  for each row execute function public.set_updated_at();

-- Atomically make one saved location active (clear others first).
create or replace function public.set_active_saved_location(_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _hid uuid;
begin
  select household_id into _hid from public.saved_locations where id = _id;
  if _hid is null then
    raise exception 'saved location not found';
  end if;
  if not public.has_role_in(_hid, array['owner','admin','member']::public.household_role[]) then
    raise exception 'not authorized';
  end if;
  update public.saved_locations set is_active = false
    where household_id = _hid and is_active = true;
  update public.saved_locations set is_active = true where id = _id;
end;
$$;

-- ===========================================================================
-- RLS — one pattern for all six tables
-- ===========================================================================
alter table public.retailers         enable row level security;
alter table public.retailer_stores   enable row level security;
alter table public.products          enable row level security;
alter table public.retailer_products enable row level security;
alter table public.price_snapshots   enable row level security;
alter table public.saved_locations   enable row level security;

-- retailers (catalog: delete = owner/admin)
drop policy if exists retailers_select on public.retailers;
create policy retailers_select on public.retailers
  for select using (public.is_member_of(household_id));
drop policy if exists retailers_insert on public.retailers;
create policy retailers_insert on public.retailers
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists retailers_update on public.retailers;
create policy retailers_update on public.retailers
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists retailers_delete on public.retailers;
create policy retailers_delete on public.retailers
  for delete using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

-- retailer_stores (catalog)
drop policy if exists stores_select on public.retailer_stores;
create policy stores_select on public.retailer_stores
  for select using (public.is_member_of(household_id));
drop policy if exists stores_insert on public.retailer_stores;
create policy stores_insert on public.retailer_stores
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists stores_update on public.retailer_stores;
create policy stores_update on public.retailer_stores
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists stores_delete on public.retailer_stores;
create policy stores_delete on public.retailer_stores
  for delete using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

-- products (catalog)
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (public.is_member_of(household_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

-- retailer_products (catalog)
drop policy if exists retailer_products_select on public.retailer_products;
create policy retailer_products_select on public.retailer_products
  for select using (public.is_member_of(household_id));
drop policy if exists retailer_products_insert on public.retailer_products;
create policy retailer_products_insert on public.retailer_products
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists retailer_products_update on public.retailer_products;
create policy retailer_products_update on public.retailer_products
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists retailer_products_delete on public.retailer_products;
create policy retailer_products_delete on public.retailer_products
  for delete using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

-- price_snapshots (writers may delete)
drop policy if exists prices_select on public.price_snapshots;
create policy prices_select on public.price_snapshots
  for select using (public.is_member_of(household_id));
drop policy if exists prices_insert on public.price_snapshots;
create policy prices_insert on public.price_snapshots
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists prices_update on public.price_snapshots;
create policy prices_update on public.price_snapshots
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists prices_delete on public.price_snapshots;
create policy prices_delete on public.price_snapshots
  for delete using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

-- saved_locations (writers may delete)
drop policy if exists saved_locations_select on public.saved_locations;
create policy saved_locations_select on public.saved_locations
  for select using (public.is_member_of(household_id));
drop policy if exists saved_locations_insert on public.saved_locations;
create policy saved_locations_insert on public.saved_locations
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));
drop policy if exists saved_locations_update on public.saved_locations;
create policy saved_locations_update on public.saved_locations
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));
drop policy if exists saved_locations_delete on public.saved_locations;
create policy saved_locations_delete on public.saved_locations
  for delete using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

-- ===========================================================================
-- Grants
-- ===========================================================================
grant select, insert, update, delete on public.retailers         to authenticated;
grant select, insert, update, delete on public.retailer_stores   to authenticated;
grant select, insert, update, delete on public.products          to authenticated;
grant select, insert, update, delete on public.retailer_products to authenticated;
grant select, insert, update, delete on public.price_snapshots   to authenticated;
grant select, insert, update, delete on public.saved_locations   to authenticated;
```

- [ ] **Step 2: Apply the migration to Supabase**

Paste the file into the Supabase SQL editor and run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('retailers','retailer_stores','products','retailer_products','price_snapshots','saved_locations');
select proname from pg_proc where proname in ('set_active_saved_location','price_snapshots_enforce_store');
```
Expected: 6 tables, 2 functions.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000006_retail.sql
git commit -m "feat(retail): 5a schema — retailers, stores, products, prices, saved locations, RLS"
```

---

### Task 2: TypeScript database types

**Files:**
- Modify: `lib/database.types.ts` (append a Phase 5 section at EOF, after the Phase 4 grocery types)

**Interfaces:**
- Produces: `RetailerRow`, `RetailerStoreRow`, `ProductRow`, `RetailerProductRow`, `PriceSnapshotRow`, `SavedLocationRow`.

- [ ] **Step 1: Append the retail types**

At the end of `lib/database.types.ts`:

```typescript
// --- Phase 5 (5a): retail foundation ---------------------------------------
export interface RetailerRow {
  id: string;
  household_id: string;
  name: string;
  country_code: string | null;
  website: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RetailerStoreRow {
  id: string;
  household_id: string;
  retailer_id: string;
  name: string;
  street: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  currency_code: string;
  is_online: boolean;
  timezone: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  upc: string | null;
  ean: string | null;
  size_value: number | null;
  size_unit: string | null;
  pack_count: number;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RetailerProductRow {
  id: string;
  household_id: string;
  product_id: string;
  retailer_id: string;
  retailer_sku: string | null;
  display_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PriceSnapshotRow {
  id: string;
  household_id: string;
  retailer_product_id: string;
  store_id: string | null;
  regular_price_minor: number;
  sale_price_minor: number | null;
  member_price_minor: number | null;
  currency_code: string;
  observed_at: string;
  valid_until: string | null;
  source: string;
  created_by: string;
  created_at: string;
}

export interface SavedLocationRow {
  id: string;
  household_id: string;
  label: string;
  store_id: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(retail): add row types for retail tables"
```

---

### Task 3: Pure helpers — unit price, freshness, distance (TDD)

**Files:**
- Create: `features/retail/unitPrice.ts`, `features/retail/freshness.ts`, `features/retail/distance.ts`
- Test: `tests/retail/unitPrice.test.ts`, `tests/retail/freshness.test.ts`, `tests/retail/distance.test.ts`

**Interfaces:**
- Produces:
  - `normalizeSize(sizeValue: number|null, sizeUnit: string|null, packCount: number): { base: number; unit: 'g'|'ml'|'piece' } | null`
  - `unitPriceMinor(priceMinor: number, sizeValue: number|null, sizeUnit: string|null, packCount: number): { perBaseMinor: number; unit: 'g'|'ml'|'piece' } | null`
  - `freshnessOf(observedAtMs: number, nowMs: number): 'fresh'|'recent'|'stale'`
  - `haversineKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/unitPrice.test.ts`:

```typescript
import { normalizeSize, unitPriceMinor } from '@/features/retail/unitPrice';

describe('normalizeSize', () => {
  it('converts kg to grams times pack count', () => {
    expect(normalizeSize(1.5, 'kg', 2)).toEqual({ base: 3000, unit: 'g' });
  });
  it('converts litres to millilitres', () => {
    expect(normalizeSize(2, 'L', 1)).toEqual({ base: 2000, unit: 'ml' });
  });
  it('treats pieces as count', () => {
    expect(normalizeSize(6, 'piece', 1)).toEqual({ base: 6, unit: 'piece' });
  });
  it('returns null for unknown units', () => {
    expect(normalizeSize(1, 'furlong', 1)).toBeNull();
  });
  it('returns null when size is missing', () => {
    expect(normalizeSize(null, 'kg', 1)).toBeNull();
  });
});

describe('unitPriceMinor', () => {
  it('computes price per base unit', () => {
    // 500 minor for 1kg (=1000g) => 0.5 minor per gram
    expect(unitPriceMinor(500, 1, 'kg', 1)).toEqual({ perBaseMinor: 0.5, unit: 'g' });
  });
  it('accounts for pack count', () => {
    // 1200 minor for 2 x 500ml (=1000ml) => 1.2 minor per ml
    expect(unitPriceMinor(1200, 500, 'ml', 2)).toEqual({ perBaseMinor: 1.2, unit: 'ml' });
  });
  it('returns null when size cannot be normalized', () => {
    expect(unitPriceMinor(500, null, 'kg', 1)).toBeNull();
  });
});
```

Create `tests/retail/freshness.test.ts`:

```typescript
import { freshnessOf } from '@/features/retail/freshness';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

describe('freshnessOf', () => {
  const now = 1_000 * DAY;
  it('is fresh within 24h', () => {
    expect(freshnessOf(now - 5 * HOUR, now)).toBe('fresh');
  });
  it('is recent within 7 days', () => {
    expect(freshnessOf(now - 3 * DAY, now)).toBe('recent');
  });
  it('is stale beyond 7 days', () => {
    expect(freshnessOf(now - 10 * DAY, now)).toBe('stale');
  });
  it('treats exactly 24h as recent (boundary)', () => {
    expect(freshnessOf(now - DAY, now)).toBe('recent');
  });
});
```

Create `tests/retail/distance.test.ts`:

```typescript
import { haversineKm } from '@/features/retail/distance';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 40, lng: -73 }, { lat: 40, lng: -73 })).toBe(0);
  });
  it('approximates a known distance (NYC to LA ~3936km)', () => {
    const d = haversineKm({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(3980);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail`
Expected: FAIL — cannot find the three modules.

- [ ] **Step 3: Write the implementations**

Create `features/retail/unitPrice.ts`:

```typescript
/**
 * Unit-price normalization for cross-size comparison. Sizes normalize to a
 * canonical base (weight->gram, volume->millilitre, count->piece). The returned
 * per-base price is a float used ONLY for display/comparison — never persisted.
 */

export type BaseUnit = 'g' | 'ml' | 'piece';

// factor = how many base units one input unit equals
const UNIT_FACTORS: Readonly<Record<string, { base: BaseUnit; factor: number }>> = {
  mg: { base: 'g', factor: 0.001 },
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  oz: { base: 'g', factor: 28.349523125 },
  lb: { base: 'g', factor: 453.59237 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  floz: { base: 'ml', factor: 29.5735295625 },
  gal: { base: 'ml', factor: 3785.411784 },
  piece: { base: 'piece', factor: 1 },
  pc: { base: 'piece', factor: 1 },
  pcs: { base: 'piece', factor: 1 },
  pack: { base: 'piece', factor: 1 },
  ct: { base: 'piece', factor: 1 },
};

/** Total base-unit quantity for a size across the whole pack, or null. */
export function normalizeSize(
  sizeValue: number | null,
  sizeUnit: string | null,
  packCount: number,
): { base: number; unit: BaseUnit } | null {
  if (sizeValue == null || sizeUnit == null || !Number.isFinite(sizeValue) || sizeValue <= 0) {
    return null;
  }
  const key = sizeUnit.trim().toLowerCase().replace(/\s+/g, '');
  const entry = UNIT_FACTORS[key];
  if (!entry) return null;
  const count = Number.isFinite(packCount) && packCount > 0 ? packCount : 1;
  return { base: sizeValue * entry.factor * count, unit: entry.base };
}

/** Minor units per base unit (for comparison), or null if size is unknown. */
export function unitPriceMinor(
  priceMinor: number,
  sizeValue: number | null,
  sizeUnit: string | null,
  packCount: number,
): { perBaseMinor: number; unit: BaseUnit } | null {
  const size = normalizeSize(sizeValue, sizeUnit, packCount);
  if (!size || size.base <= 0) return null;
  return { perBaseMinor: priceMinor / size.base, unit: size.unit };
}
```

Create `features/retail/freshness.ts`:

```typescript
/**
 * Price freshness buckets from an observation timestamp. Screens turn these into
 * localized "Last updated…" labels. Boundaries: <24h fresh, <7d recent, else stale.
 */

export type Freshness = 'fresh' | 'recent' | 'stale';

const DAY = 24 * 3600 * 1000;

export function freshnessOf(observedAtMs: number, nowMs: number): Freshness {
  const age = nowMs - observedAtMs;
  if (age < DAY) return 'fresh';
  if (age < 7 * DAY) return 'recent';
  return 'stale';
}
```

Create `features/retail/distance.ts`:

```typescript
/** Great-circle distance in kilometres between two lat/lng points (haversine). */

interface Coord {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail`
Expected: PASS (all three suites).

- [ ] **Step 5: Commit**

```bash
git add features/retail/unitPrice.ts features/retail/freshness.ts features/retail/distance.ts tests/retail
git commit -m "feat(retail): pure helpers for unit price, freshness, distance + tests"
```

---

### Task 4: Connector interface (types only)

**Files:**
- Create: `features/retail/connector.ts`

**Interfaces:**
- Produces: `ProductSearchInput`, `NormalizedProduct`, `PriceLookupInput`, `NormalizedPrice`, `RetailerConnector` (types only).

- [ ] **Step 1: Write the interface module**

Create `features/retail/connector.ts`:

```typescript
/**
 * Retail connector contract (slice 5d will implement adapters + a backend Price
 * API). Types ONLY — no implementations, not imported by UI. Documents the shape
 * a WalmartConnector / KrogerConnector / MerchantFeedConnector must satisfy so it
 * drops in with no schema change. Live calls run server-side (Edge Function),
 * never from the client, per the retail spec.
 */

export interface ProductSearchInput {
  query: string;
  countryCode?: string;
}

export interface NormalizedProduct {
  gtin?: string;
  name: string;
  brand?: string;
  sizeValue?: number;
  sizeUnit?: string;
  packCount?: number;
}

export interface PriceLookupInput {
  retailerProductId: string;
  storeId?: string;
}

export interface NormalizedPrice {
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  observedAt: string;
  validUntil?: string;
  source: string;
}

export interface RetailerConnector {
  retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/connector.ts
git commit -m "feat(retail): types-only connector interface for future adapters"
```

---

### Task 5: Validation schemas

**Files:**
- Create: `features/retail/schemas.ts`

**Interfaces:**
- Produces: `createRetailerSchema`, `createStoreSchema`, `createProductSchema`, `createRetailerProductSchema`, `createPriceSchema`, `createSavedLocationSchema` + inferred input types.

- [ ] **Step 1: Write the schemas**

Create `features/retail/schemas.ts`:

```typescript
/**
 * Retail form validation. Prices entered in MAJOR units; converted to minor at
 * the screen boundary (lib/money.toMinorUnits). Currency codes upper-cased.
 */

import { z } from 'zod';

const name = z.string().trim().min(1).max(120);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const country = z
  .string()
  .trim()
  .toUpperCase()
  .refine((s) => s === '' || /^[A-Z]{2}$/.test(s), { message: 'invalid_country' })
  .optional()
  .transform((v) => (v ? v : undefined));
const currency = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' });
const optionalMajor = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), { message: 'invalid_amount' });
const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isFinite(v), { message: 'invalid_number' });

export const createRetailerSchema = z.object({
  name,
  countryCode: country,
  website: optionalText(200),
  notes: optionalText(500),
});

export const createStoreSchema = z.object({
  name,
  street: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(20),
  countryCode: country,
  latitude: optionalNumber,
  longitude: optionalNumber,
  currencyCode: currency,
  isOnline: z.boolean().optional(),
});

export const createProductSchema = z.object({
  name,
  brand: optionalText(120),
  gtin: optionalText(20),
  upc: optionalText(20),
  ean: optionalText(20),
  sizeValue: optionalNumber,
  sizeUnit: optionalText(24),
  packCount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 1 : Number(v)))
    .refine((v) => Number.isInteger(v) && v > 0, { message: 'invalid_pack' }),
  category: optionalText(80),
});

export const createRetailerProductSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  retailerSku: optionalText(80),
  displayName: optionalText(120),
});

export const createPriceSchema = z.object({
  retailerProductId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  regularMajor: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0, { message: 'invalid_amount' }),
  saleMajor: optionalMajor,
  memberMajor: optionalMajor,
  currencyCode: currency,
});

export const createSavedLocationSchema = z.object({
  label: name,
  storeId: z.string().uuid(),
});

export type CreateRetailerInput = z.infer<typeof createRetailerSchema>;
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateRetailerProductInput = z.infer<typeof createRetailerProductSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type CreateSavedLocationInput = z.infer<typeof createSavedLocationSchema>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/schemas.ts
git commit -m "feat(retail): zod validation schemas"
```

---

### Task 6: Data access API

**Files:**
- Create: `features/retail/api.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `AppError`, retail row types.
- Produces (all async unless noted):
  - `listRetailers(hid): RetailerRow[]`, `createRetailer(hid, input): RetailerRow`, `deleteRetailer(id): void`
  - `getRetailer(id): RetailerRow | null`
  - `listStores(retailerId): RetailerStoreRow[]`, `createStore(hid, retailerId, input): RetailerStoreRow`
  - `listProducts(hid): ProductRow[]`, `getProduct(id): ProductRow | null`, `createProduct(hid, input): ProductRow`
  - `listRetailerProducts(productId): RetailerProductWithRetailer[]`, `createRetailerProduct(hid, input): RetailerProductRow`
  - `listPricesForProduct(productId): PriceWithRefs[]`, `createPrice(hid, input): PriceSnapshotRow`, `deletePrice(id): void`
  - `listSavedLocations(hid): SavedLocationWithStore[]`, `createSavedLocation(hid, input): SavedLocationRow`, `setActiveLocation(id): void`
- Exports interfaces `RetailerProductWithRetailer`, `PriceWithRefs`, `SavedLocationWithStore`.

- [ ] **Step 1: Write the API module**

Create `features/retail/api.ts`:

```typescript
/**
 * Retail data access. Household scoping + writer/viewer permission are enforced
 * by RLS. Prices cross this boundary as integer minor units in the store currency.
 */

import type {
  PriceSnapshotRow,
  ProductRow,
  RetailerProductRow,
  RetailerRow,
  RetailerStoreRow,
  SavedLocationRow,
} from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type {
  CreatePriceInput,
  CreateProductInput,
  CreateRetailerInput,
  CreateRetailerProductInput,
  CreateSavedLocationInput,
  CreateStoreInput,
} from '@/features/retail/schemas';

export interface RetailerProductWithRetailer extends RetailerProductRow {
  retailer: Pick<RetailerRow, 'id' | 'name'> | null;
}
export interface PriceWithRefs extends PriceSnapshotRow {
  retailer_product: (Pick<RetailerProductRow, 'id' | 'display_name'> & {
    retailer: Pick<RetailerRow, 'id' | 'name'> | null;
  }) | null;
  store: Pick<RetailerStoreRow, 'id' | 'name' | 'currency_code' | 'latitude' | 'longitude'> | null;
}
export interface SavedLocationWithStore extends SavedLocationRow {
  store:
    | (Pick<RetailerStoreRow, 'id' | 'name' | 'latitude' | 'longitude'> & {
        retailer: Pick<RetailerRow, 'id' | 'name'> | null;
      })
    | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}
async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// --- retailers -------------------------------------------------------------
export async function listRetailers(hid: string): Promise<RetailerRow[]> {
  const { data, error } = await getSupabase()
    .from('retailers').select('*').eq('household_id', hid).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as RetailerRow[];
}
export async function getRetailer(id: string): Promise<RetailerRow | null> {
  const { data, error } = await getSupabase()
    .from('retailers').select('*').eq('id', id).maybeSingle();
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? null) as RetailerRow | null;
}
export async function createRetailer(hid: string, input: CreateRetailerInput): Promise<RetailerRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailers').insert({
    household_id: hid, name: input.name, country_code: input.countryCode ?? null,
    website: input.website ?? null, notes: input.notes ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.retailerFailed', error);
  return data as RetailerRow;
}
export async function deleteRetailer(id: string): Promise<void> {
  const { error } = await getSupabase().from('retailers').delete().eq('id', id);
  if (error) fail('retail.errors.deleteFailed', error);
}

// --- stores ----------------------------------------------------------------
export async function listStores(retailerId: string): Promise<RetailerStoreRow[]> {
  const { data, error } = await getSupabase()
    .from('retailer_stores').select('*').eq('retailer_id', retailerId).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as RetailerStoreRow[];
}
export async function createStore(
  hid: string, retailerId: string, input: CreateStoreInput,
): Promise<RetailerStoreRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailer_stores').insert({
    household_id: hid, retailer_id: retailerId, name: input.name,
    street: input.street ?? null, city: input.city ?? null, region: input.region ?? null,
    postal_code: input.postalCode ?? null, country_code: input.countryCode ?? null,
    latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    currency_code: input.currencyCode, is_online: input.isOnline ?? false, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.storeFailed', error);
  return data as RetailerStoreRow;
}

// --- products --------------------------------------------------------------
export async function listProducts(hid: string): Promise<ProductRow[]> {
  const { data, error } = await getSupabase()
    .from('products').select('*').eq('household_id', hid).order('name');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as ProductRow[];
}
export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data, error } = await getSupabase()
    .from('products').select('*').eq('id', id).maybeSingle();
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? null) as ProductRow | null;
}
export async function createProduct(hid: string, input: CreateProductInput): Promise<ProductRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('products').insert({
    household_id: hid, name: input.name, brand: input.brand ?? null,
    gtin: input.gtin ?? null, upc: input.upc ?? null, ean: input.ean ?? null,
    size_value: input.sizeValue ?? null, size_unit: input.sizeUnit ?? null,
    pack_count: input.packCount, category: input.category ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.productFailed', error);
  return data as ProductRow;
}

// --- retailer_products -----------------------------------------------------
export async function listRetailerProducts(productId: string): Promise<RetailerProductWithRetailer[]> {
  const { data, error } = await getSupabase()
    .from('retailer_products')
    .select('*, retailer:retailers(id,name)')
    .eq('product_id', productId);
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as RetailerProductWithRetailer[];
}
export async function createRetailerProduct(
  hid: string, input: CreateRetailerProductInput,
): Promise<RetailerProductRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('retailer_products').insert({
    household_id: hid, product_id: input.productId, retailer_id: input.retailerId,
    retailer_sku: input.retailerSku ?? null, display_name: input.displayName ?? null, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.retailerProductFailed', error);
  return data as RetailerProductRow;
}

// --- price snapshots -------------------------------------------------------
export async function listPricesForProduct(productId: string): Promise<PriceWithRefs[]> {
  // Two-step: retailer_products for this product, then their price snapshots.
  const rps = await listRetailerProducts(productId);
  const ids = rps.map((r) => r.id);
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select(
      '*, retailer_product:retailer_products(id,display_name,retailer:retailers(id,name)),' +
        'store:retailer_stores(id,name,currency_code,latitude,longitude)',
    )
    .in('retailer_product_id', ids)
    .order('observed_at', { ascending: false });
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as PriceWithRefs[];
}
export async function createPrice(hid: string, input: CreatePriceInput): Promise<PriceSnapshotRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('price_snapshots').insert({
    household_id: hid, retailer_product_id: input.retailerProductId, store_id: input.storeId ?? null,
    regular_price_minor: input.regularMinor, sale_price_minor: input.saleMinor ?? null,
    member_price_minor: input.memberMinor ?? null, currency_code: input.currencyCode, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.priceFailed', error);
  return data as PriceSnapshotRow;
}
export async function deletePrice(id: string): Promise<void> {
  const { error } = await getSupabase().from('price_snapshots').delete().eq('id', id);
  if (error) fail('retail.errors.deleteFailed', error);
}

// --- saved locations -------------------------------------------------------
export async function listSavedLocations(hid: string): Promise<SavedLocationWithStore[]> {
  const { data, error } = await getSupabase()
    .from('saved_locations')
    .select('*, store:retailer_stores(id,name,latitude,longitude,retailer:retailers(id,name))')
    .eq('household_id', hid)
    .order('label');
  if (error) fail('retail.errors.loadFailed', error);
  return (data ?? []) as unknown as SavedLocationWithStore[];
}
export async function createSavedLocation(
  hid: string, input: CreateSavedLocationInput,
): Promise<SavedLocationRow> {
  const created_by = await currentUserId();
  const { data, error } = await getSupabase().from('saved_locations').insert({
    household_id: hid, label: input.label, store_id: input.storeId, created_by,
  }).select('*').single();
  if (error) fail('retail.errors.locationFailed', error);
  return data as SavedLocationRow;
}
export async function setActiveLocation(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_active_saved_location', { _id: id });
  if (error) fail('retail.errors.saveFailed', error);
}
```

Note: the `CreatePriceInput` from the schema carries `regularMajor/saleMajor/memberMajor`;
`createPrice` here expects already-converted `regularMinor/saleMinor/memberMinor`. The
screen converts major→minor via `toMinorUnits` before calling. This keeps the money
conversion at the UI boundary consistent with finance/grocery.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/api.ts
git commit -m "feat(retail): data-access layer for retail catalog + prices + locations"
```

---

### Task 7: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`

**Interfaces:**
- Produces: a `retail` namespace present in all three files with identical key sets.

- [ ] **Step 1: Add the `retail` block to each locale (place after `grocery`, before `errors`)**

English (`locales/en.json`):

```json
"retail": {
  "title": "Retail",
  "hubBody": "Track retailers, branches, products, and prices for your household.",
  "activeLocation": "Active location",
  "noActiveLocation": "No active location",
  "retailers": "Retailers",
  "addRetailer": "Add retailer",
  "retailerName": "Retailer name",
  "country": "Country code",
  "website": "Website",
  "notes": "Notes",
  "branches": "Branches",
  "addBranch": "Add branch",
  "branchName": "Branch name",
  "street": "Street",
  "city": "City",
  "region": "Region",
  "postalCode": "Postal code",
  "currency": "Currency",
  "online": "Online store",
  "latitude": "Latitude",
  "longitude": "Longitude",
  "products": "Products",
  "addProduct": "Add product",
  "productName": "Product name",
  "brand": "Brand",
  "size": "Size",
  "unit": "Unit",
  "packCount": "Pack count",
  "category": "Category",
  "prices": "Prices",
  "addPrice": "Add price",
  "regularPrice": "Regular price",
  "salePrice": "Sale price",
  "memberPrice": "Member price",
  "perUnit": "{{price}} / {{unit}}",
  "atStore": "at {{store}}",
  "onlinePrice": "Online",
  "fresh": "Just updated",
  "recent": "Updated recently",
  "stale": "May be outdated",
  "distanceKm": "{{km}} km away",
  "linkRetailer": "Sell at retailer",
  "chooseRetailer": "Choose retailer",
  "chooseStore": "Choose branch (optional)",
  "chooseProduct": "Choose product",
  "savedLocations": "Saved locations",
  "addLocation": "Add location",
  "locationLabel": "Label (e.g. Home)",
  "setActive": "Set active",
  "active": "Active",
  "useCurrentLocation": "Use current location",
  "nearestBranches": "Nearest branches",
  "locationDenied": "Location permission was denied.",
  "noRetailers": "No retailers yet.",
  "noBranches": "No branches yet.",
  "noProducts": "No products yet.",
  "noPrices": "No prices recorded yet.",
  "noLocations": "No saved locations yet.",
  "open": "Retail",
  "errors": {
    "loadFailed": "Couldn't load retail data.",
    "retailerFailed": "Couldn't save the retailer.",
    "storeFailed": "Couldn't save the branch.",
    "productFailed": "Couldn't save the product.",
    "retailerProductFailed": "Couldn't link the product to the retailer.",
    "priceFailed": "Couldn't save the price.",
    "locationFailed": "Couldn't save the location.",
    "saveFailed": "Couldn't save changes.",
    "deleteFailed": "Couldn't delete."
  }
}
```

Filipino (`locales/fil.json`) — same keys, translated values:

```json
"retail": {
  "title": "Tindahan",
  "hubBody": "Subaybayan ang mga tindahan, sangay, produkto, at presyo ng inyong sambahayan.",
  "activeLocation": "Aktibong lokasyon",
  "noActiveLocation": "Walang aktibong lokasyon",
  "retailers": "Mga tindahan",
  "addRetailer": "Magdagdag ng tindahan",
  "retailerName": "Pangalan ng tindahan",
  "country": "Country code",
  "website": "Website",
  "notes": "Mga tala",
  "branches": "Mga sangay",
  "addBranch": "Magdagdag ng sangay",
  "branchName": "Pangalan ng sangay",
  "street": "Kalye",
  "city": "Lungsod",
  "region": "Rehiyon",
  "postalCode": "Postal code",
  "currency": "Pera",
  "online": "Online na tindahan",
  "latitude": "Latitude",
  "longitude": "Longitude",
  "products": "Mga produkto",
  "addProduct": "Magdagdag ng produkto",
  "productName": "Pangalan ng produkto",
  "brand": "Brand",
  "size": "Sukat",
  "unit": "Yunit",
  "packCount": "Bilang bawat pack",
  "category": "Kategorya",
  "prices": "Mga presyo",
  "addPrice": "Magdagdag ng presyo",
  "regularPrice": "Regular na presyo",
  "salePrice": "Presyong sale",
  "memberPrice": "Presyo ng miyembro",
  "perUnit": "{{price}} / {{unit}}",
  "atStore": "sa {{store}}",
  "onlinePrice": "Online",
  "fresh": "Kaka-update lang",
  "recent": "Na-update kamakailan",
  "stale": "Maaaring luma na",
  "distanceKm": "{{km}} km ang layo",
  "linkRetailer": "Ibinebenta sa tindahan",
  "chooseRetailer": "Pumili ng tindahan",
  "chooseStore": "Pumili ng sangay (opsyonal)",
  "chooseProduct": "Pumili ng produkto",
  "savedLocations": "Mga naka-save na lokasyon",
  "addLocation": "Magdagdag ng lokasyon",
  "locationLabel": "Label (hal. Bahay)",
  "setActive": "Gawing aktibo",
  "active": "Aktibo",
  "useCurrentLocation": "Gamitin ang kasalukuyang lokasyon",
  "nearestBranches": "Pinakamalapit na sangay",
  "locationDenied": "Tinanggihan ang pahintulot sa lokasyon.",
  "noRetailers": "Wala pang tindahan.",
  "noBranches": "Wala pang sangay.",
  "noProducts": "Wala pang produkto.",
  "noPrices": "Wala pang naitalang presyo.",
  "noLocations": "Wala pang naka-save na lokasyon.",
  "open": "Tindahan",
  "errors": {
    "loadFailed": "Hindi ma-load ang data ng tindahan.",
    "retailerFailed": "Hindi ma-save ang tindahan.",
    "storeFailed": "Hindi ma-save ang sangay.",
    "productFailed": "Hindi ma-save ang produkto.",
    "retailerProductFailed": "Hindi ma-link ang produkto sa tindahan.",
    "priceFailed": "Hindi ma-save ang presyo.",
    "locationFailed": "Hindi ma-save ang lokasyon.",
    "saveFailed": "Hindi ma-save ang mga pagbabago.",
    "deleteFailed": "Hindi mabura."
  }
}
```

Arabic (`locales/ar.json`) — same keys, translated values:

```json
"retail": {
  "title": "المتاجر",
  "hubBody": "تتبّع المتاجر والفروع والمنتجات والأسعار لأسرتك.",
  "activeLocation": "الموقع النشط",
  "noActiveLocation": "لا يوجد موقع نشط",
  "retailers": "المتاجر",
  "addRetailer": "إضافة متجر",
  "retailerName": "اسم المتجر",
  "country": "رمز الدولة",
  "website": "الموقع الإلكتروني",
  "notes": "ملاحظات",
  "branches": "الفروع",
  "addBranch": "إضافة فرع",
  "branchName": "اسم الفرع",
  "street": "الشارع",
  "city": "المدينة",
  "region": "المنطقة",
  "postalCode": "الرمز البريدي",
  "currency": "العملة",
  "online": "متجر إلكتروني",
  "latitude": "خط العرض",
  "longitude": "خط الطول",
  "products": "المنتجات",
  "addProduct": "إضافة منتج",
  "productName": "اسم المنتج",
  "brand": "العلامة التجارية",
  "size": "الحجم",
  "unit": "الوحدة",
  "packCount": "عدد العبوة",
  "category": "الفئة",
  "prices": "الأسعار",
  "addPrice": "إضافة سعر",
  "regularPrice": "السعر العادي",
  "salePrice": "سعر التخفيض",
  "memberPrice": "سعر العضو",
  "perUnit": "{{price}} / {{unit}}",
  "atStore": "في {{store}}",
  "onlinePrice": "عبر الإنترنت",
  "fresh": "محدّث للتو",
  "recent": "محدّث مؤخرًا",
  "stale": "قد يكون قديمًا",
  "distanceKm": "على بُعد {{km}} كم",
  "linkRetailer": "يُباع في متجر",
  "chooseRetailer": "اختر متجرًا",
  "chooseStore": "اختر فرعًا (اختياري)",
  "chooseProduct": "اختر منتجًا",
  "savedLocations": "المواقع المحفوظة",
  "addLocation": "إضافة موقع",
  "locationLabel": "التسمية (مثل: المنزل)",
  "setActive": "تعيين كنشط",
  "active": "نشط",
  "useCurrentLocation": "استخدام الموقع الحالي",
  "nearestBranches": "أقرب الفروع",
  "locationDenied": "تم رفض إذن الموقع.",
  "noRetailers": "لا توجد متاجر بعد.",
  "noBranches": "لا توجد فروع بعد.",
  "noProducts": "لا توجد منتجات بعد.",
  "noPrices": "لا توجد أسعار مسجّلة بعد.",
  "noLocations": "لا توجد مواقع محفوظة بعد.",
  "open": "المتاجر",
  "errors": {
    "loadFailed": "تعذّر تحميل بيانات المتاجر.",
    "retailerFailed": "تعذّر حفظ المتجر.",
    "storeFailed": "تعذّر حفظ الفرع.",
    "productFailed": "تعذّر حفظ المنتج.",
    "retailerProductFailed": "تعذّر ربط المنتج بالمتجر.",
    "priceFailed": "تعذّر حفظ السعر.",
    "locationFailed": "تعذّر حفظ الموقع.",
    "saveFailed": "تعذّر حفظ التغييرات.",
    "deleteFailed": "تعذّر الحذف."
  }
}
```

- [ ] **Step 2: Verify i18n parity + typecheck**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (matching key sets across languages).

- [ ] **Step 3: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(retail): i18n strings for en, fil, ar"
```

---

### Task 8: expo-location dep + retail stack + hub screen + More link

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Create: `app/retail/_layout.tsx`, `app/retail/index.tsx`
- Modify: `app/(tabs)/more.tsx`

**Interfaces:**
- Consumes: `listRetailers`, `createRetailer`, `listSavedLocations`, `setActiveLocation` from `features/retail/api`; `createRetailerSchema`; `useActiveHousehold`.

- [ ] **Step 1: Install expo-location**

Run: `npx expo install expo-location`
Expected: adds `expo-location` to `package.json` dependencies at the SDK-matched version.

- [ ] **Step 2: Create the retail stack layout**

Create `app/retail/_layout.tsx`:

```typescript
/** Retail section stack (hub, retailer branches, products, prices, locations). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function RetailLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('retail.title') }} />
      <Stack.Screen name="[retailerId]" options={{ title: t('retail.branches') }} />
      <Stack.Screen name="products" options={{ title: t('retail.products') }} />
      <Stack.Screen name="product/[id]" options={{ title: t('retail.prices') }} />
      <Stack.Screen name="locations" options={{ title: t('retail.savedLocations') }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Create the retail hub screen**

Create `app/retail/index.tsx`:

```typescript
/** Retail hub: active-location switcher, retailers list + add, section links. */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import {
  createRetailer,
  listRetailers,
  listSavedLocations,
  setActiveLocation,
} from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { createRetailerSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [rs, ls] = await Promise.all([listRetailers(active.id), listSavedLocations(active.id)]);
      setRetailers(rs);
      setLocations(ls);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onSetActive(id: string) {
    try {
      await setActiveLocation(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onAddRetailer() {
    if (!active) return;
    const result = validate(createRetailerSchema, { name });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createRetailer(active.id, result.data);
      setName('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const activeLoc = locations.find((l) => l.is_active) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.card}>
          <Text variant="caption" muted>{t('retail.activeLocation')}</Text>
          <Text variant="heading">
            {activeLoc ? `${activeLoc.label} — ${activeLoc.store?.name ?? ''}` : t('retail.noActiveLocation')}
          </Text>
          <Link href="/retail/locations" style={{ marginTop: spacing.xs }}>
            <Text style={{ color: palette.brand }}>{t('retail.savedLocations')}</Text>
          </Link>
        </View>

        <View style={styles.rowLinks}>
          <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
        </View>

        <Text variant="heading">{t('retail.retailers')}</Text>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : retailers.length === 0 ? (
          <Text muted>{t('retail.noRetailers')}</Text>
        ) : (
          <View style={styles.list}>
            {retailers.map((r) => (
              <Pressable key={r.id} style={styles.card} onPress={() => router.push(`/retail/${r.id}`)}>
                <Text variant="heading">{r.name}</Text>
                {r.country_code ? <Text variant="caption" muted>{r.country_code}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}

        {/* quick set-active list when multiple saved locations exist */}
        {locations.length > 0 && (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('retail.savedLocations')}</Text>
            {locations.map((l) => (
              <View key={l.id} style={styles.locRow}>
                <Text>{l.label} — {l.store?.name ?? ''}</Text>
                {l.is_active ? (
                  <Text variant="caption" style={{ color: palette.brand }}>{t('retail.active')}</Text>
                ) : (
                  <Button label={t('retail.setActive')} variant="secondary" onPress={() => onSetActive(l.id)} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addRetailer')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('retail.retailerName')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <Button
            label={submitting ? t('auth.processing') : t('retail.addRetailer')}
            onPress={onAddRetailer}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  rowLinks: { flexDirection: 'row', gap: spacing.lg },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 4: Add the retail link to the More tab**

In `app/(tabs)/more.tsx`, add a retail link after the household link (line 35-37):

```typescript
      <Link href="/household" style={styles.link}>
        <Text style={{ color: palette.brand }}>{t('household.open')}</Text>
      </Link>
      <Link href="/retail" style={styles.link}>
        <Text style={{ color: palette.brand }}>{t('retail.open')}</Text>
      </Link>
```

- [ ] **Step 5: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json "app/retail/_layout.tsx" "app/retail/index.tsx" "app/(tabs)/more.tsx"
git commit -m "feat(retail): expo-location dep, retail stack, hub screen, More link"
```

---

### Task 9: Retailer branches screen

**Files:**
- Create: `app/retail/[retailerId].tsx`

**Interfaces:**
- Consumes: `getRetailer`, `listStores`, `createStore` from `features/retail/api`; `createStoreSchema`; `useActiveHousehold`.

- [ ] **Step 1: Create the branches screen**

Create `app/retail/[retailerId].tsx`:

```typescript
/** A retailer's branches: list + add branch (name, address, currency, coords). */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createStore, getRetailer, listStores } from '@/features/retail/api';
import { createStoreSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow, RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailerBranchesScreen() {
  const { t } = useTranslation();
  const { retailerId } = useLocalSearchParams<{ retailerId: string }>();
  const rid = String(retailerId);
  const { active } = useActiveHousehold();

  const [retailer, setRetailer] = useState<RetailerRow | null>(null);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setErrorKey(null);
    try {
      const [r, ss] = await Promise.all([getRetailer(rid), listStores(rid)]);
      setRetailer(r);
      setStores(ss);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAdd() {
    if (!active) return;
    const result = validate(createStoreSchema, {
      name, city, currencyCode: currency, latitude: lat, longitude: lng,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createStore(active.id, rid, result.data);
      setName(''); setCity(''); setLat(''); setLng('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {retailer ? <Text variant="title">{retailer.name}</Text> : null}

        {stores.length === 0 ? (
          <Text muted>{t('retail.noBranches')}</Text>
        ) : (
          <View style={styles.list}>
            {stores.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text variant="heading">{s.name}{s.is_online ? ` · ${t('retail.online')}` : ''}</Text>
                <Text variant="caption" muted>
                  {[s.city, s.region, s.country_code].filter(Boolean).join(', ')} · {s.currency_code}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addBranch')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.branchName')} value={name} onChangeText={setName}
            autoCapitalize="sentences" error={fieldErrors.name ? t('errors.validation') : undefined} />
          <TextField label={t('retail.city')} value={city} onChangeText={setCity} autoCapitalize="sentences" />
          <TextField label={t('retail.currency')} value={currency} onChangeText={setCurrency}
            autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
          <TextField label={t('retail.latitude')} value={lat} onChangeText={setLat} keyboardType="numeric" />
          <TextField label={t('retail.longitude')} value={lng} onChangeText={setLng} keyboardType="numeric" />
          <Button label={submitting ? t('auth.processing') : t('retail.addBranch')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/retail/[retailerId].tsx"
git commit -m "feat(retail): retailer branches screen with add-branch form"
```

---

### Task 10: Products list + product prices screen

**Files:**
- Create: `app/retail/products.tsx`, `app/retail/product/[id].tsx`

**Interfaces:**
- Consumes: `listProducts`, `createProduct`, `getProduct`, `listRetailers`, `listRetailerProducts`, `createRetailerProduct`, `listPricesForProduct`, `createPrice`, `deletePrice`, `listStores` from `features/retail/api`; `createProductSchema`, `createPriceSchema`; `unitPriceMinor`, `freshnessOf`; `formatAmount`, `toMinorUnits`.

- [ ] **Step 1: Create the products list screen**

Create `app/retail/products.tsx`:

```typescript
/** Products list + add product; tap a product to view its prices across branches. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createProduct, listProducts } from '@/features/retail/api';
import { createProductSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState('');
  const [packCount, setPackCount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setProducts(await listProducts(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAdd() {
    if (!active) return;
    const result = validate(createProductSchema, {
      name, brand, sizeValue, sizeUnit, packCount,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createProduct(active.id, result.data);
      setName(''); setBrand(''); setSizeValue(''); setSizeUnit(''); setPackCount('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : products.length === 0 ? (
          <Text muted>{t('retail.noProducts')}</Text>
        ) : (
          <View style={styles.list}>
            {products.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => router.push(`/retail/product/${p.id}`)}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="caption" muted>
                  {[p.brand, p.size_value ? `${p.size_value}${p.size_unit ?? ''}` : null,
                    p.pack_count > 1 ? `x${p.pack_count}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addProduct')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.productName')} value={name} onChangeText={setName}
            autoCapitalize="sentences" error={fieldErrors.name ? t('errors.validation') : undefined} />
          <TextField label={t('retail.brand')} value={brand} onChangeText={setBrand} autoCapitalize="sentences" />
          <TextField label={t('retail.size')} value={sizeValue} onChangeText={setSizeValue} keyboardType="numeric" />
          <TextField label={t('retail.unit')} value={sizeUnit} onChangeText={setSizeUnit} />
          <TextField label={t('retail.packCount')} value={packCount} onChangeText={setPackCount} keyboardType="numeric" />
          <Button label={submitting ? t('auth.processing') : t('retail.addProduct')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 2: Create the product prices screen**

Create `app/retail/product/[id].tsx`:

```typescript
/** A product's prices across branches: unit-price + freshness, cheapest-first.
 *  Link the product to retailers and record price snapshots. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import {
  createPrice,
  createRetailerProduct,
  deletePrice,
  getProduct,
  listPricesForProduct,
  listRetailerProducts,
  listRetailers,
  listStores,
} from '@/features/retail/api';
import type { PriceWithRefs, RetailerProductWithRetailer } from '@/features/retail/api';
import { createPriceSchema, createRetailerProductSchema } from '@/features/retail/schemas';
import { freshnessOf } from '@/features/retail/freshness';
import { unitPriceMinor } from '@/features/retail/unitPrice';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow, RetailerRow, RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function ProductPricesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = String(id);
  const { active } = useActiveHousehold();

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [prices, setPrices] = useState<PriceWithRefs[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [links, setLinks] = useState<RetailerProductWithRetailer[]>([]);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [linkRetailerId, setLinkRetailerId] = useState<string | null>(null);
  const [rpId, setRpId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [regular, setRegular] = useState('');
  const [sale, setSale] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [p, pr, ls, rs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
      ]);
      setProduct(p);
      setPrices(pr);
      setLinks(ls);
      setRetailers(rs);
      // Stores for the currently-linked retailers (for the price store picker).
      const retailerIds = Array.from(new Set(ls.map((l) => l.retailer_id)));
      const allStores: RetailerStoreRow[] = [];
      for (const retId of retailerIds) allStores.push(...(await listStores(retId)));
      setStores(allStores);
      setRpId((prev) => prev ?? ls[0]?.id ?? null);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, productId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onLink() {
    if (!active || !linkRetailerId) return;
    const result = validate(createRetailerProductSchema, {
      productId, retailerId: linkRetailerId,
    });
    if (!result.success) return;
    setBusy(true);
    try {
      await createRetailerProduct(active.id, result.data);
      setLinkRetailerId(null);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  async function onAddPrice() {
    if (!active || !rpId) return;
    const result = validate(createPriceSchema, {
      retailerProductId: rpId,
      storeId: storeId ?? undefined,
      regularMajor: regular,
      saleMajor: sale,
      currencyCode: active.reporting_currency_code,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    // Currency follows the chosen store when set; else the household currency.
    const store = stores.find((s) => s.id === storeId) ?? null;
    const ccy = store?.currency_code ?? result.data.currencyCode;
    setBusy(true);
    try {
      await createPrice(active.id, {
        retailerProductId: result.data.retailerProductId,
        storeId: result.data.storeId,
        regularMinor: toMinorUnits(result.data.regularMajor, ccy),
        saleMinor: result.data.saleMajor === undefined ? undefined : toMinorUnits(result.data.saleMajor, ccy),
        memberMinor: undefined,
        currencyCode: ccy,
      });
      setRegular(''); setSale('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  async function onDeletePrice(pid: string) {
    try {
      await deletePrice(pid);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  const now = Date.now();
  const freshLabel = (f: 'fresh' | 'recent' | 'stale'): string =>
    f === 'fresh' ? t('retail.fresh') : f === 'recent' ? t('retail.recent') : t('retail.stale');

  // Cheapest-first by effective price (sale ?? regular).
  const sorted = [...prices].sort(
    (a, b) => (a.sale_price_minor ?? a.regular_price_minor) - (b.sale_price_minor ?? b.regular_price_minor),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {product ? <Text variant="title">{product.name}</Text> : null}

        {sorted.length === 0 ? (
          <Text muted>{t('retail.noPrices')}</Text>
        ) : (
          <View style={styles.list}>
            {sorted.map((p) => {
              const effective = p.sale_price_minor ?? p.regular_price_minor;
              const up = product
                ? unitPriceMinor(effective, product.size_value, product.size_unit, product.pack_count)
                : null;
              const fresh = freshnessOf(new Date(p.observed_at).getTime(), now);
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">
                      {p.retailer_product?.retailer?.name ?? '—'}
                      {p.store ? ` ${t('retail.atStore', { store: p.store.name })}` : ` · ${t('retail.onlinePrice')}`}
                    </Text>
                    <Text variant="heading">{formatAmount(effective, p.currency_code)}</Text>
                  </View>
                  {up ? (
                    <Text variant="caption" muted>
                      {t('retail.perUnit', {
                        price: formatAmount(Math.round(up.perBaseMinor * 100) / 100, p.currency_code),
                        unit: up.unit,
                      })}
                    </Text>
                  ) : null}
                  <View style={styles.cardRow}>
                    <Text variant="caption" muted>{freshLabel(fresh)}</Text>
                    <Pressable onPress={() => onDeletePrice(p.id)}>
                      <Text variant="caption" style={{ color: palette.danger }}>{t('finance.delete')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.linkRetailer')}</Text>
        <View style={styles.chips}>
          {retailers.map((r) => {
            const on = r.id === linkRetailerId;
            return (
              <Pressable key={r.id} onPress={() => setLinkRetailerId(r.id)}
                style={[styles.chip, on ? styles.chipActive : null]}>
                <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{r.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={t('retail.linkRetailer')} onPress={onLink} loading={busy} />

        {links.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text variant="heading">{t('retail.addPrice')}</Text>
            <View style={styles.form}>
              <Text variant="caption" muted>{t('retail.chooseRetailer')}</Text>
              <View style={styles.chips}>
                {links.map((l) => {
                  const on = l.id === rpId;
                  return (
                    <Pressable key={l.id} onPress={() => setRpId(l.id)}
                      style={[styles.chip, on ? styles.chipActive : null]}>
                      <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>
                        {l.retailer?.name ?? '—'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text variant="caption" muted>{t('retail.chooseStore')}</Text>
              <View style={styles.chips}>
                <Pressable onPress={() => setStoreId(null)}
                  style={[styles.chip, storeId === null ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: storeId === null ? palette.white : palette.text }}>
                    {t('retail.onlinePrice')}
                  </Text>
                </Pressable>
                {stores.map((s) => {
                  const on = s.id === storeId;
                  return (
                    <Pressable key={s.id} onPress={() => setStoreId(s.id)}
                      style={[styles.chip, on ? styles.chipActive : null]}>
                      <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>
                        {s.name} ({s.currency_code})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField label={t('retail.regularPrice')} value={regular} onChangeText={setRegular}
                keyboardType="numeric" error={fieldErrors.regularMajor ? t('errors.validation') : undefined} />
              <TextField label={t('retail.salePrice')} value={sale} onChangeText={setSale} keyboardType="numeric" />
              <Button label={busy ? t('auth.processing') : t('retail.addPrice')} onPress={onAddPrice} loading={busy} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

Note: the delete label uses the existing `finance.delete` key (already localized).
The `formatAmount` for unit price rounds `perBaseMinor` to 2 decimals of a minor
unit purely for a readable per-unit figure; it is display-only, never persisted.

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/retail/products.tsx" "app/retail/product/[id].tsx"
git commit -m "feat(retail): products list + product prices screen (unit price, freshness)"
```

---

### Task 11: Saved locations screen (with GPS)

**Files:**
- Create: `app/retail/locations.tsx`

**Interfaces:**
- Consumes: `listSavedLocations`, `createSavedLocation`, `setActiveLocation`, `listRetailers`, `listStores` from `features/retail/api`; `createSavedLocationSchema`; `haversineKm`; `expo-location`.

- [ ] **Step 1: Create the saved locations screen**

Create `app/retail/locations.tsx`:

```typescript
/** Saved shopping locations: list, add (label + branch), set active, and sort
 *  branches by GPS proximity via expo-location (web falls back automatically). */

import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import {
  createSavedLocation,
  listRetailers,
  listSavedLocations,
  listStores,
  setActiveLocation,
} from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { haversineKm } from '@/features/retail/distance';
import { createSavedLocationSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function SavedLocationsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();

  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [ls, retailers] = await Promise.all([
        listSavedLocations(active.id),
        listRetailers(active.id),
      ]);
      setLocations(ls);
      const all: RetailerStoreRow[] = [];
      for (const r of retailers) all.push(...(await listStores(r.id)));
      setStores(all);
      setStoreId((prev) => prev ?? all[0]?.id ?? null);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onUseLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorKey('retail.locationDenied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setErrorKey('retail.locationDenied');
    }
  }

  async function onSetActive(id: string) {
    try {
      await setActiveLocation(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onAdd() {
    if (!active || !storeId) return;
    const result = validate(createSavedLocationSchema, { label, storeId });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createSavedLocation(active.id, result.data);
      setLabel('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  // Branches sorted by distance to current coords (when available).
  const storesByDistance = coords
    ? [...stores]
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          store: s,
          km: haversineKm(coords, { lat: s.latitude as number, lng: s.longitude as number }),
        }))
        .sort((a, b) => a.km - b.km)
    : [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {locations.length === 0 ? (
          <Text muted>{t('retail.noLocations')}</Text>
        ) : (
          <View style={styles.list}>
            {locations.map((l) => (
              <View key={l.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text variant="heading">{l.label}</Text>
                  {l.is_active ? (
                    <Text variant="caption" style={{ color: palette.brand }}>{t('retail.active')}</Text>
                  ) : (
                    <Button label={t('retail.setActive')} variant="secondary" onPress={() => onSetActive(l.id)} />
                  )}
                </View>
                <Text variant="caption" muted>
                  {l.store?.retailer?.name ?? ''} — {l.store?.name ?? ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Button label={t('retail.useCurrentLocation')} variant="secondary" onPress={onUseLocation} />
        {coords && storesByDistance.length > 0 && (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('retail.nearestBranches')}</Text>
            {storesByDistance.slice(0, 5).map(({ store, km }) => (
              <Pressable key={store.id} style={styles.card} onPress={() => setStoreId(store.id)}>
                <Text>{store.name}</Text>
                <Text variant="caption" muted>{t('retail.distanceKm', { km: km.toFixed(1) })}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addLocation')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.locationLabel')} value={label} onChangeText={setLabel}
            autoCapitalize="sentences" error={fieldErrors.label ? t('errors.validation') : undefined} />
          <Text variant="caption" muted>{t('retail.chooseStore')}</Text>
          <View style={styles.chips}>
            {stores.map((s) => {
              const on = s.id === storeId;
              return (
                <Pressable key={s.id} onPress={() => setStoreId(s.id)}
                  style={[styles.chip, on ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button label={submitting ? t('auth.processing') : t('retail.addLocation')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/retail/locations.tsx"
git commit -m "feat(retail): saved locations screen with GPS nearest-branch"
```

---

### Task 12: Extend RLS integration test for retail

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `idB`).
- Produces: retail catalog setup + isolation + RPC-auth + currency-follow assertions.

- [ ] **Step 1: Add retail setup where A owns the household (after the grocery blocks, before "B cannot read A's household")**

```javascript
  // --- retail: A builds a small catalog -------------------------------------
  const { data: ret, error: retErr } = await a
    .from('retailers')
    .insert({ household_id: hid, name: 'MegaMart', country_code: 'PH', created_by: idA })
    .select('id').single();
  ok('A can create a retailer', !retErr && Boolean(ret?.id));

  const { data: store, error: stErr } = await a
    .from('retailer_stores')
    .insert({ household_id: hid, retailer_id: ret?.id, name: 'MegaMart Makati',
      currency_code: 'PHP', latitude: 14.55, longitude: 121.02, created_by: idA })
    .select('id, currency_code').single();
  ok('A can create a store', !stErr && Boolean(store?.id));

  const { data: prod } = await a
    .from('products')
    .insert({ household_id: hid, name: 'Rice 5kg', size_value: 5, size_unit: 'kg', pack_count: 1, created_by: idA })
    .select('id').single();
  const { data: rp } = await a
    .from('retailer_products')
    .insert({ household_id: hid, product_id: prod?.id, retailer_id: ret?.id, created_by: idA })
    .select('id').single();
  ok('A can link a product to a retailer', Boolean(rp?.id));

  // Price with a USD currency but a PHP store — trigger must force PHP.
  const { data: price } = await a
    .from('price_snapshots')
    .insert({ household_id: hid, retailer_product_id: rp?.id, store_id: store?.id,
      regular_price_minor: 25000, currency_code: 'USD', created_by: idA })
    .select('currency_code').single();
  ok('price currency follows the store (PHP, not USD)', price?.currency_code === 'PHP');

  // Saved location + set-active RPC.
  const { data: loc } = await a
    .from('saved_locations')
    .insert({ household_id: hid, label: 'Home', store_id: store?.id, created_by: idA })
    .select('id').single();
  const { error: activeErr } = await a.rpc('set_active_saved_location', { _id: loc?.id });
  ok('A can set a saved location active (RPC)', !activeErr);
  const { data: activeLoc } = await a
    .from('saved_locations').select('is_active').eq('id', loc?.id).single();
  ok('saved location is now active', activeLoc?.is_active === true);
```

- [ ] **Step 2: Add B-cannot-access assertions (in the "B cannot read A" section)**

```javascript
  // B CANNOT read or write A's retail catalog (not a member yet).
  const { data: bRet } = await b.from('retailers').select('id').eq('household_id', hid);
  ok("B cannot read A's retailers (RLS)", (bRet ?? []).length === 0);
  const { data: bPrices } = await b.from('price_snapshots').select('id').eq('household_id', hid);
  ok("B cannot read A's prices (RLS)", (bPrices ?? []).length === 0);
  const { error: bRetErr } = await b
    .from('retailers')
    .insert({ household_id: hid, name: 'X', created_by: idB });
  ok("B cannot create a retailer in A's household", Boolean(bRetErr));
  const { error: bActErr } = await b.rpc('set_active_saved_location', { _id: loc?.id });
  ok("B cannot set-active A's location via RPC", Boolean(bActErr));
```

- [ ] **Step 3: Add a post-join read assertion (after "B can read grocery lists after joining")**

```javascript
  const { data: bRetAfter } = await b.from('retailers').select('id').eq('household_id', hid);
  ok('B can read retailers after joining', (bRetAfter ?? []).length >= 1);
```

- [ ] **Step 4: Syntax-check, then run the suite**

Run: `node --check tests/integration/rls-isolation.mjs` → "no output" (valid).
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then:
Run: `npm run test:rls`
Expected: all assertions pass (previous 37 + new retail ones). Remove the key after.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(retail): RLS isolation, store-currency trigger, set-active RPC auth"
```

---

### Task 13: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; all unit suites pass (incl. `tests/retail/*`); RLS suite passes incl. retail assertions.

- [ ] **Step 2: Manual smoke (optional)**

Open the app → More → Retail → add a retailer → open it → add a branch → Products → add a product → open it → link the retailer → add a price → confirm the unit-price + freshness show and cheapest sorts first. Locations → add Home → set active → "use current location" lists nearest branches.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- retailers/stores/products/retailer_products/price_snapshots/saved_locations → Task 1 ✓; types Task 2 ✓
- unit-price normalization → Task 3 (`unitPrice.ts`) + Task 10 (display) ✓
- price freshness → Task 3 (`freshness.ts`) + Task 10 ✓
- distance / GPS nearest-branch → Task 3 (`distance.ts`) + Task 11 ✓
- connector interface (types only) → Task 4 ✓
- household-scoped RLS → Task 1 ✓; isolation test Task 12 ✓
- currency follows store → Task 1 trigger + Task 12 assertion ✓
- saved locations + active switch (RPC) → Task 1 RPC + Tasks 8/11 ✓
- manual data entry UI → Tasks 8–11 ✓
- i18n en/fil/ar → Task 7 ✓
- expo-location + web fallback → Task 8 (dep) + Task 11 (`expo-location`, which wraps `navigator.geolocation` on web) ✓
- More-tab entry point → Task 8 ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete. The delete label in Task 10 reuses the existing `finance.delete` key.

**Type consistency:** Row types (Task 2) used verbatim in Tasks 3/6/8–11. API names/signatures defined in Task 6 (`listRetailers`, `createRetailer`, `getRetailer`, `deleteRetailer`, `listStores`, `createStore`, `listProducts`, `getProduct`, `createProduct`, `listRetailerProducts`, `createRetailerProduct`, `listPricesForProduct`, `createPrice`, `deletePrice`, `listSavedLocations`, `createSavedLocation`, `setActiveLocation`) match consumers in Tasks 8–11. Helper names (`normalizeSize`, `unitPriceMinor`, `freshnessOf`, `haversineKm`) match between Task 3 and Tasks 10/11. Schema names match between Task 5 and screens. `createPrice` takes minor units; screens convert via `toMinorUnits` (noted in Task 6).

**Scope:** Single slice (5a). Coupons, comparison/basket, live connectors, loyalty, global catalog explicitly deferred.


## plan 2026-08-12-phase5b-coupons

# Phase 5 Slice 5b — Coupons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add household-scoped coupons (fixed/percent, retailer- or product-scoped) with a pure savings engine, a discovery screen, and applicable-coupon display on the product-prices screen.

**Architecture:** One new `coupons` table with RLS mirroring 5a retail rows and a CHECK enforcing the fixed-vs-percent shape. A pure `coupon.ts` helper computes status and applies a coupon to a base price. Client follows the `features/retail` boundary: `couponApi.ts` data access, `createCouponSchema`, a `coupons` discovery screen, and a coupons section on the product-prices screen. i18n in three locales.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.**
- **Fixed coupons carry a currency and apply only to a same-currency price.** Percent coupons are currency-agnostic.
- **RLS is the security boundary.** SELECT `public.is_member_of(household_id)`; writes `public.has_role_in(household_id, array[...]::public.household_role[])`.
- **Coupons are household-scoped** (`household_id` on the table).
- **Data access only through `features/retail/couponApi.ts`.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000007_coupons.sql`.
- **Never fake coupon clipping** — Level-1 only (show a source URL).
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Database migration — coupons table + RLS

**Files:**
- Create: `supabase/migrations/20260812000007_coupons.sql`

**Interfaces:**
- Consumes: `public.households`, `public.retailers`, `public.retailer_products`, helpers `is_member_of`, `has_role_in`, `set_updated_at`.
- Produces: table `public.coupons`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260812000007_coupons.sql`:

```sql
-- ============================================================================
-- Phase 5 slice 5b — Coupons (household-scoped)
-- ============================================================================
-- A coupon is a code/clip-able discount applied ON TOP of the effective shelf
-- price (min of regular/sale from 5a price_snapshots). Fixed or percent; scoped
-- to a retailer and optionally one retailer_product. Savings math is a pure
-- client helper; this table just stores the terms. Level-1 discovery only
-- (source_url) — no clipping/activation.
-- ============================================================================

create table if not exists public.coupons (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  retailer_id           uuid not null references public.retailers (id) on delete cascade,
  retailer_product_id   uuid references public.retailer_products (id) on delete cascade,
  title                 text not null,
  code                  text,
  source_url            text,
  notes                 text,
  discount_type         text not null check (discount_type in ('fixed','percent')),
  discount_amount_minor bigint check (discount_amount_minor >= 0),
  discount_percent      numeric check (discount_percent > 0 and discount_percent <= 100),
  currency_code         text check (currency_code ~ '^[A-Z]{3}$'),
  min_purchase_minor    bigint check (min_purchase_minor >= 0),
  max_discount_minor    bigint check (max_discount_minor >= 0),
  starts_at             timestamptz,
  expires_at            timestamptz,
  created_by            uuid not null references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint chk_coupon_shape check (
    (discount_type = 'fixed'
      and discount_amount_minor is not null
      and currency_code is not null
      and discount_percent is null)
    or (discount_type = 'percent'
      and discount_percent is not null
      and discount_amount_minor is null)
  )
);
create index if not exists idx_coupons_household on public.coupons (household_id, retailer_id);
create index if not exists idx_coupons_retailer_product on public.coupons (retailer_product_id);

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS (writers may delete; like price rows)
-- ===========================================================================
alter table public.coupons enable row level security;

drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons
  for select using (public.is_member_of(household_id));

drop policy if exists coupons_insert on public.coupons;
create policy coupons_insert on public.coupons
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));

drop policy if exists coupons_update on public.coupons;
create policy coupons_update on public.coupons
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

drop policy if exists coupons_delete on public.coupons;
create policy coupons_delete on public.coupons
  for delete using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

grant select, insert, update, delete on public.coupons to authenticated;
```

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor and run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select table_name from information_schema.tables where table_schema='public' and table_name='coupons';
select conname from pg_constraint where conname='chk_coupon_shape';
```
Expected: 1 table, 1 constraint.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000007_coupons.sql
git commit -m "feat(coupons): 5b schema — coupons table with fixed/percent shape + RLS"
```

---

### Task 2: TypeScript database type

**Files:**
- Modify: `lib/database.types.ts` (append after the 5a `SavedLocationRow`)

**Interfaces:**
- Produces: `CouponRow`, `CouponDiscountType`.

- [ ] **Step 1: Append the coupon type**

At the end of `lib/database.types.ts`:

```typescript
// --- Phase 5 (5b): coupons -------------------------------------------------
export type CouponDiscountType = 'fixed' | 'percent';

export interface CouponRow {
  id: string;
  household_id: string;
  retailer_id: string;
  retailer_product_id: string | null;
  title: string;
  code: string | null;
  source_url: string | null;
  notes: string | null;
  discount_type: CouponDiscountType;
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(coupons): add CouponRow type"
```

---

### Task 3: Pure coupon helper (TDD)

**Files:**
- Create: `features/retail/coupon.ts`
- Test: `tests/retail/coupon.test.ts`

**Interfaces:**
- Consumes: `CouponRow` (structurally, via `CouponLike`).
- Produces:
  - `couponStatus(c, nowMs): 'scheduled'|'active'|'expired'`
  - `applyCoupon(c, basePriceMinor, currencyCode, nowMs): { applicable, finalMinor, savingsMinor, reason? }`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/coupon.test.ts`:

```typescript
import { applyCoupon, couponStatus } from '@/features/retail/coupon';
import type { CouponRow } from '@/lib/database.types';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

function coupon(over: Partial<CouponRow>): CouponRow {
  return {
    id: 'c', household_id: 'h', retailer_id: 'r', retailer_product_id: null,
    title: 'Test', code: null, source_url: null, notes: null,
    discount_type: 'fixed', discount_amount_minor: 500, discount_percent: null,
    currency_code: 'USD', min_purchase_minor: null, max_discount_minor: null,
    starts_at: null, expires_at: null, created_by: 'u', created_at: iso(now), updated_at: iso(now),
    ...over,
  };
}

describe('couponStatus', () => {
  it('is active with no dates', () => {
    expect(couponStatus(coupon({}), now)).toBe('active');
  });
  it('is expired past expires_at', () => {
    expect(couponStatus(coupon({ expires_at: iso(now - DAY) }), now)).toBe('expired');
  });
  it('is scheduled before starts_at', () => {
    expect(couponStatus(coupon({ starts_at: iso(now + DAY) }), now)).toBe('scheduled');
  });
});

describe('applyCoupon', () => {
  it('applies a fixed discount', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 500, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 1500, savingsMinor: 500 });
  });
  it('caps a fixed discount at the base price', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 5000, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 0, savingsMinor: 2000 });
  });
  it('applies a percent discount', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 10, currency_code: null }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1800, savingsMinor: 200 });
  });
  it('respects a percent max-discount cap', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 50,
        currency_code: null, max_discount_minor: 300 }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1700, savingsMinor: 300 });
  });
  it('is not applicable below min purchase', () => {
    const r = applyCoupon(coupon({ min_purchase_minor: 3000 }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'min_purchase' });
  });
  it('is not applicable on a currency mismatch (fixed)', () => {
    const r = applyCoupon(coupon({ currency_code: 'EUR' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'currency' });
  });
  it('is not applicable when expired', () => {
    const r = applyCoupon(coupon({ expires_at: iso(now - DAY) }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'expired' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/coupon.test.ts`
Expected: FAIL — cannot find module `@/features/retail/coupon`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/coupon.ts`:

```typescript
/**
 * Pure coupon math. A coupon applies ON TOP of an effective base price (the
 * caller passes min(regular, sale)). Fixed coupons must match the price currency;
 * percent coupons are currency-agnostic. Savings never exceed the base price.
 */

export type CouponStatus = 'scheduled' | 'active' | 'expired';

export interface CouponLike {
  discount_type: 'fixed' | 'percent';
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

export interface ApplyResult {
  applicable: boolean;
  finalMinor: number;
  savingsMinor: number;
  reason?: 'expired' | 'scheduled' | 'currency' | 'min_purchase';
}

export function couponStatus(
  c: Pick<CouponLike, 'starts_at' | 'expires_at'>,
  nowMs: number,
): CouponStatus {
  if (c.expires_at != null && new Date(c.expires_at).getTime() < nowMs) return 'expired';
  if (c.starts_at != null && new Date(c.starts_at).getTime() > nowMs) return 'scheduled';
  return 'active';
}

export function applyCoupon(
  c: CouponLike,
  basePriceMinor: number,
  currencyCode: string,
  nowMs: number,
): ApplyResult {
  const notApplicable = (reason: ApplyResult['reason']): ApplyResult => ({
    applicable: false,
    finalMinor: basePriceMinor,
    savingsMinor: 0,
    reason,
  });

  const status = couponStatus(c, nowMs);
  if (status === 'expired') return notApplicable('expired');
  if (status === 'scheduled') return notApplicable('scheduled');
  if (c.discount_type === 'fixed' && c.currency_code !== currencyCode) {
    return notApplicable('currency');
  }
  if (c.min_purchase_minor != null && basePriceMinor < c.min_purchase_minor) {
    return notApplicable('min_purchase');
  }

  let raw: number;
  if (c.discount_type === 'fixed') {
    raw = c.discount_amount_minor ?? 0;
  } else {
    raw = Math.round((basePriceMinor * (c.discount_percent ?? 0)) / 100);
  }
  const cap = c.max_discount_minor ?? Infinity;
  const savingsMinor = Math.max(0, Math.min(raw, cap, basePriceMinor));
  return { applicable: true, finalMinor: basePriceMinor - savingsMinor, savingsMinor };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/coupon.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add features/retail/coupon.ts tests/retail/coupon.test.ts
git commit -m "feat(coupons): pure savings engine (couponStatus + applyCoupon) + tests"
```

---

### Task 4: Validation schema

**Files:**
- Modify: `features/retail/schemas.ts` (append `createCouponSchema`)

**Interfaces:**
- Produces: `createCouponSchema` + `CreateCouponInput`.

- [ ] **Step 1: Append the coupon schema**

Add to `features/retail/schemas.ts` (reuses the existing `currency`, `optionalText`, `optionalMajor` helpers already defined in that file):

```typescript
export const createCouponSchema = z
  .object({
    retailerId: z.string().uuid(),
    retailerProductId: z.string().uuid().optional(),
    title: name,
    code: optionalText(60),
    sourceUrl: optionalText(300),
    discountType: z.enum(['fixed', 'percent']),
    // fixed:
    amountMajor: optionalMajor,
    currencyCode: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .refine((s) => s === '' || /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' })
      .optional()
      .transform((v) => (v ? v : undefined)),
    // percent:
    percent: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 100), {
        message: 'invalid_percent',
      }),
    minPurchaseMajor: optionalMajor,
    maxDiscountMajor: optionalMajor,
    expiresAt: optionalText(40),
  })
  .refine(
    (v) =>
      v.discountType === 'fixed'
        ? v.amountMajor !== undefined && v.currencyCode !== undefined
        : v.percent !== undefined,
    { message: 'incomplete_discount', path: ['discountType'] },
  );

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/schemas.ts
git commit -m "feat(coupons): zod createCouponSchema"
```

---

### Task 5: Coupon data access

**Files:**
- Create: `features/retail/couponApi.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `AppError`, `CouponRow`, `RetailerRow`, `RetailerProductRow`, `listRetailerProducts` from `features/retail/api`.
- Produces:
  - interface `CouponWithRefs extends CouponRow { retailer, retailer_product }`
  - interface `CreateCouponData` (minor-unit input from the screen)
  - `listCoupons(hid): CouponWithRefs[]`
  - `listCouponsForProduct(productId): CouponWithRefs[]`
  - `createCoupon(hid, data): CouponRow`
  - `deleteCoupon(id): void`

- [ ] **Step 1: Write the module**

Create `features/retail/couponApi.ts`:

```typescript
/**
 * Coupon data access. Household scoping + writer/viewer permission via RLS.
 * Amounts cross this boundary as integer minor units (screen converts from major).
 */

import type { CouponRow, RetailerProductRow, RetailerRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { listRetailerProducts } from '@/features/retail/api';

export interface CouponWithRefs extends CouponRow {
  retailer: Pick<RetailerRow, 'id' | 'name'> | null;
  retailer_product: Pick<RetailerProductRow, 'id' | 'display_name'> | null;
}

/** Minor-unit coupon input assembled by the screen (major->minor already done). */
export interface CreateCouponData {
  retailerId: string;
  retailerProductId?: string;
  title: string;
  code?: string;
  sourceUrl?: string;
  discountType: 'fixed' | 'percent';
  discountAmountMinor?: number;
  discountPercent?: number;
  currencyCode?: string;
  minPurchaseMinor?: number;
  maxDiscountMinor?: number;
  expiresAt?: string;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}
async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

const SELECT =
  '*, retailer:retailers(id,name), retailer_product:retailer_products(id,display_name)';

export async function listCoupons(hid: string): Promise<CouponWithRefs[]> {
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .eq('household_id', hid)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  return (data ?? []) as unknown as CouponWithRefs[];
}

/**
 * Coupons applicable to a product: those scoped to any of the product's
 * retailer_products, OR retailer-wide (null retailer_product_id) for any retailer
 * the product is sold at. Fetched by retailer, filtered in JS to avoid fragile
 * PostgREST `or()` strings.
 */
export async function listCouponsForProduct(productId: string): Promise<CouponWithRefs[]> {
  const rps = await listRetailerProducts(productId);
  if (rps.length === 0) return [];
  const retailerIds = Array.from(new Set(rps.map((r) => r.retailer_id)));
  const rpIds = new Set(rps.map((r) => r.id));
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .in('retailer_id', retailerIds)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  const rows = (data ?? []) as unknown as CouponWithRefs[];
  return rows.filter(
    (c) => c.retailer_product_id == null || rpIds.has(c.retailer_product_id),
  );
}

export async function createCoupon(hid: string, data: CreateCouponData): Promise<CouponRow> {
  const created_by = await currentUserId();
  const { data: row, error } = await getSupabase()
    .from('coupons')
    .insert({
      household_id: hid,
      retailer_id: data.retailerId,
      retailer_product_id: data.retailerProductId ?? null,
      title: data.title,
      code: data.code ?? null,
      source_url: data.sourceUrl ?? null,
      discount_type: data.discountType,
      discount_amount_minor: data.discountAmountMinor ?? null,
      discount_percent: data.discountPercent ?? null,
      currency_code: data.currencyCode ?? null,
      min_purchase_minor: data.minPurchaseMinor ?? null,
      max_discount_minor: data.maxDiscountMinor ?? null,
      expires_at: data.expiresAt ?? null,
      created_by,
    })
    .select('*')
    .single();
  if (error) fail('coupons.errors.saveFailed', error);
  return row as CouponRow;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await getSupabase().from('coupons').delete().eq('id', id);
  if (error) fail('coupons.errors.deleteFailed', error);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/couponApi.ts
git commit -m "feat(coupons): data access (list, list-for-product, create, delete)"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`

**Interfaces:**
- Produces: a `coupons` namespace present in all three files with identical key sets.

- [ ] **Step 1: Add the `coupons` block to each locale (place after `retail`, before `errors`)**

English (`locales/en.json`):

```json
"coupons": {
  "title": "Coupons",
  "open": "Coupons",
  "active": "Active",
  "expired": "Expired",
  "scheduled": "Scheduled",
  "addTitle": "Add coupon",
  "couponTitle": "Title",
  "chooseRetailer": "Retailer",
  "chooseProduct": "Product (optional)",
  "anyProduct": "Any product",
  "discountType": "Discount type",
  "fixed": "Fixed amount",
  "percent": "Percent",
  "amount": "Amount",
  "percentValue": "Percent (0-100)",
  "currency": "Currency",
  "minPurchase": "Minimum purchase",
  "maxDiscount": "Max discount",
  "code": "Code",
  "sourceUrl": "Where to get it (URL)",
  "expiresAt": "Expires (YYYY-MM-DD)",
  "addCta": "Add coupon",
  "empty": "No coupons yet.",
  "applicableTitle": "Coupons",
  "expectedFinal": "Final: {{price}}",
  "expectedSavings": "Save {{amount}}",
  "notApplicable": "Not applicable here",
  "openLink": "Get coupon",
  "delete": "Delete",
  "errors": {
    "loadFailed": "Couldn't load coupons.",
    "saveFailed": "Couldn't save the coupon.",
    "deleteFailed": "Couldn't delete the coupon."
  }
}
```

Filipino (`locales/fil.json`):

```json
"coupons": {
  "title": "Mga kupon",
  "open": "Mga kupon",
  "active": "Aktibo",
  "expired": "Paso na",
  "scheduled": "Nakatakda",
  "addTitle": "Magdagdag ng kupon",
  "couponTitle": "Pamagat",
  "chooseRetailer": "Tindahan",
  "chooseProduct": "Produkto (opsyonal)",
  "anyProduct": "Kahit anong produkto",
  "discountType": "Uri ng diskwento",
  "fixed": "Takdang halaga",
  "percent": "Porsyento",
  "amount": "Halaga",
  "percentValue": "Porsyento (0-100)",
  "currency": "Pera",
  "minPurchase": "Pinakamababang bili",
  "maxDiscount": "Pinakamataas na diskwento",
  "code": "Code",
  "sourceUrl": "Saan makukuha (URL)",
  "expiresAt": "Paso (YYYY-MM-DD)",
  "addCta": "Magdagdag ng kupon",
  "empty": "Wala pang kupon.",
  "applicableTitle": "Mga kupon",
  "expectedFinal": "Panghuli: {{price}}",
  "expectedSavings": "Makakatipid ng {{amount}}",
  "notApplicable": "Hindi magamit dito",
  "openLink": "Kunin ang kupon",
  "delete": "Burahin",
  "errors": {
    "loadFailed": "Hindi ma-load ang mga kupon.",
    "saveFailed": "Hindi ma-save ang kupon.",
    "deleteFailed": "Hindi mabura ang kupon."
  }
}
```

Arabic (`locales/ar.json`):

```json
"coupons": {
  "title": "الكوبونات",
  "open": "الكوبونات",
  "active": "نشط",
  "expired": "منتهٍ",
  "scheduled": "مجدول",
  "addTitle": "إضافة كوبون",
  "couponTitle": "العنوان",
  "chooseRetailer": "المتجر",
  "chooseProduct": "المنتج (اختياري)",
  "anyProduct": "أي منتج",
  "discountType": "نوع الخصم",
  "fixed": "مبلغ ثابت",
  "percent": "نسبة مئوية",
  "amount": "المبلغ",
  "percentValue": "النسبة (0-100)",
  "currency": "العملة",
  "minPurchase": "الحد الأدنى للشراء",
  "maxDiscount": "أقصى خصم",
  "code": "الرمز",
  "sourceUrl": "أين تحصل عليه (رابط)",
  "expiresAt": "ينتهي (YYYY-MM-DD)",
  "addCta": "إضافة كوبون",
  "empty": "لا توجد كوبونات بعد.",
  "applicableTitle": "الكوبونات",
  "expectedFinal": "النهائي: {{price}}",
  "expectedSavings": "وفّر {{amount}}",
  "notApplicable": "غير قابل للتطبيق هنا",
  "openLink": "احصل على الكوبون",
  "delete": "حذف",
  "errors": {
    "loadFailed": "تعذّر تحميل الكوبونات.",
    "saveFailed": "تعذّر حفظ الكوبون.",
    "deleteFailed": "تعذّر حذف الكوبون."
  }
}
```

- [ ] **Step 2: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (matching key sets).

- [ ] **Step 3: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(coupons): i18n strings for en, fil, ar"
```

---

### Task 7: Coupons discovery screen + hub link + layout entry

**Files:**
- Create: `app/retail/coupons.tsx`
- Modify: `app/retail/_layout.tsx` (add the `coupons` screen)
- Modify: `app/retail/index.tsx` (add a link to `/retail/coupons`)

**Interfaces:**
- Consumes: `listCoupons`, `createCoupon`, `deleteCoupon`, `CouponWithRefs` from `couponApi`; `listRetailers`, `listRetailerProducts` from `api`; `createCouponSchema`; `couponStatus`; `formatAmount`, `toMinorUnits`; `useActiveHousehold`.

- [ ] **Step 1: Add the coupons screen to the retail stack layout**

In `app/retail/_layout.tsx`, add after the `locations` screen line:

```typescript
      <Stack.Screen name="coupons" options={{ title: t('coupons.title') }} />
```

- [ ] **Step 2: Add a coupons link to the retail hub**

In `app/retail/index.tsx`, extend the `rowLinks` View (currently containing only the Products link) to also link coupons:

```typescript
        <View style={styles.rowLinks}>
          <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
          <Link href="/retail/coupons"><Text style={{ color: palette.brand }}>{t('coupons.title')}</Text></Link>
        </View>
```

- [ ] **Step 3: Create the coupons screen**

Create `app/retail/coupons.tsx`:

```typescript
/** Coupons discovery: active/expired sections + add coupon (fixed or percent). */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { listRetailerProducts, listRetailers } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
} from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import { createCouponSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerProductWithRetailer } from '@/features/retail/api';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function CouponsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();

  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [products, setProducts] = useState<RetailerProductWithRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [rpId, setRpId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [percent, setPercent] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [cs, rs] = await Promise.all([listCoupons(active.id), listRetailers(active.id)]);
      setCoupons(cs);
      setRetailers(rs);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onPickRetailer(id: string) {
    setRetailerId(id);
    setRpId(null);
    // Products for a retailer aren't directly listable; gather from all products'
    // retailer_products is out of scope — the retailer-product picker uses the
    // product screen instead. Here we keep coupons retailer-wide by default.
    setProducts([]);
  }

  async function onAdd() {
    if (!active || !retailerId) {
      setErrorKey('coupons.errors.saveFailed');
      return;
    }
    const result = validate(createCouponSchema, {
      retailerId,
      retailerProductId: rpId ?? undefined,
      title,
      code,
      sourceUrl: url,
      discountType: type,
      amountMajor: type === 'fixed' ? amount : undefined,
      currencyCode: type === 'fixed' ? currency : undefined,
      percent: type === 'percent' ? percent : undefined,
      minPurchaseMajor: minPurchase,
      maxDiscountMajor: maxDiscount,
      expiresAt: expires,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    const ccy = type === 'fixed' ? (result.data.currencyCode as string) : active.reporting_currency_code;
    setSubmitting(true);
    try {
      await createCoupon(active.id, {
        retailerId: result.data.retailerId,
        retailerProductId: result.data.retailerProductId,
        title: result.data.title,
        code: result.data.code,
        sourceUrl: result.data.sourceUrl,
        discountType: result.data.discountType,
        discountAmountMinor:
          result.data.discountType === 'fixed' && result.data.amountMajor !== undefined
            ? toMinorUnits(result.data.amountMajor, ccy)
            : undefined,
        currencyCode: result.data.discountType === 'fixed' ? result.data.currencyCode : undefined,
        discountPercent: result.data.discountType === 'percent' ? result.data.percent : undefined,
        minPurchaseMinor:
          result.data.minPurchaseMajor === undefined ? undefined : toMinorUnits(result.data.minPurchaseMajor, ccy),
        maxDiscountMinor:
          result.data.maxDiscountMajor === undefined ? undefined : toMinorUnits(result.data.maxDiscountMajor, ccy),
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt).toISOString() : undefined,
      });
      setTitle(''); setAmount(''); setPercent(''); setMinPurchase(''); setMaxDiscount('');
      setCode(''); setUrl(''); setExpires('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCoupon(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  const now = Date.now();
  const activeCoupons = coupons.filter((c) => couponStatus(c, now) !== 'expired');
  const expiredCoupons = coupons.filter((c) => couponStatus(c, now) === 'expired');

  function describe(c: CouponWithRefs): string {
    if (c.discount_type === 'fixed' && c.discount_amount_minor != null && c.currency_code) {
      return formatAmount(c.discount_amount_minor, c.currency_code);
    }
    return `${c.discount_percent ?? 0}%`;
  }

  function renderCoupon(c: CouponWithRefs) {
    return (
      <View key={c.id} style={styles.card}>
        <View style={styles.cardRow}>
          <Text variant="heading">{c.title}</Text>
          <Text variant="heading">{describe(c)}</Text>
        </View>
        <Text variant="caption" muted>
          {c.retailer?.name ?? '—'}
          {c.retailer_product?.display_name ? ` · ${c.retailer_product.display_name}` : ''}
          {c.code ? ` · ${c.code}` : ''}
        </Text>
        <View style={styles.cardRow}>
          {c.source_url ? (
            <Pressable onPress={() => void Linking.openURL(c.source_url as string)}>
              <Text variant="caption" style={{ color: palette.brand }}>{t('coupons.openLink')}</Text>
            </Pressable>
          ) : <View />}
          <Pressable onPress={() => onDelete(c.id)}>
            <Text variant="caption" style={{ color: palette.danger }}>{t('coupons.delete')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : coupons.length === 0 ? (
          <Text muted>{t('coupons.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {activeCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.active')}</Text>
                {activeCoupons.map(renderCoupon)}
              </>
            )}
            {expiredCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.expired')}</Text>
                {expiredCoupons.map(renderCoupon)}
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('coupons.addTitle')}</Text>
        <View style={styles.form}>
          <Text variant="caption" muted>{t('coupons.chooseRetailer')}</Text>
          <View style={styles.chips}>
            {retailers.map((r) => {
              const on = r.id === retailerId;
              return (
                <Pressable key={r.id} onPress={() => void onPickRetailer(r.id)}
                  style={[styles.chip, on ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{r.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField label={t('coupons.couponTitle')} value={title} onChangeText={setTitle}
            autoCapitalize="sentences" error={fieldErrors.title ? t('errors.validation') : undefined} />

          <Text variant="caption" muted>{t('coupons.discountType')}</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setType('fixed')} style={[styles.chip, type === 'fixed' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'fixed' ? palette.white : palette.text }}>{t('coupons.fixed')}</Text>
            </Pressable>
            <Pressable onPress={() => setType('percent')} style={[styles.chip, type === 'percent' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'percent' ? palette.white : palette.text }}>{t('coupons.percent')}</Text>
            </Pressable>
          </View>

          {type === 'fixed' ? (
            <>
              <TextField label={t('coupons.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric"
                error={fieldErrors.amountMajor ? t('errors.validation') : undefined} />
              <TextField label={t('coupons.currency')} value={currency} onChangeText={setCurrency}
                autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
            </>
          ) : (
            <TextField label={t('coupons.percentValue')} value={percent} onChangeText={setPercent} keyboardType="numeric"
              error={fieldErrors.percent ? t('errors.validation') : undefined} />
          )}

          <TextField label={t('coupons.minPurchase')} value={minPurchase} onChangeText={setMinPurchase} keyboardType="numeric" />
          <TextField label={t('coupons.maxDiscount')} value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
          <TextField label={t('coupons.code')} value={code} onChangeText={setCode} />
          <TextField label={t('coupons.sourceUrl')} value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TextField label={t('coupons.expiresAt')} value={expires} onChangeText={setExpires} autoCapitalize="none" />
          <Button label={submitting ? t('auth.processing') : t('coupons.addCta')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

Note: this discovery screen creates retailer-wide coupons (no product picker —
product-scoped coupons are added from the product screen in a later slice if
needed; the schema/API already support `retailerProductId`). The unused `products`
state + `listRetailerProducts` import are intentionally omitted to avoid dead code:
remove `products`/`setProducts` and the `listRetailerProducts`/`RetailerProductWithRetailer`
imports if the linter flags them. (Keep only what the screen uses.)

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean. (If typecheck flags unused `products`/`listRetailerProducts`, delete those lines.)

- [ ] **Step 5: Commit**

```bash
git add "app/retail/coupons.tsx" "app/retail/_layout.tsx" "app/retail/index.tsx"
git commit -m "feat(coupons): discovery screen + hub link + stack entry"
```

---

### Task 8: Applicable coupons on the product-prices screen

**Files:**
- Modify: `app/retail/product/[id].tsx`

**Interfaces:**
- Consumes: `listCouponsForProduct`, `CouponWithRefs` from `couponApi`; `applyCoupon` from `coupon`; existing `prices`, `product`, `formatAmount`.

- [ ] **Step 1: Load applicable coupons in the product screen**

In `app/retail/product/[id].tsx`, add the imports near the other feature imports:

```typescript
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
```

Add coupon state alongside the other `useState` hooks:

```typescript
  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
```

In `load()`, extend the `Promise.all` destructure to also fetch coupons — change:

```typescript
      const [p, pr, ls, rs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
      ]);
```

to:

```typescript
      const [p, pr, ls, rs, cs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
        listCouponsForProduct(productId),
      ]);
      setCoupons(cs);
```

- [ ] **Step 2: Render an applicable-coupons section**

Immediately after the `sorted`-prices `View style={styles.list}` block (before the
`<View style={styles.divider} />` that precedes "linkRetailer"), insert a coupons
section. It computes savings against the cheapest current effective price:

```typescript
        {coupons.length > 0 && sorted.length > 0 && (() => {
          const cheapest = sorted[0];
          const base = cheapest.sale_price_minor ?? cheapest.regular_price_minor;
          const nowMs = Date.now();
          return (
            <View style={styles.list}>
              <Text variant="heading">{t('coupons.applicableTitle')}</Text>
              {coupons.map((c) => {
                const r = applyCoupon(c, base, cheapest.currency_code, nowMs);
                return (
                  <View key={c.id} style={styles.card}>
                    <Text variant="heading">{c.title}</Text>
                    <Text variant="caption" muted>{c.retailer?.name ?? '—'}</Text>
                    {r.applicable ? (
                      <Text variant="caption" style={{ color: palette.brand }}>
                        {t('coupons.expectedFinal', { price: formatAmount(r.finalMinor, cheapest.currency_code) })}
                        {' · '}
                        {t('coupons.expectedSavings', { amount: formatAmount(r.savingsMinor, cheapest.currency_code) })}
                      </Text>
                    ) : (
                      <Text variant="caption" muted>{t('coupons.notApplicable')}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/retail/product/[id].tsx"
git commit -m "feat(coupons): show applicable coupons + expected savings on product screen"
```

---

### Task 9: Extend RLS integration test for coupons

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `idB`, `ret`, `rp` from the retail block).

- [ ] **Step 1: Add coupon setup + constraint check (after the retail saved-location block, before "B cannot read A's household")**

```javascript
  // --- coupons: A creates a valid coupon; malformed one is rejected ---------
  const { data: coup, error: coupErr } = await a
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: '10% off',
      discount_type: 'percent', discount_percent: 10, created_by: idA })
    .select('id').single();
  ok('A can create a percent coupon', !coupErr && Boolean(coup?.id));

  // CHECK: a percent coupon may not carry a fixed amount.
  const { error: badErr } = await a
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: 'bad',
      discount_type: 'percent', discount_percent: 10, discount_amount_minor: 500, created_by: idA });
  ok('coupon CHECK rejects a mixed fixed/percent shape', Boolean(badErr));
```

- [ ] **Step 2: Add B-cannot-access assertions (in the "B cannot read A" section)**

```javascript
  // B CANNOT read or write A's coupons (not a member yet).
  const { data: bCoupons } = await b.from('coupons').select('id').eq('household_id', hid);
  ok("B cannot read A's coupons (RLS)", (bCoupons ?? []).length === 0);
  const { error: bCoupErr } = await b
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: 'x',
      discount_type: 'percent', discount_percent: 5, created_by: idB });
  ok("B cannot create a coupon in A's household", Boolean(bCoupErr));
```

- [ ] **Step 3: Add a post-join read assertion (after "B can read retailers after joining")**

```javascript
  const { data: bCouponsAfter } = await b.from('coupons').select('id').eq('household_id', hid);
  ok('B can read coupons after joining', (bCouponsAfter ?? []).length >= 1);
```

- [ ] **Step 4: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass. Remove the key after.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(coupons): RLS isolation + fixed/percent CHECK constraint"
```

---

### Task 10: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; unit suites pass (incl. `tests/retail/coupon.test.ts`); RLS suite passes incl. coupon assertions.

- [ ] **Step 2: Manual smoke (optional)**

More → Retail → Coupons → add a percent coupon for a retailer → confirm it appears
under Active. Open a product sold at that retailer → confirm the coupon shows an
expected final price + savings against the cheapest price.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- coupons table (fixed/percent, min/cap, expiry, code, source_url, scope) → Task 1 ✓; type Task 2 ✓
- fixed-vs-percent CHECK → Task 1 + Task 9 assertion ✓
- savings engine (couponStatus, applyCoupon, currency guard, min-purchase, cap, floor at 0) → Task 3 ✓
- data access incl. list-for-product (product's retailer_products OR retailer-wide) → Task 5 ✓
- discovery screen (active/expired, add, Level-1 URL) → Task 7 ✓
- applicable coupons + expected savings on product screen → Task 8 ✓
- i18n en/fil/ar → Task 6 ✓
- RLS isolation → Task 9 ✓
- grocery matching / BOGO / loyalty / L2-L3 → explicitly deferred (not built) ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete. Task 7 notes to drop
the unused `products`/`listRetailerProducts` lines if the linter flags them — to
keep the shipped screen dead-code-free, omit them from the start (create-retailer-wide
coupons only this slice).

**Type consistency:** `CouponRow`/`CouponDiscountType` (Task 2) used in Tasks 3/5.
`CouponWithRefs`, `CreateCouponData` (Task 5) used in Tasks 7/8. `createCouponSchema`
(Task 4) fields (`amountMajor`, `currencyCode`, `percent`, `minPurchaseMajor`,
`maxDiscountMajor`, `expiresAt`) match the screen in Task 7. `applyCoupon`/`couponStatus`
signatures (Task 3) match Tasks 7/8. `createCoupon` takes minor units (`CreateCouponData`);
the screen converts via `toMinorUnits`.


## plan 2026-08-12-phase5c-price-comparison

# Phase 5 Slice 5c — Price Comparison & Basket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link grocery items to catalog products and compare a list's cost across branches — cheapest single-store basket with coverage, a best-price floor, and potential coupon savings, all in the household reporting currency.

**Architecture:** A migration adds a nullable `product_id` to `grocery_items` and extends the existing enforce-list trigger to validate the product's household. A pure `basket.ts` helper computes per-column totals + a best-price floor over opaque column keys. `basketApi.getBasketPrices` assembles latest prices per (product, column) in the reporting currency; a link screen and a compare screen surface it, reusing 5b's `applyCoupon` for potential savings.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.**
- **No mixing currencies.** Comparison runs in the household reporting currency; other-currency prices are excluded and flagged.
- **RLS is the security boundary.** No RLS changes here; the enforce-list trigger validates the product's household.
- **Data access only through feature `api` modules.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000008_grocery_product_link.sql`.
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Migration — grocery_items.product_id + trigger household check

**Files:**
- Create: `supabase/migrations/20260812000008_grocery_product_link.sql`

**Interfaces:**
- Consumes: `public.grocery_items`, `public.grocery_lists`, `public.products`, existing `grocery_items_enforce_list` trigger.
- Produces: `grocery_items.product_id` column + updated trigger function.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260812000008_grocery_product_link.sql`:

```sql
-- ============================================================================
-- Phase 5 slice 5c — link grocery items to catalog products
-- ============================================================================
-- Adds a nullable product_id to grocery_items so a list item can be priced
-- against the retail catalog. The enforce-list trigger now also verifies the
-- linked product belongs to the same household. No RLS change.
-- ============================================================================

alter table public.grocery_items
  add column if not exists product_id uuid references public.products (id) on delete set null;
create index if not exists idx_grocery_items_product on public.grocery_items (product_id);

create or replace function public.grocery_items_enforce_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h  uuid;
  _ph uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then
    raise exception 'grocery list not found';
  end if;
  new.household_id := _h; -- household always follows the parent list

  if new.product_id is not null then
    select household_id into _ph from public.products where id = new.product_id;
    if _ph is null or _ph <> _h then
      raise exception 'product does not belong to this household';
    end if;
  end if;
  return new;
end;
$$;
```

(The `trg_grocery_items_enforce_list` trigger already points at this function; only
the body changes.)

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor, run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select column_name from information_schema.columns
  where table_schema='public' and table_name='grocery_items' and column_name='product_id';
```
Expected: 1 row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000008_grocery_product_link.sql
git commit -m "feat(compare): 5c migration — grocery_items.product_id + trigger household check"
```

---

### Task 2: TypeScript type update

**Files:**
- Modify: `lib/database.types.ts` (`GroceryItemRow`)

**Interfaces:**
- Produces: `GroceryItemRow.product_id: string | null`.

- [ ] **Step 1: Add `product_id` to `GroceryItemRow`**

In `lib/database.types.ts`, in `GroceryItemRow`, add the field after `household_id`:

```typescript
export interface GroceryItemRow {
  id: string;
  list_id: string;
  household_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_price_minor: number | null;
  actual_price_minor: number | null;
  is_purchased: boolean;
  added_by: string;
  purchased_by: string | null;
  purchased_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(compare): add product_id to GroceryItemRow"
```

---

### Task 3: Pure basket helper (TDD)

**Files:**
- Create: `features/retail/basket.ts`
- Test: `tests/retail/basket.test.ts`

**Interfaces:**
- Produces:
  - `interface BasketItem { productId: string }`
  - `interface PricePoint { productId: string; columnKey: string; effectiveMinor: number }`
  - `interface ColumnTotal { columnKey: string; totalMinor: number; pricedCount: number; missingCount: number }`
  - `compareColumns(items: BasketItem[], prices: PricePoint[]): ColumnTotal[]`
  - `bestFloorMinor(items: BasketItem[], prices: PricePoint[]): { totalMinor: number; pricedCount: number }`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/basket.test.ts`:

```typescript
import { bestFloorMinor, compareColumns } from '@/features/retail/basket';

const items = [{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }];
const prices = [
  { productId: 'a', columnKey: 's1', effectiveMinor: 100 },
  { productId: 'b', columnKey: 's1', effectiveMinor: 200 },
  { productId: 'a', columnKey: 's2', effectiveMinor: 90 },
  { productId: 'b', columnKey: 's2', effectiveMinor: 250 },
  { productId: 'c', columnKey: 's2', effectiveMinor: 400 },
];

describe('compareColumns', () => {
  it('totals each column and flags missing items, sorted ascending', () => {
    const cols = compareColumns(items, prices);
    // s1 has a+b priced (300), c missing; s2 has a+b+c (740), none missing.
    expect(cols).toEqual([
      { columnKey: 's1', totalMinor: 300, pricedCount: 2, missingCount: 1 },
      { columnKey: 's2', totalMinor: 740, pricedCount: 3, missingCount: 0 },
    ]);
  });

  it('uses the lowest price if an item repeats in a column', () => {
    const cols = compareColumns([{ productId: 'a' }], [
      { productId: 'a', columnKey: 's1', effectiveMinor: 500 },
      { productId: 'a', columnKey: 's1', effectiveMinor: 300 },
    ]);
    expect(cols).toEqual([{ columnKey: 's1', totalMinor: 300, pricedCount: 1, missingCount: 0 }]);
  });

  it('returns [] when there are no prices', () => {
    expect(compareColumns(items, [])).toEqual([]);
  });
});

describe('bestFloorMinor', () => {
  it('sums the lowest price per item across all columns', () => {
    // a: min(100,90)=90; b: min(200,250)=200; c: 400 => 690, all 3 priced.
    expect(bestFloorMinor(items, prices)).toEqual({ totalMinor: 690, pricedCount: 3 });
  });

  it('counts only items priced somewhere', () => {
    expect(bestFloorMinor(items, [{ productId: 'a', columnKey: 's1', effectiveMinor: 100 }]))
      .toEqual({ totalMinor: 100, pricedCount: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/basket.test.ts`
Expected: FAIL — cannot find module `@/features/retail/basket`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/basket.ts`:

```typescript
/**
 * Pure basket comparison over opaque column keys (the caller maps a branch or an
 * online retailer to a key + label). Amounts are integer minor units in ONE
 * currency (caller pre-filters to the reporting currency). Coupons are handled
 * separately — totals here are pre-coupon.
 */

export interface BasketItem {
  productId: string;
}
export interface PricePoint {
  productId: string;
  columnKey: string;
  effectiveMinor: number;
}
export interface ColumnTotal {
  columnKey: string;
  totalMinor: number;
  pricedCount: number;
  missingCount: number;
}

/** Lowest price per (product, column). */
function lowestByProductColumn(prices: readonly PricePoint[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.productId} ${p.columnKey}`;
    const prev = best.get(key);
    if (prev === undefined || p.effectiveMinor < prev) best.set(key, p.effectiveMinor);
  }
  return best;
}

/** Per column: total of priced items + coverage counts. Sorted by total asc. */
export function compareColumns(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): ColumnTotal[] {
  const lowest = lowestByProductColumn(prices);
  const columns = Array.from(new Set(prices.map((p) => p.columnKey)));
  const totals = columns.map((columnKey) => {
    let totalMinor = 0;
    let pricedCount = 0;
    for (const it of items) {
      const v = lowest.get(`${it.productId} ${columnKey}`);
      if (v !== undefined) {
        totalMinor += v;
        pricedCount += 1;
      }
    }
    return { columnKey, totalMinor, pricedCount, missingCount: items.length - pricedCount };
  });
  return totals.sort((a, b) => a.totalMinor - b.totalMinor);
}

/** Best price per item across all columns, summed (the theoretical floor). */
export function bestFloorMinor(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): { totalMinor: number; pricedCount: number } {
  const bestPerProduct = new Map<string, number>();
  for (const p of prices) {
    const prev = bestPerProduct.get(p.productId);
    if (prev === undefined || p.effectiveMinor < prev) bestPerProduct.set(p.productId, p.effectiveMinor);
  }
  let totalMinor = 0;
  let pricedCount = 0;
  for (const it of items) {
    const v = bestPerProduct.get(it.productId);
    if (v !== undefined) {
      totalMinor += v;
      pricedCount += 1;
    }
  }
  return { totalMinor, pricedCount };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/basket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/retail/basket.ts tests/retail/basket.test.ts
git commit -m "feat(compare): pure basket comparison helper + tests"
```

---

### Task 4: Data layer — item linking + basket prices

**Files:**
- Modify: `features/grocery/api.ts` (add `setGroceryItemProduct`)
- Create: `features/retail/basketApi.ts`

**Interfaces:**
- Consumes: `getSupabase`, `AppError`, `listRetailerProducts` (from retail api), `PricePoint` (from basket).
- Produces:
  - `setGroceryItemProduct(itemId: string, productId: string | null): Promise<void>`
  - `getBasketPrices(productIds: string[], currencyCode: string): Promise<{ prices: PricePoint[]; labels: Record<string, string> }>`

- [ ] **Step 1: Add `setGroceryItemProduct` to the grocery api**

Append to `features/grocery/api.ts` (after `deleteItem`):

```typescript
/** Link (or clear) the catalog product a list item refers to. */
export async function setGroceryItemProduct(
  itemId: string,
  productId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_items')
    .update({ product_id: productId })
    .eq('id', itemId);
  if (error) fail('grocery.errors.saveFailed', error);
}
```

- [ ] **Step 2: Create the basket price assembler**

Create `features/retail/basketApi.ts`:

```typescript
/**
 * Assembles latest prices per (product, column) in one currency for basket
 * comparison. A "column" is a physical branch (store id) or an online retailer
 * (online:{retailerId}). Reduces to the latest snapshot per (product, column),
 * effective = min(regular, sale).
 */

import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type { PricePoint } from '@/features/retail/basket';

interface PriceJoinRow {
  regular_price_minor: number;
  sale_price_minor: number | null;
  observed_at: string;
  store_id: string | null;
  retailer_product: { product_id: string; retailer: { id: string; name: string } | null } | null;
  store: { id: string; name: string } | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getBasketPrices(
  productIds: string[],
  currencyCode: string,
): Promise<{ prices: PricePoint[]; labels: Record<string, string> }> {
  if (productIds.length === 0) return { prices: [], labels: {} };

  // Which retailer_products belong to these products?
  const { data: rps, error: rpErr } = await getSupabase()
    .from('retailer_products')
    .select('id')
    .in('product_id', productIds);
  if (rpErr) fail('retail.errors.loadFailed', rpErr);
  const rpIds = (rps ?? []).map((r) => (r as { id: string }).id);
  if (rpIds.length === 0) return { prices: [], labels: {} };

  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select(
      'regular_price_minor, sale_price_minor, observed_at, store_id,' +
        'retailer_product:retailer_products(product_id, retailer:retailers(id,name)),' +
        'store:retailer_stores(id,name)',
    )
    .in('retailer_product_id', rpIds)
    .eq('currency_code', currencyCode)
    .order('observed_at', { ascending: false });
  if (error) fail('retail.errors.loadFailed', error);

  const rows = (data ?? []) as unknown as PriceJoinRow[];
  const labels: Record<string, string> = {};
  // Latest per (productId, columnKey): rows are already newest-first, so keep first seen.
  const seen = new Set<string>();
  const prices: PricePoint[] = [];
  for (const r of rows) {
    const productId = r.retailer_product?.product_id;
    if (!productId) continue;
    const retailerId = r.retailer_product?.retailer?.id ?? 'unknown';
    const retailerName = r.retailer_product?.retailer?.name ?? '—';
    const columnKey = r.store_id ?? `online:${retailerId}`;
    const dedupe = `${productId} ${columnKey}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const effectiveMinor = Math.min(
      r.regular_price_minor,
      r.sale_price_minor ?? r.regular_price_minor,
    );
    prices.push({ productId, columnKey, effectiveMinor });
    labels[columnKey] = r.store?.name ?? `Online · ${retailerName}`;
  }
  return { prices, labels };
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add features/grocery/api.ts features/retail/basketApi.ts
git commit -m "feat(compare): item-product linking + basket price assembler"
```

---

### Task 5: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json` (extend the existing `grocery` namespace)

**Interfaces:**
- Produces: new `grocery.linkProduct`, `grocery.linkedTo`, `grocery.unlink`, `grocery.compareCta`, `grocery.selectProduct`, and a `grocery.compare` sub-object — identical key sets across languages.

- [ ] **Step 1: Add the keys to `locales/en.json` inside the `grocery` object**

Add these members to the existing `"grocery": { ... }` object (e.g. after `"someone"`):

```json
"linkProduct": "Link product",
"linkedTo": "Linked: {{name}}",
"unlink": "Unlink",
"selectProduct": "Select a product",
"compareCta": "Compare prices",
"compare": {
  "title": "Price comparison",
  "noLinked": "Link items to products to compare prices.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} of {{total}} items priced",
  "missing": "{{count}} unpriced here",
  "floor": "Best price anywhere: {{total}} ({{priced}} of {{total_items}})",
  "potentialSavings": "Potential coupon savings: {{amount}}",
  "cheapest": "Cheapest"
}
```

- [ ] **Step 2: Add the same keys to `locales/fil.json`**

```json
"linkProduct": "I-link ang produkto",
"linkedTo": "Naka-link: {{name}}",
"unlink": "I-unlink",
"selectProduct": "Pumili ng produkto",
"compareCta": "Ihambing ang presyo",
"compare": {
  "title": "Paghahambing ng presyo",
  "noLinked": "I-link ang mga item sa produkto para maihambing ang presyo.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} sa {{total}} item may presyo",
  "missing": "{{count}} walang presyo dito",
  "floor": "Pinakamurang presyo kahit saan: {{total}} ({{priced}} sa {{total_items}})",
  "potentialSavings": "Posibleng matipid sa kupon: {{amount}}",
  "cheapest": "Pinakamura"
}
```

- [ ] **Step 3: Add the same keys to `locales/ar.json`**

```json
"linkProduct": "ربط منتج",
"linkedTo": "مرتبط: {{name}}",
"unlink": "إلغاء الربط",
"selectProduct": "اختر منتجًا",
"compareCta": "قارن الأسعار",
"compare": {
  "title": "مقارنة الأسعار",
  "noLinked": "اربط العناصر بالمنتجات لمقارنة الأسعار.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} من {{total}} عناصر مُسعّرة",
  "missing": "{{count}} بدون سعر هنا",
  "floor": "أفضل سعر في أي مكان: {{total}} ({{priced}} من {{total_items}})",
  "potentialSavings": "توفير محتمل بالكوبونات: {{amount}}",
  "cheapest": "الأرخص"
}
```

- [ ] **Step 4: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (matching key sets).

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(compare): i18n strings for linking + comparison"
```

---

### Task 6: Link-product screen + list-detail wiring

**Files:**
- Create: `app/grocery/link/[itemId].tsx`
- Modify: `app/grocery/_layout.tsx` (add `link/[itemId]` and `compare/[id]` entries)
- Modify: `app/grocery/[id].tsx` (per-item link affordance + Compare button + load product names)

**Interfaces:**
- Consumes: `setGroceryItemProduct` (grocery api); `listProducts` (retail api); `useActiveHousehold`.

- [ ] **Step 1: Add stack entries to the grocery layout**

Replace the single-screen `<Stack>` body in `app/grocery/_layout.tsx`:

```typescript
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
      <Stack.Screen name="link/[itemId]" options={{ title: t('grocery.selectProduct') }} />
      <Stack.Screen name="compare/[id]" options={{ title: t('grocery.compare.title') }} />
```

- [ ] **Step 2: Create the link-product screen**

Create `app/grocery/link/[itemId].tsx`:

```typescript
/** Pick the catalog product a grocery item refers to (or unlink). */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { setGroceryItemProduct } from '@/features/grocery/api';
import { listProducts } from '@/features/retail/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function LinkProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = String(itemId);
  const { active } = useActiveHousehold();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    try {
      setProducts(await listProducts(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function pick(productId: string | null) {
    try {
      await setGroceryItemProduct(id, productId);
      router.back();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        <Button label={t('grocery.unlink')} variant="secondary" onPress={() => pick(null)} />
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : products.length === 0 ? (
          <Text muted>{t('retail.noProducts')}</Text>
        ) : (
          <View style={styles.list}>
            {products.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => pick(p.id)}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="caption" muted>
                  {[p.brand, p.size_value ? `${p.size_value}${p.size_unit ?? ''}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
});
```

- [ ] **Step 3: Wire the list-detail screen — load product names, add per-item link affordance + Compare button**

In `app/grocery/[id].tsx`:

(a) Add imports near the other feature imports:

```typescript
import { listProducts } from '@/features/retail/api';
```

Also add `useRouter` to the existing `expo-router` import so the line reads:

```typescript
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
```

(b) Add product-name state alongside the others:

```typescript
  const [productNames, setProductNames] = useState<Record<string, string>>({});
```

(c) In the component body, get the router (near `const { t } = useTranslation();`):

```typescript
  const router = useRouter();
```

(d) In `load()`, after `setItems(its);`, also load product names:

```typescript
      if (l) {
        const prods = await listProducts(l.household_id);
        setProductNames(Object.fromEntries(prods.map((p) => [p.id, p.name])));
      }
```

(e) In each item card, after the attribution `<Text>` line
(`{t('grocery.addedBy', ...)}`), add a link affordance:

```typescript
              <Pressable onPress={() => router.push(`/grocery/link/${it.id}`)}>
                <Text variant="caption" style={{ color: palette.brand }}>
                  {it.product_id
                    ? t('grocery.linkedTo', { name: productNames[it.product_id] ?? '…' })
                    : t('grocery.linkProduct')}
                </Text>
              </Pressable>
```

(f) In the summary block (after the `purchasedOf` line's closing `</Text>`, before
the block's closing `</View>`), add a Compare button shown when any item is linked:

```typescript
          {items.some((it) => it.product_id) && (
            <Button
              label={t('grocery.compareCta')}
              variant="secondary"
              onPress={() => router.push(`/grocery/compare/${listId}`)}
            />
          )}
```

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/grocery/link/[itemId].tsx" "app/grocery/_layout.tsx" "app/grocery/[id].tsx"
git commit -m "feat(compare): link-product screen + list-detail wiring"
```

---

### Task 7: Comparison screen

**Files:**
- Create: `app/grocery/compare/[id].tsx`

**Interfaces:**
- Consumes: `listItems` (grocery api); `getBasketPrices` (basketApi); `compareColumns`, `bestFloorMinor` (basket); `listCouponsForProduct` (couponApi); `applyCoupon` (coupon); `useActiveHousehold`; `formatAmount`.

- [ ] **Step 1: Create the comparison screen**

Create `app/grocery/compare/[id].tsx`:

```typescript
/** Compare a grocery list's linked items across branches (reporting currency):
 *  ranked column totals + coverage, best-price floor, and potential coupon savings. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui';
import { listItems } from '@/features/grocery/api';
import { bestFloorMinor, compareColumns } from '@/features/retail/basket';
import type { ColumnTotal } from '@/features/retail/basket';
import { getBasketPrices } from '@/features/retail/basketApi';
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function CompareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);
  const { active } = useActiveHousehold();

  const [columns, setColumns] = useState<ColumnTotal[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [floor, setFloor] = useState<{ totalMinor: number; pricedCount: number }>({ totalMinor: 0, pricedCount: 0 });
  const [itemCount, setItemCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ccy = active?.reporting_currency_code ?? 'USD';

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const items = await listItems(listId);
      const linked = items.filter((it) => it.product_id) as (typeof items[number] & { product_id: string })[];
      const productIds = Array.from(new Set(linked.map((it) => it.product_id)));
      setItemCount(productIds.length);
      if (productIds.length === 0) {
        setColumns([]);
        setFloor({ totalMinor: 0, pricedCount: 0 });
        setPotentialSavings(0);
        return;
      }
      const { prices, labels: lbls } = await getBasketPrices(productIds, ccy);
      const basketItems = productIds.map((productId) => ({ productId }));
      setColumns(compareColumns(basketItems, prices));
      setLabels(lbls);
      setFloor(bestFloorMinor(basketItems, prices));

      // Potential coupon savings: best applicable coupon per product vs its best price.
      const now = Date.now();
      const bestByProduct = new Map<string, number>();
      for (const p of prices) {
        const prev = bestByProduct.get(p.productId);
        if (prev === undefined || p.effectiveMinor < prev) bestByProduct.set(p.productId, p.effectiveMinor);
      }
      let savings = 0;
      for (const productId of productIds) {
        const base = bestByProduct.get(productId);
        if (base === undefined) continue;
        const coupons = await listCouponsForProduct(productId);
        let best = 0;
        for (const c of coupons) {
          const r = applyCoupon(c, base, ccy, now);
          if (r.applicable && r.savingsMinor > best) best = r.savingsMinor;
        }
        savings += best;
      }
      setPotentialSavings(savings);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, listId, ccy]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {itemCount === 0 ? (
          <Text muted>{t('grocery.compare.noLinked')}</Text>
        ) : columns.length === 0 ? (
          <Text muted>{t('retail.noPrices')}</Text>
        ) : (
          <>
            <View style={styles.list}>
              {columns.map((col, idx) => (
                <View key={col.columnKey} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">{labels[col.columnKey] ?? col.columnKey}</Text>
                    <Text variant="heading">{formatAmount(col.totalMinor, ccy)}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text variant="caption" muted>
                      {t('grocery.compare.coverage', { priced: col.pricedCount, total: itemCount })}
                    </Text>
                    {idx === 0 ? (
                      <Text variant="caption" style={{ color: palette.brand }}>{t('grocery.compare.cheapest')}</Text>
                    ) : col.missingCount > 0 ? (
                      <Text variant="caption" muted>{t('grocery.compare.missing', { count: col.missingCount })}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text variant="caption" muted>
                {t('grocery.compare.floor', {
                  total: formatAmount(floor.totalMinor, ccy),
                  priced: floor.pricedCount,
                  total_items: itemCount,
                })}
              </Text>
              {potentialSavings > 0 ? (
                <Text variant="caption" style={{ color: palette.brand }}>
                  {t('grocery.compare.potentialSavings', { amount: formatAmount(potentialSavings, ccy) })}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
```

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/grocery/compare/[id].tsx"
git commit -m "feat(compare): basket comparison screen (columns, floor, coupon savings)"
```

---

### Task 8: Extend RLS integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `prod` and `gi` from earlier blocks).

- [ ] **Step 1: Add a link + cross-household-rejection assertion (after the retail catalog block, before the coupons block)**

Locate the grocery item created earlier in the retail-or-grocery setup. The grocery
item `gi` (id in `gi?.id`) and the retail product `prod` (id in `prod?.id`) both
belong to A's household `hid`. Add:

```javascript
  // --- 5c: A links a grocery item to a product; cross-household is rejected --
  const { error: linkErr } = await a
    .from('grocery_items')
    .update({ product_id: prod?.id })
    .eq('id', gi?.id);
  ok('A can link a grocery item to a product', !linkErr);
  const { data: linked } = await a
    .from('grocery_items').select('product_id').eq('id', gi?.id).single();
  ok('grocery item product_id reads back', linked?.product_id === prod?.id);

  // Linking a product from a DIFFERENT household is rejected by the trigger.
  // (Create a throwaway product under B's household after B has one; here we
  // assert the trigger path using a random uuid that isn't A's product.)
  const { error: badLinkErr } = await a
    .from('grocery_items')
    .update({ product_id: '00000000-0000-0000-0000-000000000000' })
    .eq('id', gi?.id);
  ok('linking a non-household product is rejected', Boolean(badLinkErr));
```

- [ ] **Step 2: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass (the bad-link update raises because the product id
doesn't exist / isn't in the household → trigger `raise exception`). Remove the key after.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(compare): grocery item product link + cross-household rejection"
```

---

### Task 9: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; unit suites pass (incl. `tests/retail/basket.test.ts`); RLS suite passes incl. the link assertions.

- [ ] **Step 2: Manual smoke (optional)**

Grocery → open a list → add an item → "Link product" → pick a catalog product →
"Compare prices" → confirm branch columns rank by total with coverage, the
best-price floor shows, and potential coupon savings appears when a matching
coupon exists.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- product_id column + trigger household check → Task 1 ✓; type Task 2 ✓
- pure comparison (columns, coverage, floor) → Task 3 ✓
- item linking + basket price assembly (reporting currency, latest per product/column) → Task 4 ✓
- link screen + list wiring + compare button → Task 6 ✓
- comparison screen (ranked totals, coverage, floor, potential coupon savings) → Task 7 ✓
- coupons as potential savings, totals pre-coupon → Task 7 (savings computed separately) ✓
- i18n → Task 5 ✓
- RLS/trigger cross-household rejection → Task 8 ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** `PricePoint`/`BasketItem`/`ColumnTotal` (Task 3) used by Task 4
(`getBasketPrices` returns `PricePoint[]`) and Task 7. `setGroceryItemProduct`
(Task 4) consumed in Task 6. `getBasketPrices(productIds, currencyCode)` signature
matches Task 7's call. `GroceryItemRow.product_id` (Task 2) used in Tasks 6/7.
`compareColumns`/`bestFloorMinor` names match between Task 3 and Task 7.

**Note (Task 8):** the cross-household rejection uses a non-existent uuid, which the
trigger rejects via `_ph is null` — exercising the same guard path as a real
other-household id. This avoids needing B's product created before A's block runs.


## plan 2026-08-12-phase5d-connector-pipeline

# Phase 5 Slice 5d (architecture subset) — Connector Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the credential-free 5d architecture — a pure normalize→persist price pipeline, a reference (mock) connector, and a reference ingest runner — proving the connector interface works end-to-end without any live integration.

**Architecture:** No migration, no live network calls, no UI. Reuses the 5a `price_snapshots` table, the types-only `connector.ts` interface, and `createPrice`. A pure `buildPriceInserts` maps `NormalizedPrice[]` → insert rows; `mockConnector` implements `RetailerConnector` from a fixture; `ingestFromConnector` composes them and persists — the exact core a production Edge Function will run server-side.

**Tech Stack:** TypeScript, jest. (No Supabase schema change.)

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code.** `buildPriceInserts` validates `^[A-Z]{3}$` and rejects non-finite/negative amounts.
- **No faking, no scraping, no client-side secrets.** `mockConnector` is a labeled dev/test fixture that performs no network calls and no coupon clipping. Real adapters run server-side (Edge Function) — see the ADR.
- **No new migration; no `test:rls` change.**
- Verification: `npm run typecheck`, `npm test`.

---

### Task 1: Pure `buildPriceInserts` (TDD)

**Files:**
- Create: `features/retail/ingest.ts` (the `buildPriceInserts` export + `PriceInsertRow` type)
- Test: `tests/retail/ingest.test.ts`

**Interfaces:**
- Consumes: `NormalizedPrice` from `features/retail/connector.ts`.
- Produces:
  - `interface PriceInsertRow { retailerProductId: string; storeId?: string; regularMinor: number; saleMinor?: number; memberMinor?: number; currencyCode: string; source: string }`
  - `buildPriceInserts(retailerProductId: string, storeId: string | undefined, prices: NormalizedPrice[]): PriceInsertRow[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/ingest.test.ts`:

```typescript
import { buildPriceInserts } from '@/features/retail/ingest';
import type { NormalizedPrice } from '@/features/retail/connector';

function np(over: Partial<NormalizedPrice>): NormalizedPrice {
  return {
    regularMinor: 1000,
    currencyCode: 'usd',
    observedAt: '2026-08-12T00:00:00Z',
    source: 'connector',
    ...over,
  };
}

describe('buildPriceInserts', () => {
  it('maps a valid price and uppercases the currency', () => {
    const rows = buildPriceInserts('rp1', 's1', [np({ regularMinor: 1000, saleMinor: 800, currencyCode: 'usd' })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: 's1', regularMinor: 1000, saleMinor: 800, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('omits sale/member when absent and passes storeId undefined', () => {
    const rows = buildPriceInserts('rp1', undefined, [np({ regularMinor: 500 })]);
    expect(rows).toEqual([
      { retailerProductId: 'rp1', storeId: undefined, regularMinor: 500, currencyCode: 'USD', source: 'connector' },
    ]);
  });

  it('skips an invalid currency', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ currencyCode: 'US' })])).toEqual([]);
  });

  it('skips a negative or non-finite regular price', () => {
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: -1 })])).toEqual([]);
    expect(buildPriceInserts('rp1', undefined, [np({ regularMinor: Number.NaN })])).toEqual([]);
  });

  it('defaults source to "connector" when the price omits it', () => {
    const rows = buildPriceInserts('rp1', undefined, [{ regularMinor: 100, currencyCode: 'PHP', observedAt: 'x', source: '' }]);
    expect(rows[0]?.source).toBe('connector');
  });

  it('returns [] for empty input', () => {
    expect(buildPriceInserts('rp1', 's1', [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: FAIL — cannot find module `@/features/retail/ingest`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/ingest.ts`:

```typescript
/**
 * Connector ingest pipeline (5d architecture subset). `buildPriceInserts` is a
 * pure mapping from a connector's NormalizedPrice[] to price_snapshots insert
 * rows; `ingestFromConnector` (added later) composes a connector + this mapping +
 * persistence. In production the runner lives in a Supabase Edge Function so
 * retailer secrets never reach the client (see the 5d ADR).
 */

import type { NormalizedPrice } from '@/features/retail/connector';

export interface PriceInsertRow {
  retailerProductId: string;
  storeId?: string;
  regularMinor: number;
  saleMinor?: number;
  memberMinor?: number;
  currencyCode: string;
  source: string;
}

const isValidMinor = (n: number | undefined): n is number =>
  n !== undefined && Number.isFinite(n) && n >= 0;

/** Map connector prices to insert rows, dropping malformed entries. Pure. */
export function buildPriceInserts(
  retailerProductId: string,
  storeId: string | undefined,
  prices: NormalizedPrice[],
): PriceInsertRow[] {
  const rows: PriceInsertRow[] = [];
  for (const p of prices) {
    const currencyCode = (p.currencyCode ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;
    if (!Number.isFinite(p.regularMinor) || p.regularMinor < 0) continue;
    const row: PriceInsertRow = {
      retailerProductId,
      storeId,
      regularMinor: p.regularMinor,
      currencyCode,
      source: p.source && p.source.length > 0 ? p.source : 'connector',
    };
    if (isValidMinor(p.saleMinor)) row.saleMinor = p.saleMinor;
    if (isValidMinor(p.memberMinor)) row.memberMinor = p.memberMinor;
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/retail/ingest.ts tests/retail/ingest.test.ts
git commit -m "feat(5d): pure buildPriceInserts normalization + tests"
```

---

### Task 2: Reference mock connector

**Files:**
- Create: `features/retail/connectors/mockConnector.ts`

**Interfaces:**
- Consumes: `RetailerConnector`, `NormalizedProduct`, `NormalizedPrice`, `ProductSearchInput`, `PriceLookupInput` from `features/retail/connector.ts`.
- Produces: `mockConnector: RetailerConnector` and `MOCK_FIXTURE` (for tests).

- [ ] **Step 1: Write the mock connector**

Create `features/retail/connectors/mockConnector.ts`:

```typescript
/**
 * DEV/TEST FIXTURE ONLY — not a live retailer. Performs NO network calls and NO
 * coupon clipping. Exists to prove the RetailerConnector interface is
 * implementable and to exercise the ingest pipeline in tests. Real adapters
 * (Walmart/Kroger/etc.) run server-side in an Edge Function — see the 5d ADR.
 */

import type {
  NormalizedPrice,
  NormalizedProduct,
  PriceLookupInput,
  ProductSearchInput,
  RetailerConnector,
} from '@/features/retail/connector';

export const MOCK_FIXTURE: {
  products: NormalizedProduct[];
  pricesByRetailerProduct: Record<string, NormalizedPrice[]>;
} = {
  products: [
    { gtin: '0000000000017', name: 'Sample Rice 5kg', brand: 'SampleBrand', sizeValue: 5, sizeUnit: 'kg', packCount: 1 },
    { gtin: '0000000000024', name: 'Sample Cooking Oil 1L', brand: 'SampleBrand', sizeValue: 1, sizeUnit: 'L', packCount: 1 },
  ],
  pricesByRetailerProduct: {
    'rp-rice': [
      { regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
    'rp-oil': [
      { regularMinor: 12000, currencyCode: 'PHP', observedAt: '2026-08-12T00:00:00Z', source: 'mock' },
    ],
  },
};

export const mockConnector: RetailerConnector = {
  retailerId: 'mock',
  async searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]> {
    const q = input.query.trim().toLowerCase();
    if (!q) return MOCK_FIXTURE.products;
    return MOCK_FIXTURE.products.filter((p) => p.name.toLowerCase().includes(q));
  },
  async fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]> {
    return MOCK_FIXTURE.pricesByRetailerProduct[input.retailerProductId] ?? [];
  },
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/connectors/mockConnector.ts
git commit -m "feat(5d): reference mock connector (dev/test fixture)"
```

---

### Task 3: `createPrice` source support + reference ingest runner

**Files:**
- Modify: `features/retail/api.ts` (`CreatePriceMinorInput` + `createPrice` accept optional `source`)
- Modify: `features/retail/ingest.ts` (add `ingestFromConnector`)
- Test: `tests/retail/ingest.test.ts` (add a pipeline-composition test)

**Interfaces:**
- Consumes: `RetailerConnector`; `createPrice`, `CreatePriceMinorInput` (retail api); `buildPriceInserts`.
- Produces: `ingestFromConnector(householdId, connector, retailerProductId, storeId?): Promise<number>`.

- [ ] **Step 1: Add optional `source` to `CreatePriceMinorInput` and `createPrice`**

In `features/retail/api.ts`, update the `CreatePriceMinorInput` interface to add
`source?: string;` (after `currencyCode`), and in `createPrice`'s insert object add
`source: input.source ?? 'manual',` (after `currency_code: input.currencyCode,`).
The existing product-price screen call omits `source`, so it keeps defaulting to
`'manual'`.

```typescript
// in CreatePriceMinorInput:
  currencyCode: string;
  source?: string;
```
```typescript
// in createPrice(...).insert({ ... }):
      currency_code: input.currencyCode,
      source: input.source ?? 'manual',
```

- [ ] **Step 2: Add the composition test (write first)**

Append to `tests/retail/ingest.test.ts`:

```typescript
import { mockConnector } from '@/features/retail/connectors/mockConnector';

describe('mockConnector + buildPriceInserts (pipeline composition)', () => {
  it('turns fetched prices into insert rows', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'rp-rice' });
    const rows = buildPriceInserts('rp-rice', 'store-1', prices);
    expect(rows).toEqual([
      { retailerProductId: 'rp-rice', storeId: 'store-1', regularMinor: 30000, saleMinor: 28500, currencyCode: 'PHP', source: 'mock' },
    ]);
  });

  it('returns no rows for an unknown retailer product', async () => {
    const prices = await mockConnector.fetchPrice({ retailerProductId: 'nope' });
    expect(buildPriceInserts('nope', undefined, prices)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the composition test to verify it fails**

Run: `npx jest tests/retail/ingest.test.ts`
Expected: FAIL — `mockConnector` import resolves (Task 2) but this asserts new
behavior; it should pass for the mapping but confirm the compose path. (If it
already passes, that's fine — the value is the regression guard.) Proceed.

- [ ] **Step 4: Add the ingest runner**

Append to `features/retail/ingest.ts`:

```typescript
import { createPrice } from '@/features/retail/api';
import type { RetailerConnector } from '@/features/retail/connector';

/**
 * Reference runner: fetch a connector's prices for one retailer_product,
 * normalize, and persist as price_snapshots. Returns how many were inserted.
 * In production this runs inside an Edge Function (secrets server-side); locally
 * it works against the mock connector. Not wired to any screen.
 */
export async function ingestFromConnector(
  householdId: string,
  connector: RetailerConnector,
  retailerProductId: string,
  storeId?: string,
): Promise<number> {
  const prices = await connector.fetchPrice({ retailerProductId, storeId });
  const rows = buildPriceInserts(retailerProductId, storeId, prices);
  for (const row of rows) {
    await createPrice(householdId, {
      retailerProductId: row.retailerProductId,
      storeId: row.storeId,
      regularMinor: row.regularMinor,
      saleMinor: row.saleMinor,
      memberMinor: row.memberMinor,
      currencyCode: row.currencyCode,
      source: row.source,
    });
  }
  return rows.length;
}
```

Note: import lines go at the top of `ingest.ts` with the existing imports — shown
here inline for locality; place them in the import block.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm run typecheck && npx jest tests/retail/ingest.test.ts`
Expected: typecheck clean; all ingest tests pass.

- [ ] **Step 6: Commit**

```bash
git add features/retail/api.ts features/retail/ingest.ts tests/retail/ingest.test.ts
git commit -m "feat(5d): ingest runner + createPrice source support + composition test"
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
Expected: typecheck clean; all unit suites pass, including `tests/retail/ingest.test.ts`.

- [ ] **Step 2: Confirm no stray backend requirement**

5d adds no migration and no `test:rls` change. `createPrice`'s new optional
`source` defaults to `'manual'`, so the existing schema (which already defaults
`source` to `'manual'`) accepts it unchanged.

---

## Self-Review

**Spec coverage:**
- pure `buildPriceInserts` (validate currency, reject bad amounts, map fields) → Task 1 ✓
- reference mock connector (labeled fixture, no network/clipping) → Task 2 ✓
- reference `ingestFromConnector` runner (connector→normalize→persist) → Task 3 ✓
- unit tests for mapping + mock + composition → Tasks 1, 3 ✓
- ADR → written in the spec doc ✓
- deferred items (real adapters, Edge Function deploy, loyalty OAuth, global catalog) → not built ✓

**Placeholder scan:** No TBD/TODO. All code complete.

**Type consistency:** `PriceInsertRow` (Task 1) is mapped field-by-field into
`CreatePriceMinorInput` (extended in Task 3) by `ingestFromConnector`; both carry
`retailerProductId/storeId/regularMinor/saleMinor/memberMinor/currencyCode/source`.
`NormalizedPrice` fields (`regularMinor`, `saleMinor`, `memberMinor`, `currencyCode`,
`source`) match `features/retail/connector.ts`. `mockConnector` satisfies
`RetailerConnector` (Task 2), consumed in Tasks 3.


## plan 2026-08-12-phase6a-entitlements

# Phase 6 Slice 6a — Entitlements & Feature Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-household capability-flag entitlements: a subscription model + RLS, a pure plan resolver, an EntitlementsProvider + gates on two premium features, and an owner-only manual (pre-billing) plan toggle.

**Architecture:** A `household_subscriptions` table (one row per household, no row = free) with owner-only RLS and a `set_household_plan` RPC. A pure `plans.ts` maps plans→capabilities and resolves a subscription row to an effective plan. `EntitlementsProvider` (a context like `ActiveHouseholdProvider`) exposes `usePlan()`; the subscription screen and two gated features consume it.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), i18next, jest.

## Global Constraints

- **Per-household entitlement.** Gates check the active household's plan.
- **Capability flags** only (no numeric limits); the plan→capabilities map lives in `features/billing/plans.ts`.
- **RLS is the security boundary.** SELECT members; writes owner-only. The `set_household_plan` RPC re-checks owner.
- **Data access only through `features/billing/api.ts`.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000009_entitlements.sql`.
- **The manual toggle is a pre-billing placeholder** (owner-only, labeled) — 6b replaces it.
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Migration — household_subscriptions + RLS + RPC

**Files:**
- Create: `supabase/migrations/20260812000009_entitlements.sql`

**Interfaces:**
- Consumes: `public.households`, helpers `is_member_of`, `has_role_in`, `set_updated_at`.
- Produces: table `public.household_subscriptions`; RPC `public.set_household_plan(_household_id uuid, _plan_code text)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260812000009_entitlements.sql`:

```sql
-- ============================================================================
-- Phase 6 slice 6a — household entitlements (subscription state)
-- ============================================================================
-- One row per household; NO ROW = free plan. Owner-only writes; all members read.
-- 6a grants plans manually via set_household_plan (source='manual'); 6b billing
-- writes the SAME row with source apple/google/stripe from a webhook Edge Function.
-- ============================================================================

create table if not exists public.household_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null unique references public.households (id) on delete cascade,
  plan_code          text not null default 'free' check (plan_code in ('free','premium')),
  status             text not null default 'active' check (status in ('active','canceled','expired')),
  source             text not null default 'manual' check (source in ('manual','apple','google','stripe')),
  current_period_end timestamptz,
  updated_by         uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_household_subscriptions_updated_at on public.household_subscriptions;
create trigger trg_household_subscriptions_updated_at
  before update on public.household_subscriptions
  for each row execute function public.set_updated_at();

-- Owner-only manual grant (upsert). 6b writers use the service role instead.
create or replace function public.set_household_plan(_household_id uuid, _plan_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
begin
  if _plan_code not in ('free','premium') then
    raise exception 'invalid plan';
  end if;
  if not public.has_role_in(_household_id, array['owner']::public.household_role[]) then
    raise exception 'only the owner can change the plan';
  end if;
  insert into public.household_subscriptions (household_id, plan_code, status, source, current_period_end, updated_by)
  values (_household_id, _plan_code, 'active', 'manual', null, _uid)
  on conflict (household_id) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        source = 'manual',
        current_period_end = null,
        updated_by = _uid;
end;
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.household_subscriptions enable row level security;

drop policy if exists household_subscriptions_select on public.household_subscriptions;
create policy household_subscriptions_select on public.household_subscriptions
  for select using (public.is_member_of(household_id));

drop policy if exists household_subscriptions_insert on public.household_subscriptions;
create policy household_subscriptions_insert on public.household_subscriptions
  for insert with check (public.has_role_in(household_id, array['owner']::public.household_role[]));

drop policy if exists household_subscriptions_update on public.household_subscriptions;
create policy household_subscriptions_update on public.household_subscriptions
  for update using (public.has_role_in(household_id, array['owner']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner']::public.household_role[]));

drop policy if exists household_subscriptions_delete on public.household_subscriptions;
create policy household_subscriptions_delete on public.household_subscriptions
  for delete using (public.has_role_in(household_id, array['owner']::public.household_role[]));

grant select, insert, update, delete on public.household_subscriptions to authenticated;
```

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor, run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select table_name from information_schema.tables where table_schema='public' and table_name='household_subscriptions';
select proname from pg_proc where proname='set_household_plan';
```
Expected: 1 table, 1 function.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000009_entitlements.sql
git commit -m "feat(billing): 6a schema — household_subscriptions + owner RLS + set_household_plan RPC"
```

---

### Task 2: TypeScript type

**Files:**
- Modify: `lib/database.types.ts` (append after the Phase 5 coupon type)

**Interfaces:**
- Produces: `HouseholdSubscriptionRow`.

- [ ] **Step 1: Append the type**

At the end of `lib/database.types.ts`:

```typescript
// --- Phase 6 (6a): entitlements --------------------------------------------
export interface HouseholdSubscriptionRow {
  id: string;
  household_id: string;
  plan_code: 'free' | 'premium';
  status: 'active' | 'canceled' | 'expired';
  source: 'manual' | 'apple' | 'google' | 'stripe';
  current_period_end: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(billing): add HouseholdSubscriptionRow type"
```

---

### Task 3: Pure plan logic (TDD)

**Files:**
- Create: `features/billing/plans.ts`
- Test: `tests/billing/plans.test.ts`

**Interfaces:**
- Produces:
  - `type PlanCode = 'free' | 'premium'`
  - `type Capability = 'multi_currency_dashboard' | 'retail_comparison' | 'coupons' | 'multiple_households' | 'unlimited_goals'`
  - `PLAN_CAPABILITIES: Record<PlanCode, Capability[]>`
  - `planIncludes(plan: PlanCode, cap: Capability): boolean`
  - `resolvePlan(sub: { plan_code: PlanCode; status: string; current_period_end: string | null } | null, nowMs: number): PlanCode`

- [ ] **Step 1: Write the failing tests**

Create `tests/billing/plans.test.ts`:

```typescript
import { PLAN_CAPABILITIES, planIncludes, resolvePlan } from '@/features/billing/plans';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

describe('planIncludes', () => {
  it('premium includes retail_comparison; free does not', () => {
    expect(planIncludes('premium', 'retail_comparison')).toBe(true);
    expect(planIncludes('free', 'retail_comparison')).toBe(false);
  });
  it('free grants no capabilities', () => {
    expect(PLAN_CAPABILITIES.free).toEqual([]);
  });
});

describe('resolvePlan', () => {
  it('treats no subscription as free', () => {
    expect(resolvePlan(null, now)).toBe('free');
  });
  it('treats a canceled subscription as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'canceled', current_period_end: null }, now)).toBe('free');
  });
  it('treats an expired premium as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now - DAY) }, now)).toBe('free');
  });
  it('honors an active premium with no expiry', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: null }, now)).toBe('premium');
  });
  it('honors an active premium not yet expired', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now + DAY) }, now)).toBe('premium');
  });
  it('returns free for an active free plan', () => {
    expect(resolvePlan({ plan_code: 'free', status: 'active', current_period_end: null }, now)).toBe('free');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/billing/plans.test.ts`
Expected: FAIL — cannot find module `@/features/billing/plans`.

- [ ] **Step 3: Write the implementation**

Create `features/billing/plans.ts`:

```typescript
/**
 * Plan definitions + resolution (pure). The plan->capabilities map is the single
 * place gates are assigned. `resolvePlan` turns a subscription row (from any
 * source: manual now, apple/google/stripe later) into the effective plan.
 */

export type PlanCode = 'free' | 'premium';

export type Capability =
  | 'multi_currency_dashboard'
  | 'retail_comparison'
  | 'coupons'
  | 'multiple_households'
  | 'unlimited_goals';

const ALL_CAPABILITIES: Capability[] = [
  'multi_currency_dashboard',
  'retail_comparison',
  'coupons',
  'multiple_households',
  'unlimited_goals',
];

export const PLAN_CAPABILITIES: Record<PlanCode, Capability[]> = {
  free: [],
  premium: ALL_CAPABILITIES,
};

export function planIncludes(plan: PlanCode, cap: Capability): boolean {
  return PLAN_CAPABILITIES[plan].includes(cap);
}

interface SubscriptionLike {
  plan_code: PlanCode;
  status: string;
  current_period_end: string | null;
}

/** Effective plan for a subscription row (or null). Missing/expired/canceled = free. */
export function resolvePlan(sub: SubscriptionLike | null, nowMs: number): PlanCode {
  if (!sub) return 'free';
  if (sub.status !== 'active') return 'free';
  if (sub.current_period_end != null && new Date(sub.current_period_end).getTime() < nowMs) {
    return 'free';
  }
  return sub.plan_code;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/billing/plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/billing/plans.ts tests/billing/plans.test.ts
git commit -m "feat(billing): pure plan/capability resolver + tests"
```

---

### Task 4: Billing data access

**Files:**
- Create: `features/billing/api.ts`

**Interfaces:**
- Consumes: `getSupabase`, `AppError`, `HouseholdSubscriptionRow`, `PlanCode`.
- Produces:
  - `getHouseholdSubscription(householdId: string): Promise<HouseholdSubscriptionRow | null>`
  - `setHouseholdPlan(householdId: string, planCode: PlanCode): Promise<void>`

- [ ] **Step 1: Write the module**

Create `features/billing/api.ts`:

```typescript
/**
 * Entitlement data access. Reads the household subscription (RLS: members read);
 * setHouseholdPlan calls the owner-checked RPC (6a manual grant). 6b billing
 * writes the same row server-side.
 */

import type { HouseholdSubscriptionRow } from '@/lib/database.types';
import type { PlanCode } from '@/features/billing/plans';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getHouseholdSubscription(
  householdId: string,
): Promise<HouseholdSubscriptionRow | null> {
  const { data, error } = await getSupabase()
    .from('household_subscriptions')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) fail('billing.errors.loadFailed', error);
  return (data ?? null) as HouseholdSubscriptionRow | null;
}

export async function setHouseholdPlan(householdId: string, planCode: PlanCode): Promise<void> {
  const { error } = await getSupabase().rpc('set_household_plan', {
    _household_id: householdId,
    _plan_code: planCode,
  });
  if (error) fail('billing.errors.saveFailed', error);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/billing/api.ts
git commit -m "feat(billing): data access (get subscription, set plan RPC)"
```

---

### Task 5: EntitlementsProvider + mount

**Files:**
- Create: `features/billing/EntitlementsProvider.tsx`
- Modify: `app/_layout.tsx` (wrap with the provider)

**Interfaces:**
- Consumes: `useActiveHousehold`, `getHouseholdSubscription`, `resolvePlan`, `planIncludes`, `PlanCode`, `Capability`.
- Produces: `EntitlementsProvider`, `usePlan(): { plan: PlanCode; has: (c: Capability) => boolean; loading: boolean; refresh: () => void }`.

- [ ] **Step 1: Create the provider**

Create `features/billing/EntitlementsProvider.tsx`:

```typescript
/**
 * Resolves the active household's plan into capabilities for gating. Reloads when
 * the active household changes; `refresh()` re-reads after a plan change.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getHouseholdSubscription } from '@/features/billing/api';
import type { Capability, PlanCode } from '@/features/billing/plans';
import { planIncludes, resolvePlan } from '@/features/billing/plans';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

interface EntitlementsValue {
  plan: PlanCode;
  has: (c: Capability) => boolean;
  loading: boolean;
  refresh: () => void;
}

const EntitlementsContext = createContext<EntitlementsValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { active } = useActiveHousehold();
  const [plan, setPlan] = useState<PlanCode>('free');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!active) {
      setPlan('free');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await getHouseholdSubscription(active.id);
      setPlan(resolvePlan(sub, Date.now()));
    } catch {
      setPlan('free'); // fail closed
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<EntitlementsValue>(
    () => ({ plan, has: (c) => planIncludes(plan, c), loading, refresh: () => void load() }),
    [plan, loading, load],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function usePlan(): EntitlementsValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('usePlan must be used within <EntitlementsProvider>');
  return ctx;
}
```

- [ ] **Step 2: Mount the provider in the root layout**

In `app/_layout.tsx`, add the import:

```typescript
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
```

and wrap `RootNavigator` inside `ActiveHouseholdProvider`:

```typescript
      <AuthProvider>
        <ActiveHouseholdProvider>
          <EntitlementsProvider>
            <RootNavigator />
          </EntitlementsProvider>
        </ActiveHouseholdProvider>
      </AuthProvider>
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add features/billing/EntitlementsProvider.tsx app/_layout.tsx
git commit -m "feat(billing): EntitlementsProvider + usePlan, mounted in root layout"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`

**Interfaces:**
- Produces: a `billing` namespace with matching key sets.

- [ ] **Step 1: Add the `billing` block to `locales/en.json` (after `coupons`, before `errors`)**

```json
"billing": {
  "title": "Subscription",
  "open": "Subscription",
  "currentPlan": "Current plan",
  "planFree": "Free",
  "planPremium": "Premium",
  "capabilities": "Premium includes",
  "capMultiCurrency": "Multi-currency dashboard",
  "capRetailComparison": "Price comparison",
  "capCoupons": "Coupons",
  "capMultipleHouseholds": "Multiple households",
  "capUnlimitedGoals": "Unlimited savings goals",
  "manageOwnerOnly": "Only the household owner can change the plan.",
  "placeholderNote": "Manual switch for testing — real billing arrives with in-app purchases.",
  "switchToFree": "Switch to Free",
  "switchToPremium": "Switch to Premium",
  "lockedTitle": "Premium feature",
  "lockedBody": "This is included with Premium.",
  "manageCta": "Manage subscription",
  "errors": {
    "loadFailed": "Couldn't load the subscription.",
    "saveFailed": "Couldn't change the plan."
  }
}
```

- [ ] **Step 2: Add the same block to `locales/fil.json`**

```json
"billing": {
  "title": "Subscription",
  "open": "Subscription",
  "currentPlan": "Kasalukuyang plano",
  "planFree": "Libre",
  "planPremium": "Premium",
  "capabilities": "Kasama sa Premium",
  "capMultiCurrency": "Multi-currency na dashboard",
  "capRetailComparison": "Paghahambing ng presyo",
  "capCoupons": "Mga kupon",
  "capMultipleHouseholds": "Maraming sambahayan",
  "capUnlimitedGoals": "Walang limitasyong savings goals",
  "manageOwnerOnly": "Ang may-ari lang ng sambahayan ang makakapagpalit ng plano.",
  "placeholderNote": "Manual na pagpalit para sa pagsubok — darating ang tunay na billing kasama ng in-app purchases.",
  "switchToFree": "Lumipat sa Libre",
  "switchToPremium": "Lumipat sa Premium",
  "lockedTitle": "Premium na feature",
  "lockedBody": "Kasama ito sa Premium.",
  "manageCta": "Pamahalaan ang subscription",
  "errors": {
    "loadFailed": "Hindi ma-load ang subscription.",
    "saveFailed": "Hindi mapalitan ang plano."
  }
}
```

- [ ] **Step 3: Add the same block to `locales/ar.json`**

```json
"billing": {
  "title": "الاشتراك",
  "open": "الاشتراك",
  "currentPlan": "الخطة الحالية",
  "planFree": "مجاني",
  "planPremium": "مميّز",
  "capabilities": "يشمل المميّز",
  "capMultiCurrency": "لوحة متعددة العملات",
  "capRetailComparison": "مقارنة الأسعار",
  "capCoupons": "الكوبونات",
  "capMultipleHouseholds": "أسر متعددة",
  "capUnlimitedGoals": "أهداف ادخار غير محدودة",
  "manageOwnerOnly": "يمكن لمالك الأسرة فقط تغيير الخطة.",
  "placeholderNote": "تبديل يدوي للاختبار — تصل الفوترة الحقيقية مع الشراء داخل التطبيق.",
  "switchToFree": "التبديل إلى المجاني",
  "switchToPremium": "التبديل إلى المميّز",
  "lockedTitle": "ميزة مميّزة",
  "lockedBody": "هذه الميزة مضمّنة في المميّز.",
  "manageCta": "إدارة الاشتراك",
  "errors": {
    "loadFailed": "تعذّر تحميل الاشتراك.",
    "saveFailed": "تعذّر تغيير الخطة."
  }
}
```

- [ ] **Step 4: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(billing): i18n strings for en, fil, ar"
```

---

### Task 7: Subscription screen + More link + route

**Files:**
- Create: `app/subscription.tsx`
- Modify: `app/(tabs)/more.tsx` (add link)
- Modify: `app/_layout.tsx` (add a `Stack.Screen` for the title)

**Interfaces:**
- Consumes: `usePlan`; `getHouseholdSubscription`, `setHouseholdPlan` (billing api); `PLAN_CAPABILITIES`; `useActiveHousehold`; `useAuth`.

- [ ] **Step 1: Create the subscription screen**

Create `app/subscription.tsx`:

```typescript
/** Subscription: current plan + premium capabilities. Owner sees a manual
 *  plan toggle (pre-billing placeholder; 6b replaces it with real purchases). */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { setHouseholdPlan } from '@/features/billing/api';
import { PLAN_CAPABILITIES } from '@/features/billing/plans';
import type { Capability } from '@/features/billing/plans';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

const CAP_LABEL: Record<Capability, string> = {
  multi_currency_dashboard: 'billing.capMultiCurrency',
  retail_comparison: 'billing.capRetailComparison',
  coupons: 'billing.capCoupons',
  multiple_households: 'billing.capMultipleHouseholds',
  unlimited_goals: 'billing.capUnlimitedGoals',
};

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { plan, refresh } = usePlan();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const isOwner = Boolean(active && user && active.created_by === user.id);

  async function switchTo(next: 'free' | 'premium') {
    if (!active) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await setHouseholdPlan(active.id, next);
      refresh();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.card}>
          <Text variant="caption" muted>{t('billing.currentPlan')}</Text>
          <Text variant="heading">
            {plan === 'premium' ? t('billing.planPremium') : t('billing.planFree')}
          </Text>
        </View>

        <Text variant="heading">{t('billing.capabilities')}</Text>
        <View style={styles.list}>
          {PLAN_CAPABILITIES.premium.map((c) => (
            <Text key={c} muted>• {t(CAP_LABEL[c])}</Text>
          ))}
        </View>

        <View style={styles.divider} />

        {isOwner ? (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('billing.placeholderNote')}</Text>
            {plan === 'premium' ? (
              <Button label={t('billing.switchToFree')} variant="secondary" onPress={() => switchTo('free')} loading={busy} />
            ) : (
              <Button label={t('billing.switchToPremium')} onPress={() => switchTo('premium')} loading={busy} />
            )}
          </View>
        ) : (
          <Text muted>{t('billing.manageOwnerOnly')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
});
```

- [ ] **Step 2: Link from the More tab**

In `app/(tabs)/more.tsx`, add after the retail link:

```typescript
      <Link href="/subscription" style={styles.link}>
        <Text style={{ color: palette.brand }}>{t('billing.open')}</Text>
      </Link>
```

- [ ] **Step 3: Register the route title**

In `app/_layout.tsx`, add to the `<Stack>` in `RootNavigator` (after the `signup` screen):

```typescript
      <Stack.Screen name="subscription" options={{ title: t('billing.title') }} />
```

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/subscription.tsx "app/(tabs)/more.tsx" app/_layout.tsx
git commit -m "feat(billing): subscription screen (owner manual toggle) + More link + route"
```

---

### Task 8: Gate two premium features

**Files:**
- Modify: `app/grocery/compare/[id].tsx` (gate on `retail_comparison`)
- Modify: `app/retail/coupons.tsx` (gate on `coupons`)

**Interfaces:**
- Consumes: `usePlan` (from EntitlementsProvider); `useRouter` (expo-router).

- [ ] **Step 1: Gate the comparison screen**

In `app/grocery/compare/[id].tsx`:

Add imports:

```typescript
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
```

(Note: `Button` may already be imported via `@/components/ui` — if the existing
import is `import { Text } from '@/components/ui';`, change it to
`import { Button, Text } from '@/components/ui';` instead of adding a second line.)

In the component, after `const { active } = useActiveHousehold();`, add:

```typescript
  const { has } = usePlan();
  const router = useRouter();
```

Immediately after the `if (loading) { ... }` early-return block, add a gate:

```typescript
  if (!has('retail_comparison')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 2: Gate the coupons screen**

In `app/retail/coupons.tsx`:

Add imports (merge `Button` into the existing `@/components/ui` import if present):

```typescript
import { useRouter } from 'expo-router';
import { usePlan } from '@/features/billing/EntitlementsProvider';
```

`useFocusEffect` is already imported from `expo-router`; add `useRouter` to that
existing import line instead of a duplicate: `import { useFocusEffect, useRouter } from 'expo-router';`

In the component, after `const { active } = useActiveHousehold();`, add:

```typescript
  const { has } = usePlan();
  const router = useRouter();
```

Immediately before the main `return (`, add a gate (the coupons screen has no
`loading` early-return, so place it right before `return`):

```typescript
  if (!has('coupons')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

(`Button`, `Text`, `SafeAreaView`, `View`, and the `styles.safe/content/card` are
already imported/defined in `coupons.tsx`.)

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/grocery/compare/[id].tsx" "app/retail/coupons.tsx"
git commit -m "feat(billing): gate price comparison + coupons behind premium capabilities"
```

---

### Task 9: Extend RLS integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `idB`).

- [ ] **Step 1: Add owner-set + non-member assertions (after the coupons setup block, before "B cannot read A's household")**

```javascript
  // --- entitlements: owner A sets the household plan; non-owners cannot -------
  const { error: planErr } = await a.rpc('set_household_plan', { _household_id: hid, _plan_code: 'premium' });
  ok('owner A can set the household to premium', !planErr);
  const { data: sub } = await a
    .from('household_subscriptions').select('plan_code, source').eq('household_id', hid).single();
  ok('subscription reads back as premium/manual', sub?.plan_code === 'premium' && sub?.source === 'manual');
```

- [ ] **Step 2: Add B-cannot assertions (in the "B cannot read A" section)**

```javascript
  // B CANNOT read or change A's subscription (not a member yet).
  const { data: bSub } = await b.from('household_subscriptions').select('id').eq('household_id', hid);
  ok("B cannot read A's subscription (RLS)", (bSub ?? []).length === 0);
  const { error: bPlanErr } = await b.rpc('set_household_plan', { _household_id: hid, _plan_code: 'premium' });
  ok("B cannot set A's plan via RPC", Boolean(bPlanErr));
```

- [ ] **Step 3: Add post-join member assertions (after "B can read coupons after joining")**

```javascript
  const { data: bSubAfter } = await b.from('household_subscriptions').select('plan_code').eq('household_id', hid);
  ok('B can read the plan after joining', (bSubAfter ?? []).length === 1);
  // B is a 'member', not owner → still cannot change the plan.
  const { error: bMemberPlanErr } = await b.rpc('set_household_plan', { _household_id: hid, _plan_code: 'free' });
  ok('member B still cannot change the plan', Boolean(bMemberPlanErr));
```

- [ ] **Step 4: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass. Remove the key after.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(billing): entitlement RLS — owner sets plan, members/non-members cannot"
```

---

### Task 10: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; unit suites pass (incl. `tests/billing/plans.test.ts`); RLS suite passes incl. entitlement assertions.

- [ ] **Step 2: Manual smoke (optional)**

More → Subscription → (as owner) Switch to Premium → open a grocery list → Compare
prices works; More → Retail → Coupons works. Switch to Free → both show the
"Premium feature → Manage subscription" locked card.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- household_subscriptions (unique per hh, plan/status/source/period, no-row=free) → Task 1 ✓; type Task 2 ✓
- owner-only RLS + set_household_plan RPC → Task 1 + Task 9 ✓
- capability flags + resolvePlan → Task 3 ✓
- billing data access → Task 4 ✓
- EntitlementsProvider / usePlan, mounted → Task 5 ✓
- subscription screen (owner manual toggle, placeholder note) → Task 7 ✓
- gates on price comparison + coupons → Task 8 ✓
- i18n → Task 6 ✓
- RLS isolation (owner sets, member/non-member cannot) → Task 9 ✓
- 6b deferred → ADR already written ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete. Task 8 gives explicit
import-merge guidance so no duplicate imports are introduced.

**Type consistency:** `PlanCode`/`Capability` (Task 3) used in Tasks 4/5/7/8.
`HouseholdSubscriptionRow` (Task 2) used in Task 4. `usePlan()` shape (Task 5:
`{ plan, has, loading, refresh }`) consumed in Tasks 7/8. `setHouseholdPlan(hid, planCode)`
(Task 4) called in Task 7. RPC name `set_household_plan` consistent across Tasks 1/4/9.
Owner check uses `active.created_by === user.id` (the create_household RPC makes the
creator the owner); the RPC is the authoritative server-side guard.


## plan 2026-08-12-phase7-globalization

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


## plan 2026-08-13-account-deletion-export

# Account Deletion & Data Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-service GDPR-style data export (full household JSON) and account deletion (blocking owner-handoff rule) per `#spec-2026-08-13-account-deletion-export-design`.

**Architecture:** One hand-applied SQL migration (FK re-pointing + `delete_my_account()` security-definer RPC); pure export shaper + IO reader loop in `features/account/`; one new `app/account.tsx` screen reached from the More tab.

**Tech Stack:** Expo / React Native, Supabase (RLS + RPC), jest.

## Global Constraints

- Money stays integer minor units; export copies rows verbatim — no float math.
- All copy through `t('…')`; keys added to `locales/{en,fil,ar}.json` together.
- Screens never call `getSupabase()` — only `features/*/api*.ts`.
- Migration is applied BY THE HUMAN in the Supabase SQL editor; never claim it ran.
- `lib/database.types.ts` updated by hand in the same task as the migration.
- Gates after every task: `npx tsc --noEmit`; full gates at the end.

---

### Task 1: Migration + database.types sync

**Files:**
- Create: `supabase/migrations/20260813000010_account_deletion.sql`
- Modify: `lib/database.types.ts` (affected `created_by`-style Row fields → `string | null`)

**Interfaces:**
- Produces: RPC `public.delete_my_account()` (no args, void; raises message `owner_handoff_required` when blocked). Consumed by Task 3's `deleteMyAccount()`.

- [ ] **Step 1: Write the migration** — full content:

```sql
-- Account deletion (Phase 8 QA item 3). Two parts:
--   1. Re-point user-attribution FKs so shared history survives a member's
--      departure (attribution nulls out) instead of blocking auth-row deletion.
--   2. delete_my_account(): self-service deletion with a blocking
--      owner-handoff rule. Owned by postgres (SQL editor), which may delete
--      from auth.users — the documented Supabase self-deletion pattern.

-- 1) created_by-style columns: nullable + on delete set null ------------------

do $$
declare
  col record;
begin
  for col in
    select * from (values
      ('households',        'created_by'),
      ('accounts',          'created_by'),
      ('transactions',      'created_by'),
      ('fx_rate_snapshots', 'created_by'),
      ('budgets',           'created_by'),
      ('savings_goals',     'created_by'),
      ('goal_contributions','created_by'),
      ('debts',             'created_by'),
      ('debt_payments',     'created_by'),
      ('grocery_lists',     'created_by'),
      ('grocery_items',     'added_by'),
      ('grocery_items',     'purchased_by'),
      ('retailers',         'created_by'),
      ('retailer_stores',   'created_by'),
      ('products',          'created_by'),
      ('retailer_products', 'created_by'),
      ('price_snapshots',   'created_by'),
      ('saved_locations',   'created_by'),
      ('coupons',           'created_by'),
      ('household_subscriptions', 'updated_by')
    ) as t(tbl, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', col.tbl, col.col);
    execute format(
      'alter table public.%I drop constraint if exists %I',
      col.tbl, col.tbl || '_' || col.col || '_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      col.tbl, col.tbl || '_' || col.col || '_fkey', col.col);
  end loop;
end $$;

-- Pending invitations die with the inviter.
alter table public.household_invitations
  drop constraint if exists household_invitations_invited_by_fkey;
alter table public.household_invitations
  add constraint household_invitations_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete cascade;

-- 2) Self-service account deletion -------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'unauthorized';
  end if;

  -- Block: the caller owns a household that other members still use.
  if exists (
    select 1
    from public.household_members om
    where om.user_id = _uid
      and om.role = 'owner'
      and exists (
        select 1 from public.household_members m
        where m.household_id = om.household_id
          and m.user_id <> _uid
      )
  ) then
    raise exception 'owner_handoff_required';
  end if;

  -- Households where the caller is the only member: delete (cascades wipe data).
  delete from public.households h
  where exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id = _uid)
    and not exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id <> _uid);

  -- Remaining references: memberships cascade, invitations cascade,
  -- content attribution nulls out via the FKs above.
  delete from auth.users where id = _uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

- [ ] **Step 2: Sync `lib/database.types.ts`** — for each Row type of the 20 columns above, change `created_by: string` (etc.) to `created_by: string | null`. Leave Insert types unchanged.
- [ ] **Step 3: `npx tsc --noEmit`** — fix any code assuming non-null attribution (expected: grocery display already null-safe).
- [ ] **Step 4: Commit** — `feat(account): migration for FK set-null + delete_my_account RPC (unapplied)`

### Task 2: Pure export shaper + tests (TDD)

**Files:**
- Create: `features/account/export.ts`, Test: `tests/account/export.test.ts`

**Interfaces:**
- Produces:
  - `interface HouseholdExportBundle { household: HouseholdRow; members: …; accounts: AccountRow[]; balances: AccountBalanceRow[]; categories: CategoryRow[]; transactions: TransactionWithRefs[]; fxRates: LatestFxRateRow[]; budgets: BudgetRow[]; budgetStatus: BudgetStatusRow[]; goals: …[]; goalStatus: …[]; debts: …[]; debtStatus: …[]; grocery: { lists: GroceryListRow[]; items: Record<listId, items[]> }; retail: { retailers; stores; products; retailerProducts?; prices }; coupons }`
  - `interface AccountExport { exportedAt: string; user: { id: string; email: string | null }; households: HouseholdExportBundle[] }`
  - `buildExport(user, bundles, exportedAt): AccountExport` (pure: sorts households by name, stamps fields, no mutation)
  - `exportFilename(exportedAt: string): string` → `household-export-<YYYYMMDD-HHMMSS>.json` derived only from the ISO string (no Date.now inside).

- [ ] Write failing tests: filename shape from a fixed ISO string; buildExport stamps user/exportedAt; households sorted by name; empty bundle list yields `households: []`.
- [ ] Run: `npx jest tests/account/export.test.ts` → FAIL (module missing).
- [ ] Implement; run again → PASS. Commit `feat(account): pure export shaper`.

### Task 3: Account IO — exportApi, saveExport, deleteMyAccount

**Files:**
- Create: `features/account/exportApi.ts`, `features/account/saveExport.ts`, `features/account/api.ts`

**Interfaces:**
- Consumes existing readers: `listMyHouseholds, listMembers` (household), `listAccounts, listAccountBalances, listCategories, listTransactions(id, 10000)` (finance), `listLatestRates`, `listBudgets, listBudgetStatus, listGoals, listGoalStatus, listDebts, listDebtStatus` (planning), `listLists, listItems` (grocery), `listRetailers, listStores, listProducts, listPricesForProduct, listSavedLocations` (retail), `listCoupons` (couponApi), plus Task 2's `buildExport`.
- Produces: `assembleExport(userId, email): Promise<AccountExport>`; `saveExport(json: string, filename: string): Promise<void>` (web: Blob+anchor; native: expo-file-system cache + expo-sharing — `npx expo install expo-sharing` if missing); `deleteMyAccount(): Promise<void>` mapping `owner_handoff_required` → `AppError('forbidden', { messageKey: 'account.errors.ownerHandoff' })`, other errors → `account.errors.deleteFailed`.

- [ ] Implement all three modules; `npx tsc --noEmit`; commit `feat(account): export assembly + save + delete RPC client`.

### Task 4: i18n keys (en/fil/ar together)

**Files:** Modify all three `locales/*.json` — new `account` block: `title, open, exportTitle, exportBody, exportCta, deleteTitle, deleteWarning, typeEmailLabel, deleteCta, confirmTitle, confirmBody, errors.ownerHandoff, errors.deleteFailed, errors.exportFailed`.

- [ ] Add keys; run `npx jest tests/lib/i18n.test.ts` → PASS (parity). Commit `feat(i18n): account screen keys`.

### Task 5: Account screen + navigation

**Files:**
- Create: `app/account.tsx`
- Modify: `app/_layout.tsx` (add `<Stack.Screen name="account" options={{ title: t('account.title') }} />` after `subscription`), `app/(tabs)/more.tsx` (ListRow icon `user` → `/account`, above sign-out).

**Behavior:** Export Card (`exportTitle`/`exportBody`, secondary Button `exportCta`, busy state, failure → `ErrorNotice` retry). Danger-zone Card (`deleteTitle` heading, `deleteWarning` muted, TextField `typeEmailLabel`; destructive-styled Button `deleteCta` disabled until input equals user email case-insensitively; press → `useActionSheet` confirm (`confirmTitle`/`confirmBody`, destructive action) → `deleteMyAccount()` → `signOut()`; `ownerHandoff` error → inline `ErrorNotice` without retry). Uses `Screen`-less SafeAreaView with `edges={['left','right','bottom']}` (native header on).

- [ ] Implement; `npx tsc --noEmit`; manual web smoke via preview. Commit `feat(account): account screen — export + guarded deletion`.

### Task 6: Live RLS drill extension

**Files:** Modify `tests/integration/rls-isolation.mjs`.

- [ ] Append scenarios (service client creates users D1/D2): D1 owns household with member D2 → D1 `rpc('delete_my_account')` → expect error containing `owner_handoff_required`; remove D2's membership → RPC succeeds → assert `auth.admin.getUserById(D1)` gone and household query (service role) returns no rows; separate shared household where D1 was a member: D1's transaction row survives with `created_by null`; anon client RPC → error. Update the suite's expected count.
- [ ] Commit `test(rls): account deletion drill`. (Runs only when the human does the key drill.)

### Task 7: Final gates

- [ ] `npx tsc --noEmit`, `npm test`, `npm run lint`, `npx expo export --platform web` all green; update Phase 8 spec status + memory; final commit.

## Self-review

Spec coverage: 1a/1b→Task 1, export→Tasks 2–3, UI→Task 5, i18n→Task 4, testing→Tasks 2/6/7. Type names match `lib/database.types.ts` usage in existing api modules. No placeholders in the SQL (the one authoritative artifact); TS interfaces named exactly as consumed.

