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
