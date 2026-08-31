-- Money-model decision #3: every budget allocation names its funding account.
-- Spec: context/architecture.md §"Money model — decided behavior" (item 3).
--
-- account_id is NULLABLE on purpose: households with no accounts (and any legacy
-- row) stay valid; the app requires an account for NEW allocations. Existing rows
-- are backfilled to the household's "checking-like" account (type='bank' first,
-- else earliest). `on delete set null` leaves a budget unassigned if its funding
-- account is removed (the app then prompts to re-pick).

alter table public.budget_allocations
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Backfill each existing allocation → its household's preferred account.
-- Households with no accounts keep account_id null.
update public.budget_allocations ba
set account_id = (
  select a.id
  from public.accounts a
  join public.budgets b on b.id = ba.budget_id
  where a.household_id = b.household_id
  order by (a.type = 'bank') desc, a.created_at asc, a.id asc
  limit 1
)
where ba.account_id is null;

-- Recreate the status view with account_id projected (appended at the end so
-- CREATE OR REPLACE accepts it — existing columns keep their positions).
create or replace view public.budget_status as
  select al.id as allocation_id,
    al.budget_id,
    b.household_id,
    al.category_id,
    b.currency_code,
    al.limit_minor,
    coalesce((
      select sum(t.amount_minor)
      from transactions t
      where t.household_id = b.household_id
        and t.type = 'expense'::transaction_type
        and t.currency_code = b.currency_code
        and not t.category_id is distinct from al.category_id
        and t.occurred_at::date >= b.period_start
        and t.occurred_at::date <= b.period_end
    ), 0::numeric) as spent_minor,
    al.account_id
  from budget_allocations al
  join budgets b on b.id = al.budget_id;
