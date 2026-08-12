-- ============================================================================
-- Phase 2 — Identity & Household foundation
-- ============================================================================
-- Tables: profiles, households, household_members, household_invitations
-- Security: RLS on every table; household isolation enforced by the DATABASE,
--           never by client-supplied household_id (see 02/03 specs).
--
-- Recursion note: household_members policies must check membership WITHOUT
-- selecting household_members under RLS again (that recurses). We use
-- SECURITY DEFINER helper functions that bypass RLS for the membership check.
-- ============================================================================

-- gen_random_uuid()/gcrypto are available on Supabase by default.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'household_role') then
    create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  country_code  text,
  locale        text,
  language      text,
  currency_code text,
  timezone      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(trim(name)) > 0),
  reporting_currency_code text not null check (reporting_currency_code ~ '^[A-Z]{3}$'),
  is_cross_border         boolean not null default false,
  created_by              uuid not null references auth.users (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- household_members (junction; all RLS keys off this)
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.household_role not null default 'member',
  status       text not null default 'active' check (status in ('active', 'removed')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists idx_household_members_user on public.household_members (user_id);

-- ---------------------------------------------------------------------------
-- household_invitations (email-addressed, tokened, expiring, single-use)
-- ---------------------------------------------------------------------------
create table if not exists public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email        text not null check (position('@' in email) > 1),
  role         public.household_role not null default 'member',
  token        uuid not null default gen_random_uuid(),
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by   uuid not null references auth.users (id),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
-- At most one PENDING invite per (household, email).
create unique index if not exists uniq_pending_invite
  on public.household_invitations (household_id, lower(email))
  where status = 'pending';
create index if not exists idx_invitations_token on public.household_invitations (token);

-- ---------------------------------------------------------------------------
-- Membership helper functions (SECURITY DEFINER -> bypass RLS, avoid recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_member_of(_household_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = _household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.has_role_in(_household_id uuid, _roles public.household_role[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = _household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role = any (_roles)
  );
$$;

create or replace function public.shares_household_with(_other_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = (select auth.uid()) and a.status = 'active'
      and b.user_id = _other_user and b.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Guard: never allow removing/demoting the last owner of a household
-- ---------------------------------------------------------------------------
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _owner_count int;
begin
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

drop trigger if exists trg_protect_last_owner on public.household_members;
create trigger trg_protect_last_owner
  before update or delete on public.household_members
  for each row execute function public.protect_last_owner();

-- ---------------------------------------------------------------------------
-- RPC: create a household and make the caller its owner (atomic)
-- ---------------------------------------------------------------------------
create or replace function public.create_household(
  _name text,
  _reporting_currency_code text,
  _is_cross_border boolean default false
)
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

  insert into public.households (name, reporting_currency_code, is_cross_border, created_by)
  values (trim(_name), upper(_reporting_currency_code), coalesce(_is_cross_border, false), _uid)
  returning * into _h;

  insert into public.household_members (household_id, user_id, role, status)
  values (_h.id, _uid, 'owner', 'active');

  return _h;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: accept an invitation by token (validates email + expiry, single-use)
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(_token uuid)
returns public.household_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid   uuid := (select auth.uid());
  _email text := (select auth.email());
  _inv   public.household_invitations;
  _m     public.household_members;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select * into _inv
  from public.household_invitations
  where token = _token and status = 'pending'
  for update;

  if _inv.id is null then
    raise exception 'invalid or already-used invitation';
  end if;

  if _inv.expires_at < now() then
    update public.household_invitations set status = 'expired' where id = _inv.id;
    raise exception 'invitation expired';
  end if;

  if lower(_inv.email) <> lower(coalesce(_email, '')) then
    raise exception 'invitation was issued to a different email';
  end if;

  insert into public.household_members (household_id, user_id, role, status)
  values (_inv.household_id, _uid, _inv.role, 'active')
  on conflict (household_id, user_id)
    do update set status = 'active', role = excluded.role
  returning * into _m;

  update public.household_invitations
  set status = 'accepted', accepted_at = now()
  where id = _inv.id;

  return _m;
end;
$$;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles               enable row level security;
alter table public.households              enable row level security;
alter table public.household_members       enable row level security;
alter table public.household_invitations   enable row level security;

-- profiles: read self or people who share a household; write only self.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = (select auth.uid())
    or public.shares_household_with(id)
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- households: members read; owner/admin update; owner delete; creator inserts.
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (public.is_member_of(id));

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert with check (created_by = (select auth.uid()));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (public.has_role_in(id, array['owner','admin']::public.household_role[]))
  with check (public.has_role_in(id, array['owner','admin']::public.household_role[]));

drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete using (public.has_role_in(id, array['owner']::public.household_role[]));

-- household_members: members read; owner/admin manage; a user may remove self.
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select using (public.is_member_of(household_id));

drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert with check (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

drop policy if exists members_update on public.household_members;
create policy members_update on public.household_members
  for update using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
    or user_id = (select auth.uid())
  );

-- household_invitations: owner/admin manage; the invitee may see their own by email.
drop policy if exists invitations_select on public.household_invitations;
create policy invitations_select on public.household_invitations
  for select using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
    or lower(email) = lower((select auth.email()))
  );

drop policy if exists invitations_insert on public.household_invitations;
create policy invitations_insert on public.household_invitations
  for insert with check (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
    and invited_by = (select auth.uid())
  );

drop policy if exists invitations_update on public.household_invitations;
create policy invitations_update on public.household_invitations
  for update using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

drop policy if exists invitations_delete on public.household_invitations;
create policy invitations_delete on public.household_invitations
  for delete using (public.has_role_in(household_id, array['owner','admin']::public.household_role[]));

-- ===========================================================================
-- Grants — authenticated users act through RLS; anon gets nothing here.
-- ===========================================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles              to authenticated;
grant select, insert, update, delete on public.households            to authenticated;
grant select, insert, update, delete on public.household_members     to authenticated;
grant select, insert, update, delete on public.household_invitations to authenticated;

grant execute on function public.create_household(text, text, boolean) to authenticated;
grant execute on function public.accept_invitation(uuid)              to authenticated;
grant execute on function public.is_member_of(uuid)                   to authenticated;
grant execute on function public.has_role_in(uuid, public.household_role[]) to authenticated;
grant execute on function public.shares_household_with(uuid)          to authenticated;

-- Explicitly keep the anonymous role out of these tables.
revoke all on public.profiles              from anon;
revoke all on public.households            from anon;
revoke all on public.household_members     from anon;
revoke all on public.household_invitations from anon;
