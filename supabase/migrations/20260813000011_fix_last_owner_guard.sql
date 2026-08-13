-- Fix: protect_last_owner() made household deletion impossible.
--
-- The guard fires on household_members DELETE, but an FK cascade from
-- `delete from households` also deletes member rows — and the guard cannot
-- tell "remove the owner from a live household" (must block) apart from
-- "the whole household is being deleted" (must allow). Postgres deletes the
-- parent row before cascading to children, so inside the trigger the
-- household row is already gone in the cascade case — use that as the test.
--
-- Surfaced by delete_my_account(): sole-member household deletion raised
-- 'cannot remove or demote the last owner of a household'.

create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _owner_count int;
begin
  -- Household itself is being deleted (FK cascade): let member rows go.
  if not exists (select 1 from public.households where id = old.household_id) then
    return coalesce(new, old);
  end if;

  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.status <> 'active') then
    select count(*) into _owner_count
    from public.household_members
    where household_id = old.household_id and role = 'owner' and status = 'active';

    if _owner_count <= 1 then
      raise exception 'cannot remove or demote the last owner of a household';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
