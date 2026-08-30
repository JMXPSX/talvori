-- Account deletion (Phase 8 QA item 3). Two parts:
--   1. Re-point user-attribution FKs so shared history survives a member's
--      departure (attribution nulls out) instead of blocking auth-row deletion.
--   2. delete_my_account(): self-service deletion with a blocking
--      owner-handoff rule. Owned by postgres (SQL editor), which may delete
--      from auth.users — the documented Supabase self-deletion pattern.
-- Spec: context/build-plan.md#spec-2026-08-13-account-deletion-export-design

-- 1) created_by-style columns: nullable + on delete set null ------------------

do $$
declare
  col record;
begin
  for col in
    select * from (values
      ('households',        'created_by'),
      ('accounts',          'created_by'),
      ('transactions',      'created_by'),
      ('fx_rate_snapshots', 'created_by'),
      ('budgets',           'created_by'),
      ('savings_goals',     'created_by'),
      ('goal_contributions','created_by'),
      ('debts',             'created_by'),
      ('debt_payments',     'created_by'),
      ('grocery_lists',     'created_by'),
      ('grocery_items',     'added_by'),
      ('grocery_items',     'purchased_by'),
      ('retailers',         'created_by'),
      ('retailer_stores',   'created_by'),
      ('products',          'created_by'),
      ('retailer_products', 'created_by'),
      ('price_snapshots',   'created_by'),
      ('saved_locations',   'created_by'),
      ('coupons',           'created_by'),
      ('household_subscriptions', 'updated_by')
    ) as t(tbl, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', col.tbl, col.col);
    execute format(
      'alter table public.%I drop constraint if exists %I',
      col.tbl, col.tbl || '_' || col.col || '_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      col.tbl, col.tbl || '_' || col.col || '_fkey', col.col);
  end loop;
end $$;

-- Pending invitations die with the inviter.
alter table public.household_invitations
  drop constraint if exists household_invitations_invited_by_fkey;
alter table public.household_invitations
  add constraint household_invitations_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete cascade;

-- 2) Self-service account deletion -------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'unauthorized';
  end if;

  -- Block: the caller owns a household that other members still use.
  if exists (
    select 1
    from public.household_members om
    where om.user_id = _uid
      and om.role = 'owner'
      and exists (
        select 1 from public.household_members m
        where m.household_id = om.household_id
          and m.user_id <> _uid
      )
  ) then
    raise exception 'owner_handoff_required';
  end if;

  -- Households where the caller is the only member: delete (cascades wipe data).
  delete from public.households h
  where exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id = _uid)
    and not exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id <> _uid);

  -- Remaining references: memberships cascade, invitations cascade,
  -- content attribution nulls out via the FKs above.
  delete from auth.users where id = _uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
