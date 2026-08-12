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
