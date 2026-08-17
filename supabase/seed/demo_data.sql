-- =============================================================================
-- Demo seed data — for looking at the UI, never for production.
--
-- Creates a self-contained household named 'Demo Household' owned by the user
-- in _owner_email below, then fills it with ~90 days of plausible multi-currency
-- activity: accounts, categories, transactions, FX rates, a current-month
-- budget, and grocery lists.
--
-- If _member_email resolves to a second user, they are added as a 'member' —
-- so either account sees the demo on sign-in, and the shared-household and
-- role-permission behaviour is visible (members can write; only owners can
-- delete the household or change the plan).
--
-- HOW TO RUN
--   Paste into the Supabase SQL editor and run. "Success. No rows returned"
--   means it applied. Then switch to 'Demo Household' in the app's household
--   picker.
--
-- SAFE TO RE-RUN
--   The first statement deletes any existing household named 'Demo Household'
--   owned by this user, so re-running replaces the demo rather than duplicating
--   it. Your real households are matched by neither name nor owner and are left
--   untouched.
--
-- HOW TO REMOVE
--   delete from public.households
--    where name = 'Demo Household'
--      and created_by = (select id from auth.users where lower(email) = lower('jojo@solutionsresource.com'));
--   Every child row cascades from that one delete.
-- =============================================================================

do $$
declare
  -- The owner must exist. The member is optional: if the address matches no
  -- user the household is simply seeded single-member.
  _owner_email  text := 'jojo@solutionsresource.com';
  _member_email text := 'yanniflint@yahoo.com';

  _uid     uuid;  -- owner
  _uid2    uuid;  -- second member, may stay null
  _hh      uuid;

  _acc_usd uuid;
  _acc_php uuid;
  _acc_eur uuid;

  _cat_salary    uuid;
  _cat_freelance uuid;
  _cat_groceries uuid;
  _cat_housing   uuid;
  _cat_transport uuid;
  _cat_dining    uuid;
  _cat_utilities uuid;
  _cat_entertain uuid;
  _cat_health    uuid;

  _budget  uuid;
  _list_a  uuid;
  _list_b  uuid;
  _list_c  uuid;
  _trip_tx uuid;
begin
  ---------------------------------------------------------------------------
  -- resolve the users
  ---------------------------------------------------------------------------
  select id into _uid from auth.users where lower(email) = lower(_owner_email) limit 1;
  if _uid is null then
    raise exception 'No auth user with email %. Sign up in the app first, or edit _owner_email above.', _owner_email;
  end if;

  select id into _uid2 from auth.users where lower(email) = lower(_member_email) limit 1;

  ---------------------------------------------------------------------------
  -- replace any previous demo household (cascades to every child row)
  ---------------------------------------------------------------------------
  delete from public.households where name = 'Demo Household' and created_by = _uid;

  insert into public.households (name, reporting_currency_code, is_cross_border, created_by)
  values ('Demo Household', 'USD', true, _uid)
  returning id into _hh;

  insert into public.household_members (household_id, user_id, role, status)
  values (_hh, _uid, 'owner', 'active');

  if _uid2 is not null and _uid2 <> _uid then
    insert into public.household_members (household_id, user_id, role, status)
    values (_hh, _uid2, 'member', 'active');
  end if;

  -- premium, so the consolidated multi-currency dashboard renders instead of
  -- the upgrade hero. source='manual' is the 6a path; 6b billing writes here too.
  insert into public.household_subscriptions (household_id, plan_code, status, source, updated_by)
  values (_hh, 'premium', 'active', 'manual', _uid);

  ---------------------------------------------------------------------------
  -- FX — stored USD-based; the client's rate lookup derives the inverse pair
  ---------------------------------------------------------------------------
  insert into public.fx_rate_snapshots (household_id, base_currency, quote_currency, rate, source, created_by)
  values
    (_hh, 'USD', 'PHP', 58.20, 'manual', _uid),
    (_hh, 'USD', 'EUR',  0.92, 'manual', _uid);

  ---------------------------------------------------------------------------
  -- accounts — three currencies, so the FX rollup has something to do
  ---------------------------------------------------------------------------
  insert into public.accounts (household_id, name, type, currency_code, opening_balance_minor, created_by)
  values (_hh, 'Everyday Checking', 'bank', 'USD', 480000, _uid) returning id into _acc_usd;

  insert into public.accounts (household_id, name, type, currency_code, opening_balance_minor, created_by)
  values (_hh, 'Manila Wallet', 'wallet', 'PHP', 1850000, _uid) returning id into _acc_php;

  insert into public.accounts (household_id, name, type, currency_code, opening_balance_minor, created_by)
  values (_hh, 'Travel Card', 'card', 'EUR', 62000, _uid) returning id into _acc_eur;

  ---------------------------------------------------------------------------
  -- categories
  ---------------------------------------------------------------------------
  insert into public.categories (household_id, name, kind) values (_hh, 'Salary', 'income')
    returning id into _cat_salary;
  insert into public.categories (household_id, name, kind) values (_hh, 'Freelance', 'income')
    returning id into _cat_freelance;
  insert into public.categories (household_id, name, kind) values (_hh, 'Groceries', 'expense')
    returning id into _cat_groceries;
  insert into public.categories (household_id, name, kind) values (_hh, 'Housing', 'expense')
    returning id into _cat_housing;
  insert into public.categories (household_id, name, kind) values (_hh, 'Transport', 'expense')
    returning id into _cat_transport;
  insert into public.categories (household_id, name, kind) values (_hh, 'Dining Out', 'expense')
    returning id into _cat_dining;
  insert into public.categories (household_id, name, kind) values (_hh, 'Utilities', 'expense')
    returning id into _cat_utilities;
  insert into public.categories (household_id, name, kind) values (_hh, 'Entertainment', 'expense')
    returning id into _cat_entertain;
  insert into public.categories (household_id, name, kind) values (_hh, 'Health', 'expense')
    returning id into _cat_health;

  ---------------------------------------------------------------------------
  -- transactions
  --
  -- currency_code is set to the account's by trg_transactions_enforce_account,
  -- so the value passed here is only a placeholder.
  --
  -- Amounts vary by day via a fixed multiplier rather than random(), so the
  -- dataset is reproducible: re-running gives the same numbers.
  ---------------------------------------------------------------------------

  -- recurring USD expenses, spread over the last 90 days at per-category cadence
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_usd, 'expense', 'out',
         c.base + ((d.n * 7919) % c.spread),
         'USD', c.id, c.label,
         now() - make_interval(days => d.n),
         _uid
  from generate_series(0, 89) as d(n)
  join (values
          (_cat_groceries, 'Weekly groceries',  4500, 3000,  3),
          (_cat_transport, 'Commute',           1200,  800,  2),
          (_cat_dining,    'Dining out',        2800, 2200,  5),
          (_cat_utilities, 'Utilities',         9500, 1500, 30),
          (_cat_entertain, 'Streaming & fun',   1800, 1500,  7),
          (_cat_health,    'Pharmacy',          2500, 2000, 14)
       ) as c(id, label, base, spread, cadence)
    on d.n % c.cadence = 0;

  -- monthly rent
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_usd, 'expense', 'out', 145000, 'USD', _cat_housing, 'Rent',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 30 = 2;

  -- monthly salary
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_usd, 'income', 'in', 420000, 'USD', _cat_salary, 'Monthly salary',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 30 = 1;

  -- PHP side: remittance in, local spending out
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_php, 'income', 'in', 2500000, 'PHP', _cat_salary, 'Remittance received',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 30 = 4;

  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_php, 'expense', 'out',
         85000 + ((d.n * 4441) % 60000),
         'PHP', _cat_groceries, 'Palengke run',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 6 = 1;

  -- EUR side: occasional freelance income and travel spending
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_eur, 'income', 'in', 95000, 'EUR', _cat_freelance, 'Freelance invoice',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 21 = 3;

  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  select _hh, _acc_eur, 'expense', 'out',
         3200 + ((d.n * 3313) % 4800),
         'EUR', _cat_dining, 'Cafe',
         now() - make_interval(days => d.n), _uid
  from generate_series(0, 89) as d(n)
  where d.n % 9 = 5;

  ---------------------------------------------------------------------------
  -- current-month budget with per-category limits
  ---------------------------------------------------------------------------
  insert into public.budgets (household_id, name, currency_code, period_start, period_end, created_by)
  values (_hh,
          'Monthly Budget',
          'USD',
          date_trunc('month', current_date)::date,
          (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
          _uid)
  returning id into _budget;

  insert into public.budget_allocations (budget_id, household_id, category_id, limit_minor)
  values
    (_budget, _hh, _cat_groceries,  60000),
    (_budget, _hh, _cat_housing,   145000),
    (_budget, _hh, _cat_transport,  20000),
    (_budget, _hh, _cat_dining,     30000),
    (_budget, _hh, _cat_utilities,  12000),
    (_budget, _hh, _cat_entertain,  15000);

  ---------------------------------------------------------------------------
  -- grocery lists — two active, one completed
  ---------------------------------------------------------------------------
  insert into public.grocery_lists (household_id, name, currency_code, status, created_by)
  values (_hh, 'Weekly Shop', 'USD', 'active', _uid) returning id into _list_a;

  insert into public.grocery_lists (household_id, name, currency_code, status, created_by)
  values (_hh, 'Party Supplies', 'USD', 'active', _uid) returning id into _list_b;

  insert into public.grocery_items
    (list_id, household_id, name, quantity, unit, estimated_price_minor, is_purchased, added_by, sort_order)
  values
    (_list_a, _hh, 'Milk',            2, 'L',    380, true,  _uid, 0),
    (_list_a, _hh, 'Bread',           1, 'loaf', 320, true,  _uid, 1),
    (_list_a, _hh, 'Eggs',           12, 'pcs',  540, false, _uid, 2),
    (_list_a, _hh, 'Chicken thighs',  1, 'kg',   890, false, _uid, 3),
    (_list_a, _hh, 'Rice',            5, 'kg',  1250, false, _uid, 4),
    (_list_b, _hh, 'Paper cups',      2, 'pack', 450, false, _uid, 0),
    (_list_b, _hh, 'Sparkling water', 6, 'btl',  720, false, _uid, 1),
    (_list_b, _hh, 'Birthday candles',1, 'pack', 250, false, _uid, 2);

  -- a completed trip, linked to the expense it produced
  insert into public.transactions
    (household_id, account_id, type, direction, amount_minor, currency_code, category_id, description, occurred_at, created_by)
  values (_hh, _acc_usd, 'expense', 'out', 6480, 'USD', _cat_groceries, 'Grocery trip',
          now() - interval '5 days', _uid)
  returning id into _trip_tx;

  insert into public.grocery_lists
    (household_id, name, currency_code, status, completed_at, completed_transaction_id, created_by)
  values (_hh, 'Last Week''s Shop', 'USD', 'completed', now() - interval '5 days', _trip_tx, _uid)
  returning id into _list_c;

  insert into public.grocery_items
    (list_id, household_id, name, quantity, unit, estimated_price_minor, actual_price_minor,
     is_purchased, added_by, purchased_by, purchased_at, sort_order)
  values
    (_list_c, _hh, 'Pasta',     3, 'pack', 240, 260, true, _uid, _uid, now() - interval '5 days', 0),
    (_list_c, _hh, 'Tomatoes',  1, 'kg',   410, 380, true, _uid, _uid, now() - interval '5 days', 1),
    (_list_c, _hh, 'Olive oil', 1, 'btl', 1150, 1190, true, _uid, _uid, now() - interval '5 days', 2),
    (_list_c, _hh, 'Coffee',    1, 'bag', 1480, 1520, true, _uid, _uid, now() - interval '5 days', 3),
    (_list_c, _hh, 'Cheese',    1, 'blk', 1090, 1130, true, _uid, _uid, now() - interval '5 days', 4);

  raise notice 'Demo Household seeded: % transactions, % member(s)',
    (select count(*) from public.transactions where household_id = _hh),
    (select count(*) from public.household_members where household_id = _hh);
end $$;
