-- Bills & recurring payments (§6.10). A household-scoped list of recurring
-- money movements (income or expense) with a frequency and a next-due date.
-- "Mark paid" (in the app) records a real transaction on the bill's account and
-- advances next_due_date; there is no background job — posting is user-driven.
--
-- Money rule: a bill's currency ALWAYS follows its funding account (mirrors the
-- transactions trigger), so "mark paid" is never a cross-currency posting.

create table if not exists public.bills (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  direction      public.flow_direction not null,            -- 'in' = income, 'out' = bill
  amount_minor   bigint not null check (amount_minor >= 0),
  currency_code  text not null check (currency_code ~ '^[A-Z]{3}$'),  -- follows the account
  frequency      text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date  date not null,
  account_id     uuid not null references public.accounts (id) on delete cascade,
  category_id    uuid references public.categories (id) on delete set null,
  is_active      boolean not null default true,
  notes          text,
  created_by     uuid not null references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_bills_household on public.bills (household_id);
create index if not exists idx_bills_due on public.bills (next_due_date);

-- Currency always follows the funding account, and the account must belong to the
-- same household (mirrors public.transactions' currency trigger).
create or replace function public.bills_set_currency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _h   uuid;
  _ccy text;
begin
  select household_id, currency_code into _h, _ccy
  from public.accounts where id = new.account_id;
  if _h is null then
    raise exception 'account % not found', new.account_id;
  end if;
  if _h <> new.household_id then
    raise exception 'account belongs to another household';
  end if;
  new.currency_code := _ccy;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bills_set_currency on public.bills;
create trigger trg_bills_set_currency
  before insert or update on public.bills
  for each row execute function public.bills_set_currency();

-- Row Level Security — same shape as the rest of the finance core.
alter table public.bills enable row level security;

drop policy if exists bills_select on public.bills;
create policy bills_select on public.bills
  for select using (public.is_member_of(household_id));

drop policy if exists bills_insert on public.bills;
create policy bills_insert on public.bills
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists bills_update on public.bills;
create policy bills_update on public.bills
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists bills_delete on public.bills;
create policy bills_delete on public.bills
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
  );

grant select, insert, update, delete on public.bills to authenticated;
