-- ============================================================================
-- Phase 7 / Onboarding — standing household join code
-- ============================================================================
-- The Talvori design (TALVORI_MOBILE_UI_SPEC.md §5.4, §6.3) gives every household
-- a short, human-shareable JOIN CODE (e.g. "WVH-4827") shown at onboarding and in
-- the household switcher. A user can join a household by typing its code — distinct
-- from the existing email-addressed `household_invitations` token flow, which stays.
--
-- Security: the code is NOT selectable from the households table by non-members
-- (households_select still requires is_member_of). Joining goes through the
-- SECURITY DEFINER RPC below, so codes can't be enumerated by table scan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Code generator: 3 uppercase letters + '-' + 4 digits, retried until unique.
-- pg_catalog (chr/floor/random/lpad) is always on the search_path, so an empty
-- search_path is safe; public refs are schema-qualified.
-- ---------------------------------------------------------------------------
create or replace function public.gen_household_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _letters text;
  _code    text;
  i        int;
begin
  loop
    _letters := '';
    for i in 1..3 loop
      _letters := _letters || chr(65 + floor(random() * 26)::int);
    end loop;
    _code := _letters || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.households where code = _code);
  end loop;
  return _code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Add the column, backfill existing rows, then lock it down (default + unique
-- + not null), so every insert path — RPC or direct — gets a code.
-- ---------------------------------------------------------------------------
alter table public.households add column if not exists code text;

update public.households
  set code = public.gen_household_code()
  where code is null;

alter table public.households alter column code set default public.gen_household_code();

create unique index if not exists uniq_households_code on public.households (code);

alter table public.households alter column code set not null;

-- Codes are always stored uppercase A–Z + '-' + 4 digits.
alter table public.households drop constraint if exists households_code_format;
alter table public.households add constraint households_code_format
  check (code ~ '^[A-Z]{3}-[0-9]{4}$');

-- ---------------------------------------------------------------------------
-- RPC: join a household by its code. Adds the caller as an active 'member' and
-- returns the household (with its shared data now visible under RLS).
--   • unknown code       -> SQLSTATE 'P0002' (mapped to "no household found")
--   • already a member   -> SQLSTATE 'P0003' (mapped to "already in that household")
-- ---------------------------------------------------------------------------
create or replace function public.join_household_by_code(_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _h   public.households;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select * into _h
  from public.households
  where code = upper(trim(_code));

  if _h.id is null then
    raise exception 'no household found for code %', _code using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = _h.id and user_id = _uid and status = 'active'
  ) then
    raise exception 'already a member of %', _h.id using errcode = 'P0003';
  end if;

  insert into public.household_members (household_id, user_id, role, status)
  values (_h.id, _uid, 'member', 'active')
  on conflict (household_id, user_id)
    do update set status = 'active';

  return _h;
end;
$$;

grant execute on function public.gen_household_code()          to authenticated;
grant execute on function public.join_household_by_code(text)  to authenticated;
