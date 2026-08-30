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
