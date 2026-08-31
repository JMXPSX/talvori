-- ============================================================================
-- Phase 5 / Shop — grocery trip fidelity (TALVORI_MOBILE_UI_SPEC.md §6.8)
-- ============================================================================
-- 1. complete_grocery_list gains an optional STORE name and an optional ACTUAL
--    TOTAL override, so "Record purchase" can name the expense after the store
--    and post the amount the user actually paid (falling back to the item sum).
-- 2. grocery_price_history(household) → the last unit price paid per item name,
--    seeding "Buy again" chips and per-item estimates.
-- 3. grocery_recent_stores(household) → recent store names for the finish-trip
--    store chips.
-- Money invariants unchanged: still exactly ONE expense per completed trip.
-- ============================================================================

-- Drop the old 3-arg version so there is a single, unambiguous overload.
drop function if exists public.complete_grocery_list(uuid, uuid, uuid);

-- `_complete` = false posts the expense but leaves the list ACTIVE (the Shop's
-- evergreen "this week's list", §6.8) — purchased items stay for the Purchased
-- section until Clear purchased removes them. Default true keeps the legacy
-- "finish and close the list" behavior for the older multi-list screens.
create or replace function public.complete_grocery_list(
  _list_id uuid,
  _account_id uuid,
  _category_id uuid default null,
  _store text default null,
  _actual_total_minor bigint default null,
  _complete boolean default true
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
  _sum      bigint;
  _total    bigint;
  _desc     text;
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

  -- Effective total = the caller's actual override, else the sum of purchased items.
  select coalesce(sum(actual_price_minor), 0) into _sum
  from public.grocery_items
  where list_id = _list_id and is_purchased = true;

  _total := coalesce(_actual_total_minor, _sum);
  if _total <= 0 then
    raise exception 'nothing purchased yet';
  end if;

  -- Name the expense after the store when given, else the list.
  _desc := nullif(trim(coalesce(_store, '')), '');
  if _desc is null then
    _desc := 'Grocery: ' || _lname;
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor,
    currency_code, category_id, description, occurred_at, created_by
  ) values (
    _hid, _account_id, 'expense', 'out', _total,
    _lccy, _category_id, _desc, now(), _uid
  ) returning id into _tx_id;

  -- Close the list only when asked; the Shop's evergreen list stays active.
  if _complete then
    update public.grocery_lists
      set status = 'completed', completed_at = now(), completed_transaction_id = _tx_id
    where id = _list_id;
  end if;

  return _tx_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Last unit price paid per item name (across the household's history). Feeds
-- "Buy again" and per-item estimates. SECURITY DEFINER + explicit membership
-- check keeps household isolation.
-- ---------------------------------------------------------------------------
create or replace function public.grocery_price_history(_household_id uuid)
returns table (name text, unit_price_minor bigint, currency_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(gi.name))
    gi.name,
    (gi.actual_price_minor / nullif(gi.quantity, 0))::bigint as unit_price_minor,
    gl.currency_code
  from public.grocery_items gi
  join public.grocery_lists gl on gl.id = gi.list_id
  where gi.household_id = _household_id
    and public.is_member_of(_household_id)
    and gi.is_purchased = true
    and gi.actual_price_minor is not null
    and gi.quantity > 0
  order by lower(gi.name), gi.purchased_at desc nulls last;
$$;

-- Recent store names from completed trips, most-recent first.
create or replace function public.grocery_recent_stores(_household_id uuid)
returns table (store text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.description as store
  from public.transactions t
  join public.grocery_lists gl on gl.completed_transaction_id = t.id
  where t.household_id = _household_id
    and public.is_member_of(_household_id)
    and t.description is not null
    and length(trim(t.description)) > 0
  group by t.description
  order by max(t.occurred_at) desc
  limit 8;
$$;

grant execute on function public.complete_grocery_list(uuid, uuid, uuid, text, bigint, boolean) to authenticated;
grant execute on function public.grocery_price_history(uuid) to authenticated;
grant execute on function public.grocery_recent_stores(uuid) to authenticated;
