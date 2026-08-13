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
