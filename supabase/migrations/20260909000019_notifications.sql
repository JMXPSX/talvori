-- ===========================================================================
-- Household activity notifications (§ App & Account → Notifications).
--
-- A shared, household-scoped activity feed: whenever a member does something
-- other members care about (adds a grocery item, records a transaction, adds a
-- bill, sets a budget, or joins the household), an AFTER INSERT trigger writes
-- one notifications row. No client code inserts these — the triggers do, so any
-- write path (screen, RPC, future connector) generates the feed automatically.
--
-- Unread is a per-member watermark (household_members.notifications_seen_at),
-- not per-row read state: the badge counts rows newer than the watermark that
-- someone else created. Opening the list stamps the watermark to now().
-- ===========================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- The member who did the thing. Kept even if they later leave (set null).
  actor_id     uuid references auth.users(id) on delete set null,
  -- Denormalized display name + subject so the list renders with no joins.
  actor_name   text not null default 'Someone',
  type         text not null,           -- e.g. 'grocery_item_added' (maps to an i18n key)
  subject      text not null default '', -- item/bill/category name; interpolated into the message
  created_at   timestamptz not null default now()
);

create index if not exists notifications_household_created_idx
  on public.notifications (household_id, created_at desc);

-- Per-member "last opened the notifications list" watermark.
alter table public.household_members
  add column if not exists notifications_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- One trigger function for every source table. SECURITY DEFINER so the insert
-- into notifications bypasses RLS (the acting member is still auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.create_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor      uuid := (select auth.uid());
  _actor_name text;
  _type       text;
  _subject    text;
begin
  select coalesce(nullif(p.display_name, ''), split_part(p.email, '@', 1), 'Someone')
    into _actor_name
    from public.profiles p
   where p.id = _actor;
  _actor_name := coalesce(_actor_name, 'Someone');

  if tg_table_name = 'grocery_items' then
    _type := 'grocery_item_added';
    _subject := new.name;
  elsif tg_table_name = 'household_members' then
    if new.role = 'owner' then return new; end if; -- skip the founding owner
    _type := 'member_joined';
    _subject := _actor_name;
  elsif tg_table_name = 'transactions' then
    if new.type not in ('income', 'expense') then return new; end if; -- skip transfers & ledger mirrors
    _type := 'transaction_added';
    _subject := coalesce(nullif(new.description, ''), initcap(new.type::text));
  elsif tg_table_name = 'bills' then
    _type := 'bill_added';
    _subject := new.name;
  elsif tg_table_name = 'budget_allocations' then
    _type := 'budget_allocation_added';
    select c.name into _subject from public.categories c where c.id = new.category_id;
    _subject := coalesce(_subject, '');
  else
    return new;
  end if;

  insert into public.notifications (household_id, actor_id, actor_name, type, subject)
  values (new.household_id, _actor, _actor_name, _type, _subject);

  return new;
end;
$$;

drop trigger if exists notify_grocery_item_added on public.grocery_items;
create trigger notify_grocery_item_added
  after insert on public.grocery_items
  for each row execute function public.create_activity_notification();

drop trigger if exists notify_member_joined on public.household_members;
create trigger notify_member_joined
  after insert on public.household_members
  for each row execute function public.create_activity_notification();

drop trigger if exists notify_transaction_added on public.transactions;
create trigger notify_transaction_added
  after insert on public.transactions
  for each row execute function public.create_activity_notification();

drop trigger if exists notify_bill_added on public.bills;
create trigger notify_bill_added
  after insert on public.bills
  for each row execute function public.create_activity_notification();

drop trigger if exists notify_budget_allocation_added on public.budget_allocations;
create trigger notify_budget_allocation_added
  after insert on public.budget_allocations
  for each row execute function public.create_activity_notification();

-- ---------------------------------------------------------------------------
-- Unread count + mark-seen (watermark lives on the caller's membership row).
-- ---------------------------------------------------------------------------
create or replace function public.notifications_unread_count(_household_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int
  from public.notifications n
  where n.household_id = _household_id
    and public.is_member_of(_household_id)
    and n.actor_id is distinct from (select auth.uid())
    and n.created_at > coalesce(
      (select hm.notifications_seen_at
         from public.household_members hm
        where hm.household_id = _household_id
          and hm.user_id = (select auth.uid())),
      '-infinity'::timestamptz
    );
$$;

create or replace function public.mark_notifications_seen(_household_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.household_members
     set notifications_seen_at = now()
   where household_id = _household_id
     and user_id = (select auth.uid());
$$;

-- ===========================================================================
-- RLS + grants + realtime
-- ===========================================================================
alter table public.notifications enable row level security;

-- Any member sees the feed; inserts are trigger-only (no client insert policy).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (public.is_member_of(household_id));

-- Owners/admins may clear the feed.
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
  );

grant select, delete on public.notifications to authenticated;
grant execute on function public.notifications_unread_count(uuid) to authenticated;
grant execute on function public.mark_notifications_seen(uuid)    to authenticated;

-- Stream inserts to subscribed clients (RLS still applies per row).
alter publication supabase_realtime add table public.notifications;
