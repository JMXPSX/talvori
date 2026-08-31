-- ============================================================================
-- Money-model decision #6 — Goals & debts write to the ledger
-- ============================================================================
-- A savings-goal contribution or a debt payment now posts a READ-ONLY 'out'
-- transaction on a funding account, atomically alongside the existing history
-- row (goal_contributions / debt_payments). Consequences:
--   * it reduces the funding account's balance (account_balances counts every
--     'out'), and counts as Out in the by-account ledger (money-model #5);
--   * it is EXCLUDED from budget "Spent", the spending donut, and insights —
--     all of which count only type = 'expense';
--   * the app shows it read-only in Activity (not editable, like a transfer leg),
--     because editing it would desync the goal/debt balance.
-- Funding account currency must match the goal/debt currency (money stays in one
-- currency per value). Deleting the goal/debt cascades its ledger rows away.
-- Spec: context/architecture.md §"Money model — decided behavior" (item 6).
-- ============================================================================

-- 1. New transaction kinds. ALTER TYPE ADD VALUE is transaction-safe on PG12+;
--    the new labels are never *used* during this migration (the CHECK below is
--    written not to name them, and plpgsql RPC bodies parse lazily at call time),
--    so there is no "unsafe use of new enum value" error.
alter type public.transaction_type add value if not exists 'goal_contribution';
alter type public.transaction_type add value if not exists 'debt_payment';

-- 2. Type/direction rule, restated without naming the new labels: income is 'in',
--    a transfer may be either leg, and everything else (expense, goal_contribution,
--    debt_payment) must be 'out'.
alter table public.transactions drop constraint if exists chk_type_direction;
alter table public.transactions add constraint chk_type_direction check (
  case type
    when 'income'   then direction = 'in'
    when 'transfer' then true
    else direction = 'out'
  end
);

-- 3. Link a ledger row back to the goal/debt it mirrors. on delete cascade keeps
--    balances correct: removing a goal/debt removes its ledger entries too.
alter table public.transactions
  add column if not exists goal_id uuid references public.savings_goals (id) on delete cascade,
  add column if not exists debt_id uuid references public.debts (id) on delete cascade;
create index if not exists idx_transactions_goal on public.transactions (goal_id);
create index if not exists idx_transactions_debt on public.transactions (debt_id);

-- ---------------------------------------------------------------------------
-- contribute_to_goal: history row + mirrored ledger transaction, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.contribute_to_goal(
  _goal_id uuid,
  _account_id uuid,
  _amount_minor bigint,
  _note text default null,
  _occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid     uuid := (select auth.uid());
  _gh      uuid;
  _gcc     text;
  _ah      uuid;
  _acc     text;
  _contrib uuid;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _amount_minor <= 0 then
    raise exception 'amount must be positive';
  end if;

  select household_id, currency_code into _gh, _gcc
  from public.savings_goals where id = _goal_id;
  if _gh is null then
    raise exception 'savings goal not found';
  end if;

  select household_id, currency_code into _ah, _acc
  from public.accounts where id = _account_id;
  if _ah is null then
    raise exception 'account not found';
  end if;

  if _gh <> _ah then
    raise exception 'goal and account must be in the same household';
  end if;
  if _gcc <> _acc then
    raise exception 'funding account currency must match the goal currency';
  end if;
  if not public.has_role_in(
       _gh, array['owner','admin','member']::public.household_role[]) then
    raise exception 'insufficient permission to contribute';
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor, currency_code,
    description, occurred_at, goal_id, created_by)
  values (
    _gh, _account_id, 'goal_contribution', 'out', _amount_minor, _acc,
    _note, _occurred_at, _goal_id, _uid);

  insert into public.goal_contributions (
    goal_id, household_id, amount_minor, occurred_at, note, created_by)
  values (_goal_id, _gh, _amount_minor, _occurred_at, _note, _uid)
  returning id into _contrib;

  return _contrib;
end;
$$;

-- ---------------------------------------------------------------------------
-- pay_debt: history row + mirrored ledger transaction, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.pay_debt(
  _debt_id uuid,
  _account_id uuid,
  _amount_minor bigint,
  _note text default null,
  _occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _dh  uuid;
  _dcc text;
  _ah  uuid;
  _acc text;
  _pay uuid;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _amount_minor <= 0 then
    raise exception 'amount must be positive';
  end if;

  select household_id, currency_code into _dh, _dcc
  from public.debts where id = _debt_id;
  if _dh is null then
    raise exception 'debt not found';
  end if;

  select household_id, currency_code into _ah, _acc
  from public.accounts where id = _account_id;
  if _ah is null then
    raise exception 'account not found';
  end if;

  if _dh <> _ah then
    raise exception 'debt and account must be in the same household';
  end if;
  if _dcc <> _acc then
    raise exception 'funding account currency must match the debt currency';
  end if;
  if not public.has_role_in(
       _dh, array['owner','admin','member']::public.household_role[]) then
    raise exception 'insufficient permission to record a payment';
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor, currency_code,
    description, occurred_at, debt_id, created_by)
  values (
    _dh, _account_id, 'debt_payment', 'out', _amount_minor, _acc,
    _note, _occurred_at, _debt_id, _uid);

  insert into public.debt_payments (
    debt_id, household_id, amount_minor, occurred_at, note, created_by)
  values (_debt_id, _dh, _amount_minor, _occurred_at, _note, _uid)
  returning id into _pay;

  return _pay;
end;
$$;

grant execute on function public.contribute_to_goal(
  uuid, uuid, bigint, text, timestamptz) to authenticated;
grant execute on function public.pay_debt(
  uuid, uuid, bigint, text, timestamptz) to authenticated;
