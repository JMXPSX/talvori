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
