-- ============================================================================
-- Phase 3 (slice 3b) — Budgets, Savings Goals, Debts
-- ============================================================================
-- Header + line-item tables for each domain, household-scoped, writer-vs-viewer
-- RLS (reusing is_member_of / has_role_in). Child rows are validated against
-- their parent's household by trigger. Status views (security_invoker) compute
-- spent/saved/owed. All money is integer minor units.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared helper: validate a child row's household matches its parent's.
-- (Per table because the parent lookup differs.)
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- BUDGETS
-- ===========================================================================
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  period_start  date not null,
  period_end    date not null,
  is_archived   boolean not null default false,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_budget_period check (period_end >= period_start)
);
create index if not exists idx_budgets_household on public.budgets (household_id);

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

create table if not exists public.budget_allocations (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid not null references public.budgets (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  limit_minor  bigint not null check (limit_minor >= 0),
  created_at   timestamptz not null default now(),
  unique (budget_id, category_id)
);
create index if not exists idx_budget_alloc_budget on public.budget_allocations (budget_id);

create or replace function public.budget_allocations_enforce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _bh uuid;
  _ch uuid;
begin
  select household_id into _bh from public.budgets where id = new.budget_id;
  if _bh is null then
    raise exception 'budget not found';
  end if;
  if _bh <> new.household_id then
    raise exception 'budget does not belong to the given household';
  end if;
  if new.category_id is not null then
    select household_id into _ch from public.categories where id = new.category_id;
    if _ch is distinct from new.household_id then
      raise exception 'category does not belong to the given household';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_budget_alloc_enforce on public.budget_allocations;
create trigger trg_budget_alloc_enforce
  before insert or update on public.budget_allocations
  for each row execute function public.budget_allocations_enforce();

-- Spent = same-currency expenses in the allocation's category within the period.
create or replace view public.budget_status
with (security_invoker = true) as
  select
    al.id            as allocation_id,
    al.budget_id     as budget_id,
    b.household_id   as household_id,
    al.category_id   as category_id,
    b.currency_code  as currency_code,
    al.limit_minor   as limit_minor,
    coalesce((
      select sum(t.amount_minor)
      from public.transactions t
      where t.household_id = b.household_id
        and t.type = 'expense'
        and t.currency_code = b.currency_code
        and t.category_id is not distinct from al.category_id
        and t.occurred_at::date between b.period_start and b.period_end
    ), 0)            as spent_minor
  from public.budget_allocations al
  join public.budgets b on b.id = al.budget_id;

-- ===========================================================================
-- SAVINGS GOALS
-- ===========================================================================
create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  target_minor  bigint not null check (target_minor >= 0),
  target_date   date,
  is_archived   boolean not null default false,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_goals_household on public.savings_goals (household_id);

drop trigger if exists trg_goals_updated_at on public.savings_goals;
create trigger trg_goals_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

create table if not exists public.goal_contributions (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.savings_goals (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  amount_minor bigint not null check (amount_minor >= 0),
  occurred_at  timestamptz not null default now(),
  note         text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_goal_contrib_goal on public.goal_contributions (goal_id);

create or replace function public.goal_contributions_enforce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _gh uuid;
begin
  select household_id into _gh from public.savings_goals where id = new.goal_id;
  if _gh is null then
    raise exception 'savings goal not found';
  end if;
  if _gh <> new.household_id then
    raise exception 'goal does not belong to the given household';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_goal_contrib_enforce on public.goal_contributions;
create trigger trg_goal_contrib_enforce
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_enforce();

create or replace view public.savings_goal_status
with (security_invoker = true) as
  select
    g.id           as goal_id,
    g.household_id as household_id,
    g.currency_code as currency_code,
    g.target_minor as target_minor,
    coalesce(sum(c.amount_minor), 0) as saved_minor
  from public.savings_goals g
  left join public.goal_contributions c on c.goal_id = g.id
  group by g.id;

-- ===========================================================================
-- DEBTS
-- ===========================================================================
create table if not exists public.debts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  currency_code   text not null check (currency_code ~ '^[A-Z]{3}$'),
  principal_minor bigint not null check (principal_minor >= 0),
  apr             numeric,
  due_day         smallint check (due_day between 1 and 31),
  is_archived     boolean not null default false,
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_debts_household on public.debts (household_id);

drop trigger if exists trg_debts_updated_at on public.debts;
create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

create table if not exists public.debt_payments (
  id           uuid primary key default gen_random_uuid(),
  debt_id      uuid not null references public.debts (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  amount_minor bigint not null check (amount_minor >= 0),
  occurred_at  timestamptz not null default now(),
  note         text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_debt_pay_debt on public.debt_payments (debt_id);

create or replace function public.debt_payments_enforce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _dh uuid;
begin
  select household_id into _dh from public.debts where id = new.debt_id;
  if _dh is null then
    raise exception 'debt not found';
  end if;
  if _dh <> new.household_id then
    raise exception 'debt does not belong to the given household';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_debt_pay_enforce on public.debt_payments;
create trigger trg_debt_pay_enforce
  before insert or update on public.debt_payments
  for each row execute function public.debt_payments_enforce();

create or replace view public.debt_status
with (security_invoker = true) as
  select
    d.id            as debt_id,
    d.household_id  as household_id,
    d.currency_code as currency_code,
    d.principal_minor as principal_minor,
    coalesce(sum(p.amount_minor), 0) as paid_minor,
    d.principal_minor - coalesce(sum(p.amount_minor), 0) as balance_minor
  from public.debts d
  left join public.debt_payments p on p.debt_id = d.id
  group by d.id;

-- ===========================================================================
-- Row Level Security (writers = owner/admin/member; viewers read-only)
-- ===========================================================================
alter table public.budgets            enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.savings_goals      enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.debts              enable row level security;
alter table public.debt_payments      enable row level security;

-- Reusable policy set via a helper is not possible declaratively, so define per
-- table. Reads: any member. Writes: owner/admin/member. created_by must be self.
do $$
declare
  _t text;
  _writer text := 'public.has_role_in(household_id, array[''owner'',''admin'',''member'']::public.household_role[])';
begin
  foreach _t in array array[
    'budgets','budget_allocations','savings_goals','goal_contributions','debts','debt_payments'
  ] loop
    execute format('drop policy if exists %I_select on public.%I;', _t, _t);
    execute format(
      'create policy %I_select on public.%I for select using (public.is_member_of(household_id));',
      _t, _t);

    execute format('drop policy if exists %I_update on public.%I;', _t, _t);
    execute format(
      'create policy %I_update on public.%I for update using (%s) with check (%s);',
      _t, _t, _writer, _writer);

    execute format('drop policy if exists %I_delete on public.%I;', _t, _t);
    execute format(
      'create policy %I_delete on public.%I for delete using (%s);',
      _t, _t, _writer);
  end loop;
end$$;

-- Insert policies enforce created_by = auth.uid() where the column exists.
drop policy if exists budgets_insert on public.budgets;
create policy budgets_insert on public.budgets for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  and created_by = (select auth.uid()));

drop policy if exists budget_allocations_insert on public.budget_allocations;
create policy budget_allocations_insert on public.budget_allocations for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

drop policy if exists savings_goals_insert on public.savings_goals;
create policy savings_goals_insert on public.savings_goals for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  and created_by = (select auth.uid()));

drop policy if exists goal_contributions_insert on public.goal_contributions;
create policy goal_contributions_insert on public.goal_contributions for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  and created_by = (select auth.uid()));

drop policy if exists debts_insert on public.debts;
create policy debts_insert on public.debts for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  and created_by = (select auth.uid()));

drop policy if exists debt_payments_insert on public.debt_payments;
create policy debt_payments_insert on public.debt_payments for insert with check (
  public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  and created_by = (select auth.uid()));

-- ===========================================================================
-- Grants
-- ===========================================================================
do $$
declare _t text;
begin
  foreach _t in array array[
    'budgets','budget_allocations','savings_goals','goal_contributions','debts','debt_payments'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated;', _t);
    execute format('revoke all on public.%I from anon;', _t);
  end loop;
end$$;

grant select on public.budget_status       to authenticated;
grant select on public.savings_goal_status to authenticated;
grant select on public.debt_status         to authenticated;
revoke all on public.budget_status       from anon;
revoke all on public.savings_goal_status from anon;
revoke all on public.debt_status         from anon;
