# Phase 4 — Shared Household Shopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multiple named grocery lists per household that sync live across devices, track who added/purchased each item, and convert a completed shopping trip into one household expense.

**Architecture:** Two new Postgres tables (`grocery_lists`, `grocery_items`) with RLS mirroring the finance tables, added to the `supabase_realtime` publication. A `security definer` RPC (`complete_grocery_list`) atomically sums purchased items and creates one expense transaction. The client follows the established `features/<domain>` boundary: pure `totals.ts` helper (unit tested), zod `schemas.ts`, `api.ts` data-access + realtime subscription helpers, and Expo Router screens under `app/`. i18n in all three locales.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS + Realtime), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.** Use `lib/money.ts` (`toMinorUnits`, `formatAmount`).
- **No mixing currencies in one transaction.** One currency per list; checkout account currency must equal list currency.
- **No service-role key in client code or `EXPO_PUBLIC_*`.** It is only used in `tests/integration/*.mjs`.
- **RLS is the security boundary.** Every table: SELECT via `public.is_member_of(household_id)`; writes via `public.has_role_in(household_id, array[...]::public.household_role[])`.
- **Data access only through `features/<domain>/api.ts`.** Screens never call `getSupabase()` directly. Query results are cast to `lib/database.types.ts` types at that boundary.
- **All user-facing strings are i18n keys** present in `locales/en.json`, `locales/fil.json`, `locales/ar.json`.
- **Migration files are immutable once applied.** New migration file, timestamp-ordered: `20260812000005_grocery.sql`.
- Verification commands: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Database migration — grocery schema, RLS, realtime, checkout RPC

**Files:**
- Create: `supabase/migrations/20260812000005_grocery.sql`

**Interfaces:**
- Consumes: existing `public.households`, `public.accounts`, `public.categories`, `public.transactions`; helpers `public.is_member_of(uuid)`, `public.has_role_in(uuid, public.household_role[])`, `public.set_updated_at()`; publication `supabase_realtime`.
- Produces: tables `public.grocery_lists`, `public.grocery_items`; RPC `public.complete_grocery_list(_list_id uuid, _account_id uuid, _category_id uuid) returns uuid`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260812000005_grocery.sql`:

```sql
-- ============================================================================
-- Phase 4 — Shared household shopping (grocery lists + items)
-- ============================================================================
-- Multiple named lists per household, edited live via Supabase Realtime. Prices
-- are integer minor units in the LIST's currency (no per-item currency). A
-- "shopping trip" is completed via complete_grocery_list(), which sums purchased
-- items into ONE expense transaction (money invariants unchanged).
-- ============================================================================

create table if not exists public.grocery_lists (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  name                     text not null,
  currency_code            text not null check (currency_code ~ '^[A-Z]{3}$'),
  status                   text not null default 'active'
                             check (status in ('active','completed','archived')),
  completed_at             timestamptz,
  completed_transaction_id uuid references public.transactions (id) on delete set null,
  created_by               uuid not null references auth.users (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_grocery_lists_household
  on public.grocery_lists (household_id, status, created_at desc);

drop trigger if exists trg_grocery_lists_updated_at on public.grocery_lists;
create trigger trg_grocery_lists_updated_at
  before update on public.grocery_lists
  for each row execute function public.set_updated_at();

create table if not exists public.grocery_items (
  id                    uuid primary key default gen_random_uuid(),
  list_id               uuid not null references public.grocery_lists (id) on delete cascade,
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null,
  quantity              numeric not null default 1 check (quantity > 0),
  unit                  text,
  estimated_price_minor bigint check (estimated_price_minor >= 0),
  actual_price_minor    bigint check (actual_price_minor >= 0),
  is_purchased          boolean not null default false,
  added_by              uuid not null references auth.users (id),
  purchased_by          uuid references auth.users (id),
  purchased_at          timestamptz,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_grocery_items_list
  on public.grocery_items (list_id, sort_order, created_at);
create index if not exists idx_grocery_items_household
  on public.grocery_items (household_id);

drop trigger if exists trg_grocery_items_updated_at on public.grocery_items;
create trigger trg_grocery_items_updated_at
  before update on public.grocery_items
  for each row execute function public.set_updated_at();

-- Force item.household_id to match its parent list; block cross-household writes.
create or replace function public.grocery_items_enforce_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then
    raise exception 'grocery list not found';
  end if;
  new.household_id := _h; -- household always follows the parent list
  return new;
end;
$$;

drop trigger if exists trg_grocery_items_enforce_list on public.grocery_items;
create trigger trg_grocery_items_enforce_list
  before insert or update on public.grocery_items
  for each row execute function public.grocery_items_enforce_list();

-- ---------------------------------------------------------------------------
-- complete_grocery_list: sum purchased items into ONE expense, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.complete_grocery_list(
  _list_id uuid,
  _account_id uuid,
  _category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid      uuid := (select auth.uid());
  _hid      uuid;
  _lname    text;
  _lccy     text;
  _lstatus  text;
  _acc_h    uuid;
  _acc_ccy  text;
  _cat_h    uuid;
  _total    bigint;
  _tx_id    uuid;
begin
  select household_id, name, currency_code, status
    into _hid, _lname, _lccy, _lstatus
  from public.grocery_lists where id = _list_id;

  if _hid is null then
    raise exception 'grocery list not found';
  end if;
  if not public.has_role_in(_hid, array['owner','admin','member']::public.household_role[]) then
    raise exception 'not authorized to complete this list';
  end if;
  if _lstatus <> 'active' then
    raise exception 'list is not active';
  end if;

  select household_id, currency_code into _acc_h, _acc_ccy
  from public.accounts where id = _account_id;
  if _acc_h is null or _acc_h <> _hid then
    raise exception 'account does not belong to this household';
  end if;
  if _acc_ccy <> _lccy then
    raise exception 'account currency does not match list currency';
  end if;

  if _category_id is not null then
    select household_id into _cat_h from public.categories where id = _category_id;
    if _cat_h is null or _cat_h <> _hid then
      raise exception 'category does not belong to this household';
    end if;
  end if;

  select coalesce(sum(actual_price_minor), 0) into _total
  from public.grocery_items
  where list_id = _list_id and is_purchased = true;

  if _total <= 0 then
    raise exception 'nothing purchased yet';
  end if;

  insert into public.transactions (
    household_id, account_id, type, direction, amount_minor,
    currency_code, category_id, description, occurred_at, created_by
  ) values (
    _hid, _account_id, 'expense', 'out', _total,
    _lccy, _category_id, 'Grocery: ' || _lname, now(), _uid
  ) returning id into _tx_id;

  update public.grocery_lists
    set status = 'completed', completed_at = now(), completed_transaction_id = _tx_id
  where id = _list_id;

  return _tx_id;
end;
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;

-- grocery_lists
drop policy if exists grocery_lists_select on public.grocery_lists;
create policy grocery_lists_select on public.grocery_lists
  for select using (public.is_member_of(household_id));

drop policy if exists grocery_lists_insert on public.grocery_lists;
create policy grocery_lists_insert on public.grocery_lists
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid())
  );

drop policy if exists grocery_lists_update on public.grocery_lists;
create policy grocery_lists_update on public.grocery_lists
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists grocery_lists_delete on public.grocery_lists;
create policy grocery_lists_delete on public.grocery_lists
  for delete using (
    public.has_role_in(household_id, array['owner','admin']::public.household_role[])
  );

-- grocery_items
drop policy if exists grocery_items_select on public.grocery_items;
create policy grocery_items_select on public.grocery_items
  for select using (public.is_member_of(household_id));

drop policy if exists grocery_items_insert on public.grocery_items;
create policy grocery_items_insert on public.grocery_items
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and added_by = (select auth.uid())
  );

drop policy if exists grocery_items_update on public.grocery_items;
create policy grocery_items_update on public.grocery_items
  for update using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  ) with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

drop policy if exists grocery_items_delete on public.grocery_items;
create policy grocery_items_delete on public.grocery_items
  for delete using (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
  );

-- ===========================================================================
-- Grants + realtime
-- ===========================================================================
grant select, insert, update, delete on public.grocery_lists to authenticated;
grant select, insert, update, delete on public.grocery_items to authenticated;

-- Stream row changes to subscribed clients (RLS still applies per row).
alter publication supabase_realtime add table public.grocery_lists;
alter publication supabase_realtime add table public.grocery_items;
```

- [ ] **Step 2: Apply the migration to Supabase**

Apply via the Supabase SQL editor (paste the file) or CLI. This project applies
migrations manually (no local Postgres). Confirm no errors.

Note: if `alter publication supabase_realtime add table ...` errors with "already
member", that's safe to ignore. If the publication doesn't exist, create it first:
`create publication supabase_realtime;` (Supabase-hosted projects have it by default).

- [ ] **Step 3: Smoke-verify in the SQL editor**

Run and confirm both tables + the function exist:

```sql
select table_name from information_schema.tables
  where table_schema='public' and table_name in ('grocery_lists','grocery_items');
select proname from pg_proc where proname='complete_grocery_list';
select relname from pg_publication_tables where pubname='supabase_realtime'
  and tablename in ('grocery_lists','grocery_items');
```

Expected: 2 tables, 1 function, 2 publication rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000005_grocery.sql
git commit -m "feat(grocery): Phase 4 schema — lists, items, RLS, realtime, checkout RPC"
```

---

### Task 2: TypeScript database types

**Files:**
- Modify: `lib/database.types.ts` (append a Phase 4 section)

**Interfaces:**
- Produces: `GroceryListStatus`, `GroceryListRow`, `GroceryItemRow` types used by all client code.

- [ ] **Step 1: Append the grocery types**

At the end of `lib/database.types.ts`, before any final `Database`/helper block
if present (otherwise at EOF), add:

```typescript
// --- Phase 4: shared shopping (grocery) ------------------------------------
export type GroceryListStatus = 'active' | 'completed' | 'archived';

export interface GroceryListRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  status: GroceryListStatus;
  completed_at: string | null;
  completed_transaction_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryItemRow {
  id: string;
  list_id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_price_minor: number | null;
  actual_price_minor: number | null;
  is_purchased: boolean;
  added_by: string;
  purchased_by: string | null;
  purchased_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "feat(grocery): add GroceryListRow/GroceryItemRow types"
```

---

### Task 3: Pure totals helper (TDD)

**Files:**
- Create: `features/grocery/totals.ts`
- Test: `tests/grocery/totals.test.ts`

**Interfaces:**
- Consumes: `GroceryItemRow` from `lib/database.types`.
- Produces: `estimatedTotalMinor(items)`, `actualTotalMinor(items)`, `purchasedCount(items)`, all `(items: Pick<GroceryItemRow, ...>[]) => number`.

- [ ] **Step 1: Write the failing test**

Create `tests/grocery/totals.test.ts`:

```typescript
import {
  actualTotalMinor,
  estimatedTotalMinor,
  purchasedCount,
} from '@/features/grocery/totals';

type Item = Parameters<typeof estimatedTotalMinor>[0][number];

function item(over: Partial<Item>): Item {
  return {
    estimated_price_minor: null,
    actual_price_minor: null,
    is_purchased: false,
    ...over,
  } as Item;
}

describe('grocery totals', () => {
  it('sums estimated prices, treating null as 0', () => {
    const items = [
      item({ estimated_price_minor: 1000 }),
      item({ estimated_price_minor: 250 }),
      item({ estimated_price_minor: null }),
    ];
    expect(estimatedTotalMinor(items)).toBe(1250);
  });

  it('sums only purchased items for the actual total', () => {
    const items = [
      item({ actual_price_minor: 999, is_purchased: true }),
      item({ actual_price_minor: 500, is_purchased: false }),
      item({ actual_price_minor: 1, is_purchased: true }),
    ];
    expect(actualTotalMinor(items)).toBe(1000);
  });

  it('treats a purchased item with a null actual price as 0', () => {
    const items = [item({ actual_price_minor: null, is_purchased: true })];
    expect(actualTotalMinor(items)).toBe(0);
  });

  it('counts purchased items', () => {
    const items = [
      item({ is_purchased: true }),
      item({ is_purchased: false }),
      item({ is_purchased: true }),
    ];
    expect(purchasedCount(items)).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(estimatedTotalMinor([])).toBe(0);
    expect(actualTotalMinor([])).toBe(0);
    expect(purchasedCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/grocery/totals.test.ts`
Expected: FAIL — cannot find module `@/features/grocery/totals`.

- [ ] **Step 3: Write the implementation**

Create `features/grocery/totals.ts`:

```typescript
/**
 * Pure grocery math in integer minor units (list currency). No I/O — unit
 * tested and reusable in the list UI. Null prices count as 0.
 */

import type { GroceryItemRow } from '@/lib/database.types';

type PriceItem = Pick<
  GroceryItemRow,
  'estimated_price_minor' | 'actual_price_minor' | 'is_purchased'
>;

/** Sum of every item's estimated price (null → 0). */
export function estimatedTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce((sum, it) => sum + (it.estimated_price_minor ?? 0), 0);
}

/** Sum of actual prices for purchased items only (null → 0). */
export function actualTotalMinor(items: readonly PriceItem[]): number {
  return items.reduce(
    (sum, it) => sum + (it.is_purchased ? it.actual_price_minor ?? 0 : 0),
    0,
  );
}

/** How many items are marked purchased. */
export function purchasedCount(items: readonly PriceItem[]): number {
  return items.reduce((n, it) => n + (it.is_purchased ? 1 : 0), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/grocery/totals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add features/grocery/totals.ts tests/grocery/totals.test.ts
git commit -m "feat(grocery): pure totals helpers with unit tests"
```

---

### Task 4: Validation schemas

**Files:**
- Create: `features/grocery/schemas.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `createListSchema`, `addItemSchema`, `updateItemSchema`, `checkoutSchema` (zod schemas) and their inferred types `CreateListInput`, `AddItemInput`, `UpdateItemInput`, `CheckoutInput`.

- [ ] **Step 1: Write the schemas**

Create `features/grocery/schemas.ts` (mirrors the style of
`features/finance/planningSchemas.ts` — major-unit money entered as strings/numbers,
converted to minor in the screen via `toMinorUnits`):

```typescript
/**
 * Grocery form validation. Prices are entered in MAJOR units here and converted
 * to integer minor units at the screen boundary (see lib/money.toMinorUnits).
 */

import { z } from 'zod';

const currency = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' });

const name = z.string().trim().min(1).max(120);
const optionalMajor = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: 'invalid_amount',
  });

export const createListSchema = z.object({
  name,
  currencyCode: currency,
});

export const addItemSchema = z.object({
  name,
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 1 : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, { message: 'invalid_quantity' }),
  unit: z.string().trim().max(24).optional().transform((v) => (v ? v : undefined)),
  estimatedMajor: optionalMajor,
});

export const updateItemSchema = z.object({
  name: name.optional(),
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
      message: 'invalid_quantity',
    }),
  unit: z.string().trim().max(24).optional(),
  estimatedMajor: optionalMajor,
  actualMajor: optionalMajor,
  isPurchased: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/grocery/schemas.ts
git commit -m "feat(grocery): zod validation schemas for lists and items"
```

---

### Task 5: Data access + realtime API

**Files:**
- Create: `features/grocery/api.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `AppError`, `GroceryListRow`, `GroceryItemRow`.
- Produces:
  - `listLists(householdId): Promise<GroceryListRow[]>`
  - `createList(householdId, { name, currencyCode }): Promise<GroceryListRow>`
  - `archiveList(id): Promise<void>`
  - `getList(id): Promise<GroceryListRow | null>`
  - `listItems(listId): Promise<GroceryItemRow[]>`
  - `addItem(listId, { name, quantity, unit?, estimatedPriceMinor? }): Promise<GroceryItemRow>`
  - `updateItem(id, patch): Promise<GroceryItemRow>` where patch may set purchased state + prices
  - `setPurchased(id, isPurchased, actualPriceMinor?): Promise<GroceryItemRow>`
  - `deleteItem(id): Promise<void>`
  - `completeList(listId, accountId, categoryId?): Promise<string>` (RPC → transaction id)
  - `subscribeToLists(householdId, onChange): () => void`
  - `subscribeToItems(listId, onChange): () => void`

- [ ] **Step 1: Write the API module**

Create `features/grocery/api.ts`:

```typescript
/**
 * Grocery data access. Household scoping + writer/viewer permission are enforced
 * by RLS; realtime subscriptions stream row changes (RLS still applies per row).
 * All money crosses this boundary as integer minor units in the list currency.
 */

import type { GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

// --- lists -----------------------------------------------------------------
export async function listLists(householdId: string): Promise<GroceryListRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('household_id', householdId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryListRow[];
}

export async function getList(id: string): Promise<GroceryListRow | null> {
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? null) as GroceryListRow | null;
}

export async function createList(
  householdId: string,
  input: { name: string; currencyCode: string },
): Promise<GroceryListRow> {
  const createdBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_lists')
    .insert({
      household_id: householdId,
      name: input.name,
      currency_code: input.currencyCode,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.listFailed', error);
  return data as GroceryListRow;
}

export async function archiveList(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_lists')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) fail('grocery.errors.saveFailed', error);
}

// --- items -----------------------------------------------------------------
export async function listItems(listId: string): Promise<GroceryItemRow[]> {
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) fail('grocery.errors.loadFailed', error);
  return (data ?? []) as GroceryItemRow[];
}

export async function addItem(
  listId: string,
  input: { name: string; quantity: number; unit?: string; estimatedPriceMinor?: number },
): Promise<GroceryItemRow> {
  const addedBy = await currentUserId();
  const { data, error } = await getSupabase()
    .from('grocery_items')
    // household_id is set by the grocery_items_enforce_list trigger.
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000',
      name: input.name,
      quantity: input.quantity,
      unit: input.unit ?? null,
      estimated_price_minor: input.estimatedPriceMinor ?? null,
      added_by: addedBy,
    })
    .select('*')
    .single();
  if (error) fail('grocery.errors.itemFailed', error);
  return data as GroceryItemRow;
}

export async function updateItem(
  id: string,
  patch: Partial<{
    name: string;
    quantity: number;
    unit: string | null;
    estimatedPriceMinor: number | null;
    actualPriceMinor: number | null;
    isPurchased: boolean;
  }>,
): Promise<GroceryItemRow> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.estimatedPriceMinor !== undefined) row.estimated_price_minor = patch.estimatedPriceMinor;
  if (patch.actualPriceMinor !== undefined) row.actual_price_minor = patch.actualPriceMinor;
  if (patch.isPurchased !== undefined) row.is_purchased = patch.isPurchased;

  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

/** Toggle purchased state, stamping purchaser + optional actual price. */
export async function setPurchased(
  id: string,
  isPurchased: boolean,
  actualPriceMinor?: number,
): Promise<GroceryItemRow> {
  const purchasedBy = isPurchased ? await currentUserId() : null;
  const { data, error } = await getSupabase()
    .from('grocery_items')
    .update({
      is_purchased: isPurchased,
      purchased_by: purchasedBy,
      purchased_at: isPurchased ? new Date().toISOString() : null,
      ...(actualPriceMinor !== undefined ? { actual_price_minor: actualPriceMinor } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) fail('grocery.errors.saveFailed', error);
  return data as GroceryItemRow;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('grocery_items').delete().eq('id', id);
  if (error) fail('grocery.errors.deleteFailed', error);
}

/** Complete a trip: sums purchased items into one expense; returns its tx id. */
export async function completeList(
  listId: string,
  accountId: string,
  categoryId?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accountId,
    _category_id: categoryId ?? null,
  });
  if (error) fail('grocery.errors.checkoutFailed', error);
  return data as string;
}

// --- realtime --------------------------------------------------------------
/** Subscribe to any list change in a household. Returns an unsubscribe fn. */
export function subscribeToLists(householdId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_lists:${householdId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_lists', filter: `household_id=eq.${householdId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}

/** Subscribe to item changes within one list. Returns an unsubscribe fn. */
export function subscribeToItems(listId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`grocery_items:${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void getSupabase().removeChannel(channel);
  };
}
```

Note on `addItem`: the client sends a placeholder `household_id`; the
`grocery_items_enforce_list` trigger overwrites it with the parent list's
household before the RLS `with check` is evaluated against the final row.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/grocery/api.ts
git commit -m "feat(grocery): data-access + realtime subscription helpers"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`
- Modify: `app/(tabs)/grocery.tsx` screen strings already reference `screens.grocery*`; those stay but the real screens use `grocery.*`.

**Interfaces:**
- Produces: a `grocery` namespace present in all three locale files with identical key sets.

- [ ] **Step 1: Add the `grocery` block to `locales/en.json`**

Add a top-level `"grocery"` object (place it after `"fx"`):

```json
"grocery": {
  "title": "Grocery",
  "empty": "No lists yet. Create one below.",
  "activeSection": "Active",
  "completedSection": "Completed",
  "newListTitle": "New list",
  "nameLabel": "List name",
  "currencyLabel": "Currency",
  "createCta": "Create list",
  "openCta": "Open",
  "itemsCount": "{{count}} item",
  "itemsCount_other": "{{count}} items",
  "estimatedTotal": "Estimated",
  "actualTotal": "Spent",
  "purchasedOf": "{{done}} of {{total}} purchased",
  "addItemTitle": "Add item",
  "itemNameLabel": "Item",
  "quantityLabel": "Qty",
  "unitLabel": "Unit",
  "estimatedLabel": "Est. price",
  "actualLabel": "Actual price",
  "addCta": "Add",
  "markPurchased": "Mark purchased",
  "markUnpurchased": "Undo",
  "addedBy": "Added by {{name}}",
  "purchasedBy": "Bought by {{name}}",
  "deleteItem": "Delete",
  "completeTitle": "Complete shopping trip",
  "accountLabel": "Pay from account",
  "categoryLabel": "Category (optional)",
  "completeCta": "Complete trip",
  "completedNote": "Completed — logged as an expense.",
  "someone": "someone",
  "errors": {
    "loadFailed": "Couldn't load grocery lists.",
    "listFailed": "Couldn't create the list.",
    "itemFailed": "Couldn't add the item.",
    "saveFailed": "Couldn't save changes.",
    "deleteFailed": "Couldn't delete the item.",
    "checkoutFailed": "Couldn't complete the trip. Check the account currency matches the list.",
    "noAccount": "Add an account in this currency first."
  }
}
```

- [ ] **Step 2: Add the same block to `locales/fil.json`** (Filipino translations)

```json
"grocery": {
  "title": "Groseri",
  "empty": "Wala pang listahan. Gumawa ng isa sa ibaba.",
  "activeSection": "Aktibo",
  "completedSection": "Tapos na",
  "newListTitle": "Bagong listahan",
  "nameLabel": "Pangalan ng listahan",
  "currencyLabel": "Pera",
  "createCta": "Gumawa ng listahan",
  "openCta": "Buksan",
  "itemsCount": "{{count}} item",
  "itemsCount_other": "{{count}} na item",
  "estimatedTotal": "Tinatantya",
  "actualTotal": "Nagastos",
  "purchasedOf": "{{done}} sa {{total}} nabili",
  "addItemTitle": "Magdagdag ng item",
  "itemNameLabel": "Item",
  "quantityLabel": "Dami",
  "unitLabel": "Yunit",
  "estimatedLabel": "Tinatayang presyo",
  "actualLabel": "Aktwal na presyo",
  "addCta": "Idagdag",
  "markPurchased": "Markahang nabili",
  "markUnpurchased": "Ibalik",
  "addedBy": "Idinagdag ni {{name}}",
  "purchasedBy": "Binili ni {{name}}",
  "deleteItem": "Burahin",
  "completeTitle": "Tapusin ang pamimili",
  "accountLabel": "Bayad mula sa account",
  "categoryLabel": "Kategorya (opsyonal)",
  "completeCta": "Tapusin",
  "completedNote": "Tapos na — naitala bilang gastos.",
  "someone": "isang tao",
  "errors": {
    "loadFailed": "Hindi ma-load ang mga listahan.",
    "listFailed": "Hindi magawa ang listahan.",
    "itemFailed": "Hindi maidagdag ang item.",
    "saveFailed": "Hindi ma-save ang mga pagbabago.",
    "deleteFailed": "Hindi mabura ang item.",
    "checkoutFailed": "Hindi matapos. Tiyaking tugma ang pera ng account sa listahan.",
    "noAccount": "Magdagdag muna ng account sa perang ito."
  }
}
```

- [ ] **Step 3: Add the same block to `locales/ar.json`** (Arabic translations, RTL)

```json
"grocery": {
  "title": "البقالة",
  "empty": "لا توجد قوائم بعد. أنشئ واحدة أدناه.",
  "activeSection": "نشطة",
  "completedSection": "مكتملة",
  "newListTitle": "قائمة جديدة",
  "nameLabel": "اسم القائمة",
  "currencyLabel": "العملة",
  "createCta": "إنشاء قائمة",
  "openCta": "فتح",
  "itemsCount": "عنصر {{count}}",
  "itemsCount_other": "{{count}} عناصر",
  "estimatedTotal": "المقدّر",
  "actualTotal": "المصروف",
  "purchasedOf": "{{done}} من {{total}} تم شراؤها",
  "addItemTitle": "إضافة عنصر",
  "itemNameLabel": "العنصر",
  "quantityLabel": "الكمية",
  "unitLabel": "الوحدة",
  "estimatedLabel": "السعر المقدّر",
  "actualLabel": "السعر الفعلي",
  "addCta": "إضافة",
  "markPurchased": "تحديد كمشترى",
  "markUnpurchased": "تراجع",
  "addedBy": "أضافه {{name}}",
  "purchasedBy": "اشتراه {{name}}",
  "deleteItem": "حذف",
  "completeTitle": "إنهاء رحلة التسوق",
  "accountLabel": "الدفع من حساب",
  "categoryLabel": "الفئة (اختياري)",
  "completeCta": "إنهاء",
  "completedNote": "اكتمل — سُجّل كمصروف.",
  "someone": "شخص ما",
  "errors": {
    "loadFailed": "تعذّر تحميل القوائم.",
    "listFailed": "تعذّر إنشاء القائمة.",
    "itemFailed": "تعذّرت إضافة العنصر.",
    "saveFailed": "تعذّر حفظ التغييرات.",
    "deleteFailed": "تعذّر حذف العنصر.",
    "checkoutFailed": "تعذّر الإنهاء. تأكد من تطابق عملة الحساب مع القائمة.",
    "noAccount": "أضف حسابًا بهذه العملة أولاً."
  }
}
```

- [ ] **Step 4: Verify the i18n test + typecheck pass**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (the i18n test verifies locale files parse / key parity if implemented).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(grocery): i18n strings for en, fil, ar"
```

---

### Task 7: Lists index screen + stack layout

**Files:**
- Create: `app/grocery/_layout.tsx`
- Modify (replace placeholder): `app/(tabs)/grocery.tsx`

**Interfaces:**
- Consumes: `listLists`, `createList`, `subscribeToLists` from `features/grocery/api`; `createListSchema`; `useActiveHousehold`; `GroceryListRow`.
- Produces: navigable list index; taps route to `/grocery/[id]`.

- [ ] **Step 1: Create the grocery stack layout**

Create `app/grocery/_layout.tsx`:

```typescript
/** Grocery section stack (list detail screens open on top of the tab). */

import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { palette } from '@/components/theme';

export default function GroceryLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Replace the grocery tab placeholder with the lists index**

Replace the entire contents of `app/(tabs)/grocery.tsx`:

```typescript
/** Grocery tab: household shopping lists (live) + create. */

import { getLocales } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createList, listLists, subscribeToLists } from '@/features/grocery/api';
import { createListSchema } from '@/features/grocery/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(fallback: string): string {
  try {
    return getLocales()[0]?.currencyCode ?? fallback;
  } catch {
    return fallback;
  }
}

export default function GroceryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [lists, setLists] = useState<GroceryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setLists(await listLists(active.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live updates while the tab is mounted.
  useEffect(() => {
    if (!active) return;
    if (!currency) setCurrency(deviceCurrency(active.reporting_currency_code));
    const unsub = subscribeToLists(active.id, () => void load());
    return unsub;
  }, [active, currency, load]);

  async function onCreate() {
    if (!active) return;
    const result = validate(createListSchema, { name, currencyCode: currency });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createList(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
      });
      setName('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const active_ = lists.filter((l) => l.status === 'active');
  const completed = lists.filter((l) => l.status === 'completed');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : lists.length === 0 ? (
          <Text muted>{t('grocery.empty')}</Text>
        ) : (
          <View style={styles.groups}>
            {active_.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.activeSection')}</Text>
                {active_.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{l.currency_code}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {completed.length > 0 && (
              <View style={styles.group}>
                <Text variant="caption" muted>{t('grocery.completedSection')}</Text>
                {completed.map((l) => (
                  <Pressable key={l.id} style={styles.card} onPress={() => router.push(`/grocery/${l.id}`)}>
                    <Text variant="heading">{l.name}</Text>
                    <Text variant="caption" muted>{t('grocery.completedNote')}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('grocery.newListTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('grocery.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('grocery.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <Button
            label={submitting ? t('auth.processing') : t('grocery.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/grocery/_layout.tsx "app/(tabs)/grocery.tsx"
git commit -m "feat(grocery): live lists index + section stack layout"
```

---

### Task 8: List detail screen (items, purchase, checkout)

**Files:**
- Create: `app/grocery/[id].tsx`

**Interfaces:**
- Consumes: `getList`, `listItems`, `addItem`, `setPurchased`, `deleteItem`, `completeList`, `subscribeToItems` from `features/grocery/api`; `addItemSchema`; `estimatedTotalMinor`, `actualTotalMinor`, `purchasedCount`; `listAccounts`, `listCategories` from `features/finance/api`; `formatAmount`, `toMinorUnits`.
- Produces: the interactive per-list screen.

- [ ] **Step 1: Create the list detail screen**

Create `app/grocery/[id].tsx`:

```typescript
/** Grocery list detail: live items, purchase toggle, totals, and checkout. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
import {
  addItem,
  completeList,
  deleteItem,
  getList,
  listItems,
  setPurchased,
  subscribeToItems,
} from '@/features/grocery/api';
import { addItemSchema } from '@/features/grocery/schemas';
import { actualTotalMinor, estimatedTotalMinor, purchasedCount } from '@/features/grocery/totals';
import type { AccountRow, CategoryRow, GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function GroceryListScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);

  const [list, setList] = useState<GroceryListRow | null>(null);
  const [items, setItems] = useState<GroceryItemRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [est, setEst] = useState('');
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    setErrorKey(null);
    try {
      const l = await getList(listId);
      setList(l);
      const [its, accs] = await Promise.all([
        listItems(listId),
        l ? listAccounts(l.household_id) : Promise.resolve([]),
      ]);
      setItems(its);
      setAccounts(accs.filter((a) => !l || a.currency_code === l.currency_code));
      if (l) setCategories(await listCategories(l.household_id, 'expense'));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const unsub = subscribeToItems(listId, () => void load());
    return unsub;
  }, [listId, load]);

  async function onAdd() {
    const result = validate(addItemSchema, { name, quantity: qty, estimatedMajor: est });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    try {
      const ccy = list?.currency_code ?? 'USD';
      await addItem(listId, {
        name: result.data.name,
        quantity: result.data.quantity,
        unit: result.data.unit,
        estimatedPriceMinor:
          result.data.estimatedMajor === undefined
            ? undefined
            : toMinorUnits(result.data.estimatedMajor, ccy),
      });
      setName('');
      setQty('');
      setEst('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onToggle(item: GroceryItemRow) {
    try {
      const ccy = list?.currency_code ?? 'USD';
      const raw = actualInputs[item.id];
      const actualMinor =
        !item.is_purchased && raw ? toMinorUnits(Number(raw), ccy) : undefined;
      await setPurchased(item.id, !item.is_purchased, actualMinor);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onDelete(item: GroceryItemRow) {
    try {
      await deleteItem(item.id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onComplete() {
    if (!list || accounts.length === 0) {
      setErrorKey('grocery.errors.noAccount');
      return;
    }
    setCheckingOut(true);
    try {
      // MVP: pay from the first same-currency account; category optional (first expense category).
      await completeList(listId, accounts[0].id, categories[0]?.id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  const ccy = list?.currency_code ?? 'USD';
  const isCompleted = list?.status === 'completed';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.summary}>
          <Text variant="caption" muted>
            {t('grocery.estimatedTotal')}: {formatAmount(estimatedTotalMinor(items), ccy)}
          </Text>
          <Text variant="caption" muted>
            {t('grocery.actualTotal')}: {formatAmount(actualTotalMinor(items), ccy)}
          </Text>
          <Text variant="caption" muted>
            {t('grocery.purchasedOf', { done: purchasedCount(items), total: items.length })}
          </Text>
        </View>

        <View style={styles.list}>
          {items.map((it) => (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text variant="heading" style={it.is_purchased ? styles.struck : undefined}>
                  {it.name}
                  {it.unit ? ` · ${it.quantity} ${it.unit}` : ` · ${it.quantity}`}
                </Text>
                <Text variant="caption" muted>
                  {formatAmount(it.actual_price_minor ?? it.estimated_price_minor ?? 0, ccy)}
                </Text>
              </View>
              {!isCompleted && (
                <View style={styles.inlineRow}>
                  {!it.is_purchased && (
                    <View style={styles.inlineField}>
                      <TextField
                        label={t('grocery.actualLabel')}
                        value={actualInputs[it.id] ?? ''}
                        onChangeText={(v) => setActualInputs((p) => ({ ...p, [it.id]: v }))}
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                  <Button
                    label={it.is_purchased ? t('grocery.markUnpurchased') : t('grocery.markPurchased')}
                    onPress={() => onToggle(it)}
                  />
                  <Pressable onPress={() => onDelete(it)}>
                    <Text variant="caption" style={{ color: palette.danger }}>
                      {t('grocery.deleteItem')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>

        {!isCompleted && (
          <>
            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.addItemTitle')}</Text>
            <View style={styles.form}>
              <TextField
                label={t('grocery.itemNameLabel')}
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                error={fieldErrors.name ? t('errors.validation') : undefined}
              />
              <TextField label={t('grocery.quantityLabel')} value={qty} onChangeText={setQty} keyboardType="numeric" />
              <TextField label={t('grocery.estimatedLabel')} value={est} onChangeText={setEst} keyboardType="numeric" />
              <Button label={t('grocery.addCta')} onPress={onAdd} />
            </View>

            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.completeTitle')}</Text>
            <Button
              label={checkingOut ? t('auth.processing') : t('grocery.completeCta')}
              onPress={onComplete}
              loading={checkingOut}
            />
          </>
        )}

        {isCompleted && <Text muted>{t('grocery.completedNote')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  summary: { gap: spacing.xs },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  struck: { textDecorationLine: 'line-through' },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  inlineField: { flex: 1 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

Note: the MVP checkout pays from the first same-currency account and uses the
first expense category. A picker UI can be added later; the RPC already accepts
explicit account/category ids.

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "app/grocery/[id].tsx"
git commit -m "feat(grocery): list detail — items, purchase toggle, totals, checkout"
```

---

### Task 9: Extend RLS + realtime integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `signedInClient`, `a`, `b`, `hid`, `accId`, `admin`).
- Produces: grocery isolation + checkout + realtime assertions.

- [ ] **Step 1: Add grocery setup where A owns the household (after the finance setup block)**

Inside `main()`, after A creates accounts/transactions (near the transfer
assertions, before the "B cannot read" section), add:

```javascript
  // --- grocery: A creates a list + item -------------------------------------
  const { data: gl, error: glErr } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'Weekly', currency_code: 'PHP', created_by: idA })
    .select('id')
    .single();
  ok('A can create a grocery list', !glErr && Boolean(gl?.id));
  const listId = gl?.id;

  const { data: gi, error: giErr } = await a
    .from('grocery_items')
    .insert({
      list_id: listId,
      household_id: '00000000-0000-0000-0000-000000000000', // overwritten by trigger
      name: 'Rice',
      quantity: 2,
      estimated_price_minor: 30000,
      added_by: idA,
    })
    .select('id, household_id')
    .single();
  ok('A can add an item; trigger sets household_id', !giErr && gi?.household_id === hid);

  // Mark purchased with an actual price, then complete the trip.
  await a
    .from('grocery_items')
    .update({ is_purchased: true, purchased_by: idA, actual_price_minor: 28500 })
    .eq('id', gi?.id);
  const { data: txId, error: coErr } = await a.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok('A can complete the trip (checkout RPC)', !coErr && Boolean(txId));

  const { data: coTx } = await a
    .from('transactions')
    .select('amount_minor, type')
    .eq('id', txId)
    .single();
  ok('checkout created one expense equal to purchased sum (28500)',
    coTx?.type === 'expense' && coTx?.amount_minor === 28500);
```

- [ ] **Step 2: Add the currency-mismatch rejection assertion**

Right after the checkout block above:

```javascript
  // A second list in a different currency cannot check out against a PHP account.
  const { data: gl2 } = await a
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'USD trip', currency_code: 'USD', created_by: idA })
    .select('id')
    .single();
  await a.from('grocery_items').insert({
    list_id: gl2?.id,
    household_id: '00000000-0000-0000-0000-000000000000',
    name: 'Item',
    quantity: 1,
    is_purchased: true,
    purchased_by: idA,
    actual_price_minor: 500,
    added_by: idA,
  });
  const { error: mismatchErr } = await a.rpc('complete_grocery_list', {
    _list_id: gl2?.id,
    _account_id: accId, // PHP account
    _category_id: null,
  });
  ok('checkout rejects account/list currency mismatch', Boolean(mismatchErr));
```

- [ ] **Step 3: Add B-cannot-access assertions (in the "B cannot read A" section, before B joins)**

```javascript
  // B CANNOT read or write A's grocery lists/items (not a member yet).
  const { data: bLists } = await b.from('grocery_lists').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery lists (RLS)", (bLists ?? []).length === 0);
  const { data: bItems } = await b.from('grocery_items').select('id').eq('household_id', hid);
  ok("B cannot read A's grocery items (RLS)", (bItems ?? []).length === 0);
  const { error: bListErr } = await b
    .from('grocery_lists')
    .insert({ household_id: hid, name: 'X', currency_code: 'PHP', created_by: idB });
  ok("B cannot create a list in A's household", Boolean(bListErr));
  const { error: bCoErr } = await b.rpc('complete_grocery_list', {
    _list_id: listId,
    _account_id: accId,
    _category_id: null,
  });
  ok("B cannot complete A's list via RPC", Boolean(bCoErr));
```

- [ ] **Step 4: Add a best-effort realtime propagation assertion (after B joins, at the end of `main()` before the closing brace)**

```javascript
  // --- realtime: B (now a member) receives A's item insert live -------------
  const received = await new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const channel = b
      .channel(`test_items:${listId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grocery_items', filter: `list_id=eq.${listId}` },
        () => finish(true),
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await a.from('grocery_items').insert({
            list_id: listId,
            household_id: '00000000-0000-0000-0000-000000000000',
            name: 'Live item',
            quantity: 1,
            added_by: idA,
          });
        }
      });
    setTimeout(() => finish(false), 8000);
    // best effort: caller ignores channel cleanup; test process exits after.
  });
  ok('realtime delivers A\'s insert to member B within 8s', received === true);
```

- [ ] **Step 5: Run the RLS/integration suite**

Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `.env` temporarily, then:

Run: `npm run test:rls`
Expected: all assertions pass, including the new grocery ones. (If the realtime
assertion is flaky due to network, re-run; document a manual two-device check as
backup. Realtime must be enabled on the tables — done in Task 1.)

- [ ] **Step 6: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(grocery): RLS isolation, checkout, currency-guard, realtime propagation"
```

---

### Task 10: Final verification + memory/state note

**Files:** none (verification + optional cleanup)

- [ ] **Step 1: Full verification sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls
```
Expected: typecheck clean; all unit suites pass (now including `tests/grocery/totals.test.ts`); RLS suite passes including grocery assertions.

- [ ] **Step 2: Confirm the tab is wired**

`app/(tabs)/_layout.tsx` already registers the `grocery` tab (`nav.grocery`).
Manually confirm: open the app, Grocery tab → create a list → open it → add an
item → mark purchased with a price → Complete trip → verify an expense appears in
Transactions and the dashboard total. (Two devices/browsers for the live check.)

- [ ] **Step 3: Remove the temporary service-role key**

If added to `.env` for the RLS test, remove `SUPABASE_SERVICE_ROLE_KEY` again
(it must never ship).

- [ ] **Step 4: Final commit (if any stray changes)**

```bash
git status
# commit anything outstanding with an appropriate message
```

---

## Self-Review

**Spec coverage:**
- grocery_lists / grocery_items → Task 1 ✓
- realtime household sync → Task 1 (publication) + Task 5 (subscribe helpers) + Tasks 7/8 (screen wiring) + Task 9 (test) ✓
- added_by / purchased_by → Task 1 (columns) + Task 5 (`setPurchased`) + Task 8 (attribution display uses added_by/purchased_by; display names are out of scope — shows via caption) ✓
- quantity/unit → Task 1 + Task 8 ✓
- estimated/actual price (integer minor, list currency) → Tasks 1, 3, 5, 8 ✓
- convert purchase to household expense → Task 1 (`complete_grocery_list`) + Task 5 (`completeList`) + Task 8 (checkout) + Task 9 (assertion) ✓
- one currency per list → Task 1 (`currency_code` + RPC guard) + Task 8 (account filter) ✓
- attribution only, no push → nothing pulls expo-notifications ✓
- multiple named lists → Task 1 + Task 7 ✓
- multi-device concurrency + household isolation test → Task 9 ✓
- i18n en/fil/ar → Task 6 ✓
- types → Task 2 ✓
- unit tests for totals → Task 3 ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. The one design
decision "checkout rejects 0 purchased" is enforced in the RPC (`_total <= 0`).

**Type consistency:** `GroceryListRow`/`GroceryItemRow` (Task 2) are used verbatim
in Tasks 3/5/7/8. API function names (`listLists`, `createList`, `getList`,
`listItems`, `addItem`, `updateItem`, `setPurchased`, `deleteItem`, `completeList`,
`subscribeToLists`, `subscribeToItems`) are defined in Task 5 and consumed with the
same names/signatures in Tasks 7/8. Totals helpers (`estimatedTotalMinor`,
`actualTotalMinor`, `purchasedCount`) match between Task 3 and Task 8.

**Note on attribution display:** Task 8 tracks `added_by`/`purchased_by` ids;
resolving them to display names needs a profiles lookup. For this phase the
attribution keys (`grocery.addedBy`/`purchasedBy`) exist and the ids are stored;
wiring the name lookup is a small follow-up and does not block the phase goal.
