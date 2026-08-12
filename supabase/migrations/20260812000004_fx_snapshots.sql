-- ============================================================================
-- Phase 3 (slice 3c) — FX rate snapshots + reporting-currency rollup support
-- ============================================================================
-- Rates are stored as timestamped SNAPSHOTS so historical reports never change
-- when today's rate moves (see 04 spec). `rate` = quote units per 1 base unit,
-- i.e. amount_in_quote = amount_in_base * rate. Household-scoped; manual entry
-- now, an automated rate-provider Edge Function can insert snapshots later with
-- no schema change (just a different `source`).
-- ============================================================================

create table if not exists public.fx_rate_snapshots (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  base_currency  text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate           numeric not null check (rate > 0),
  as_of          timestamptz not null default now(),
  source         text not null default 'manual',
  created_by     uuid not null references auth.users (id),
  created_at     timestamptz not null default now(),
  constraint chk_fx_distinct check (base_currency <> quote_currency)
);
create index if not exists idx_fx_lookup
  on public.fx_rate_snapshots (household_id, base_currency, quote_currency, as_of desc);

-- Most recent rate per (household, base, quote).
create or replace view public.latest_fx_rates
with (security_invoker = true) as
  select distinct on (household_id, base_currency, quote_currency)
    household_id,
    base_currency,
    quote_currency,
    rate,
    as_of,
    source
  from public.fx_rate_snapshots
  order by household_id, base_currency, quote_currency, as_of desc;

-- ===========================================================================
-- RLS (writers = owner/admin/member; viewers read-only)
-- ===========================================================================
alter table public.fx_rate_snapshots enable row level security;

drop policy if exists fx_select on public.fx_rate_snapshots;
create policy fx_select on public.fx_rate_snapshots
  for select using (public.is_member_of(household_id));

drop policy if exists fx_insert on public.fx_rate_snapshots;
create policy fx_insert on public.fx_rate_snapshots
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists fx_update on public.fx_rate_snapshots;
create policy fx_update on public.fx_rate_snapshots
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists fx_delete on public.fx_rate_snapshots;
create policy fx_delete on public.fx_rate_snapshots
  for delete using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

-- ===========================================================================
-- Grants
-- ===========================================================================
grant select, insert, update, delete on public.fx_rate_snapshots to authenticated;
grant select on public.latest_fx_rates to authenticated;
revoke all on public.fx_rate_snapshots from anon;
revoke all on public.latest_fx_rates from anon;
