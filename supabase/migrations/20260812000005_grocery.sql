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
