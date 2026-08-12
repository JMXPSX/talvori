-- ============================================================================
-- Phase 3 (slice 3a) — Financial core
-- ============================================================================
-- Tables: accounts, categories, transactions (+ transfers)
-- Money: integer minor units + currency code, NEVER float. amount_minor >= 0;
--        sign comes from `direction`. A transaction's currency is forced to its
--        account's currency by trigger. Balances via the account_balances view.
-- Access: writers = owner/admin/member; viewers are read-only. Reuses the
--         Phase 2 helpers is_member_of() / has_role_in().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('cash', 'bank', 'card', 'wallet', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('income', 'expense', 'transfer');
  end if;
  if not exists (select 1 from pg_type where typname = 'flow_direction') then
    create type public.flow_direction as enum ('in', 'out');
  end if;
  if not exists (select 1 from pg_type where typname = 'category_kind') then
    create type public.category_kind as enum ('income', 'expense');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  type                  public.account_type not null default 'cash',
  currency_code         text not null check (currency_code ~ '^[A-Z]{3}$'),
  opening_balance_minor bigint not null default 0,
  is_archived           boolean not null default false,
  created_by            uuid not null references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_accounts_household on public.accounts (household_id);

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  kind         public.category_kind not null,
  parent_id    uuid references public.categories (id) on delete set null,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_categories_household on public.categories (household_id);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  account_id        uuid not null references public.accounts (id) on delete cascade,
  type              public.transaction_type not null,
  direction         public.flow_direction not null,
  amount_minor      bigint not null check (amount_minor >= 0),
  currency_code     text not null check (currency_code ~ '^[A-Z]{3}$'),
  category_id       uuid references public.categories (id) on delete set null,
  description       text,
  occurred_at       timestamptz not null default now(),
  transfer_group_id uuid,
  fx_rate           numeric,
  created_by        uuid not null references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- income is always 'in', expense always 'out'; transfers may be either leg.
  constraint chk_type_direction check (
    (type = 'income' and direction = 'in')
    or (type = 'expense' and direction = 'out')
    or (type = 'transfer')
  ),
  -- transfers carry a group id; income/expense never do.
  constraint chk_transfer_group check (
    (type = 'transfer' and transfer_group_id is not null)
    or (type <> 'transfer' and transfer_group_id is null)
  )
);
create index if not exists idx_transactions_household on public.transactions (household_id);
create index if not exists idx_transactions_account on public.transactions (account_id);
create index if not exists idx_transactions_group on public.transactions (transfer_group_id);
create index if not exists idx_transactions_occurred on public.transactions (occurred_at);

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- Force currency to the account's, and ensure the account belongs to the
-- claimed household. Prevents mismatched-currency or cross-household writes.
create or replace function public.transactions_enforce_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h   uuid;
  _ccy text;
begin
  select household_id, currency_code into _h, _ccy
  from public.accounts where id = new.account_id;

  if _h is null then
    raise exception 'account not found';
  end if;
  if _h <> new.household_id then
    raise exception 'account does not belong to the given household';
  end if;

  new.currency_code := _ccy; -- currency always follows the account
  return new;
end;
$$;

drop trigger if exists trg_transactions_enforce_account on public.transactions;
create trigger trg_transactions_enforce_account
  before insert or update on public.transactions
  for each row execute function public.transactions_enforce_account();

-- Deleting one leg of a transfer removes its sibling (no orphan legs).
create or replace function public.transactions_delete_transfer_sibling()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.transfer_group_id is not null then
    delete from public.transactions
    where transfer_group_id = old.transfer_group_id and id <> old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_transactions_delete_sibling on public.transactions;
create trigger trg_transactions_delete_sibling
  after delete on public.transactions
  for each row execute function public.transactions_delete_transfer_sibling();

-- ---------------------------------------------------------------------------
-- create_transfer: two balanced legs in one atomic call
-- ---------------------------------------------------------------------------
create or replace function public.create_transfer(
  _from_account uuid,
  _to_account uuid,
  _from_amount_minor bigint,
  _to_amount_minor bigint,
  _description text default null,
  _occurred_at timestamptz default now(),
  _category_id uuid default null,
  _fx_rate numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid     uuid := (select auth.uid());
  _from_h  uuid;
  _from_cc text;
  _to_h    uuid;
  _to_cc   text;
  _group   uuid := gen_random_uuid();
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _from_account = _to_account then
    raise exception 'cannot transfer to the same account';
  end if;
  if _from_amount_minor < 0 or _to_amount_minor < 0 then
    raise exception 'amounts must be non-negative';
  end if;

  select household_id, currency_code into _from_h, _from_cc
  from public.accounts where id = _from_account;
  select household_id, currency_code into _to_h, _to_cc
  from public.accounts where id = _to_account;

  if _from_h is null or _to_h is null then
    raise exception 'account not found';
  end if;
  if _from_h <> _to_h then
    raise exception 'both accounts must be in the same household';
  end if;
  if not public.has_role_in(
       _from_h, array['owner','admin','member']::public.household_role[]) then
    raise exception 'insufficient permission to record a transfer';
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor, currency_code,
    description, occurred_at, transfer_group_id, category_id, created_by)
  values (
    _from_h, _from_account, 'transfer', 'out', _from_amount_minor, _from_cc,
    _description, _occurred_at, _group, _category_id, _uid);

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor, currency_code,
    description, occurred_at, transfer_group_id, fx_rate, created_by)
  values (
    _to_h, _to_account, 'transfer', 'in', _to_amount_minor, _to_cc,
    _description, _occurred_at, _group, _fx_rate, _uid);

  return _group;
end;
$$;

-- ---------------------------------------------------------------------------
-- account_balances view (security_invoker so RLS on base tables applies)
-- ---------------------------------------------------------------------------
create or replace view public.account_balances
with (security_invoker = true) as
  select
    a.id            as account_id,
    a.household_id  as household_id,
    a.currency_code as currency_code,
    a.opening_balance_minor
      + coalesce(sum(t.amount_minor) filter (where t.direction = 'in'), 0)
      - coalesce(sum(t.amount_minor) filter (where t.direction = 'out'), 0)
                    as balance_minor
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  group by a.id;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

-- accounts
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (public.is_member_of(household_id));

drop policy if exists accounts_write_insert on public.accounts;
create policy accounts_write_insert on public.accounts
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists accounts_write_update on public.accounts;
create policy accounts_write_update on public.accounts
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists accounts_write_delete on public.accounts;
create policy accounts_write_delete on public.accounts
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
  );

-- categories
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select using (public.is_member_of(household_id));

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

-- transactions
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (public.is_member_of(household_id));

drop policy if exists transactions_write_insert on public.transactions;
create policy transactions_write_insert on public.transactions
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists transactions_write_update on public.transactions;
create policy transactions_write_update on public.transactions
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists transactions_write_delete on public.transactions;
create policy transactions_write_delete on public.transactions
  for delete using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

-- ===========================================================================
-- Grants
-- ===========================================================================
grant select, insert, update, delete on public.accounts     to authenticated;
grant select, insert, update, delete on public.categories   to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select on public.account_balances to authenticated;
grant execute on function public.create_transfer(
  uuid, uuid, bigint, bigint, text, timestamptz, uuid, numeric) to authenticated;

revoke all on public.accounts         from anon;
revoke all on public.categories       from anon;
revoke all on public.transactions     from anon;
revoke all on public.account_balances from anon;
