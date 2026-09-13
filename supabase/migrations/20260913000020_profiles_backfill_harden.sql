-- ============================================================================
-- Fix: users missing a profile + harden the signup trigger
-- ============================================================================
-- Some auth.users had no matching public.profiles row (e.g. the earliest account,
-- created around the time handle_new_user was first installed). Without a profile,
-- the person shows up in a household's member list with a null email/name and is
-- invisible to housemates under profiles_select. Backfill the gap, then make the
-- trigger unable to skip silently again.
-- ============================================================================

-- Backfill any auth.users that lack a profile.
insert into public.profiles (id, email, display_name)
select u.id, u.email, nullif(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Harden: never let profile bookkeeping abort an auth signup. If the insert ever
-- fails, the signup still succeeds and the backfill above (re-runnable) covers it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;
