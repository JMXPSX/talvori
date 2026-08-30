# Phase 4 — Shared Household Shopping (Grocery) — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Goal

Deliver the MVP "Shared Shopping" module: multiple named grocery lists per
household, edited live across devices, with per-item attribution and a
"complete shopping trip" checkout that produces one clean household expense.

Builds on the established patterns from Phases 1–3: Supabase + RLS (writer vs
viewer roles), integer-minor-unit money, `features/<domain>/api.ts` as the data
boundary, screens under `app/`, i18n in three locales, and pure helpers unit
tested.

## Locked design decisions

1. **Realtime strategy: true Supabase Realtime.** `postgres_changes`
   subscriptions so a change on one device appears on another within ~1s, no
   refresh. This is the spec's exit criterion ("test multi-device concurrency")
   and establishes the realtime foundation the app reuses later.
2. **Purchase → expense: per-list checkout.** Shop, mark items purchased with
   actual prices, then "Complete shopping trip" creates ONE expense transaction
   for the trip total against a chosen account + category. Item detail stays on
   the list. Mirrors a real receipt; keeps the ledger readable.
3. **Currency: one currency per list.** Each list has a `currency_code`
   (defaults client-side to the household `reporting_currency_code`). All item
   prices are integer minor units in that currency. Checkout requires an account
   in the same currency. Matches "one trip, one store, one currency" and the
   money engine's no-mixing invariant.
4. **Notifications: attribution only.** Show who added / who purchased each item
   plus "last updated by". Realtime covers live awareness. No push
   notifications this phase (defers expo-notifications + device tokens).

Confirmed: **multiple named lists per household** (not a single global list).

## Data model — migration `20260812000005_grocery.sql`

### `grocery_lists`

| column                     | type          | notes                                             |
|----------------------------|---------------|---------------------------------------------------|
| `id`                       | uuid pk       | `gen_random_uuid()`                               |
| `household_id`             | uuid          | fk → households, `on delete cascade`              |
| `name`                     | text not null | trimmed, non-empty (client validated)             |
| `currency_code`            | text not null | `~ '^[A-Z]{3}$'`; client defaults to household ccy |
| `status`                   | text not null | check `('active','completed','archived')` default `active` |
| `created_by`               | uuid not null | fk → auth.users                                   |
| `completed_at`             | timestamptz   | nullable; set at checkout                         |
| `completed_transaction_id` | uuid          | nullable; fk → transactions, set at checkout      |
| `created_at`               | timestamptz   | default now()                                     |
| `updated_at`               | timestamptz   | default now(); `set_updated_at()` trigger         |

### `grocery_items`

| column                  | type           | notes                                             |
|-------------------------|----------------|---------------------------------------------------|
| `id`                    | uuid pk        | `gen_random_uuid()`                               |
| `list_id`               | uuid not null  | fk → grocery_lists, `on delete cascade`           |
| `household_id`          | uuid not null  | denormalized from list; needed for RLS + realtime filtering |
| `name`                  | text not null  | trimmed, non-empty                                |
| `quantity`              | numeric        | default 1                                         |
| `unit`                  | text           | nullable ("kg", "pcs")                            |
| `estimated_price_minor` | bigint         | nullable; LINE total in list currency, minor units |
| `actual_price_minor`    | bigint         | nullable; LINE total in list currency, minor units |
| `is_purchased`          | boolean        | default false                                     |
| `added_by`              | uuid not null  | fk → auth.users                                   |
| `purchased_by`          | uuid           | nullable; fk → auth.users                         |
| `purchased_at`          | timestamptz    | nullable                                          |
| `sort_order`            | integer        | default 0                                         |
| `created_at`            | timestamptz    | default now()                                     |
| `updated_at`            | timestamptz    | default now(); `set_updated_at()` trigger         |

Constraints: prices `>= 0` when present; `quantity > 0`.

### Trigger `grocery_items_enforce_list`

Before insert/update: look up the parent list's `household_id`, force
`new.household_id` to match, and raise if the item claims a different household.
Mirrors `transactions_enforce_account`. `security definer`, `set search_path=''`.

## Checkout — `complete_grocery_list(_list_id, _account_id, _category_id)` RPC

`language plpgsql`, `security definer`, `set search_path = ''`. Atomic.

1. `_uid := auth.uid()`; resolve the list's household.
2. Verify `has_role_in(household, ['owner','admin','member'])` for `_uid`.
3. Verify list exists, belongs to that household, and `status = 'active'`.
4. Resolve account; verify it belongs to the same household and
   `account.currency_code = list.currency_code` (else raise).
5. If `_category_id` is provided, verify it belongs to the household.
6. `_total := coalesce(sum(actual_price_minor), 0)` over `is_purchased` items.
7. Insert one `transactions` row: `type='expense'`, `direction='out'`,
   `amount_minor=_total`, `currency_code=list.currency_code`, chosen
   account/category, `description='Grocery: '||list.name`, `created_by=_uid`,
   `occurred_at=now()`. (The existing `transactions_enforce_account` trigger
   re-confirms account/household/currency.)
8. Update list: `status='completed'`, `completed_at=now()`,
   `completed_transaction_id=<new tx id>`.
9. Return the transaction id.

Edge cases: zero purchased items → still allowed (records a 0 expense) OR
reject — **decision: reject** with a clear error ("nothing purchased yet"), so
we never create meaningless 0-value transactions. Already-completed list →
reject.

## RLS (mirrors finance exactly)

Both tables: `enable row level security`.

- **SELECT:** `is_member_of(household_id)`
- **INSERT:** `has_role_in(household_id, ['owner','admin','member'])`
  and `created_by = auth.uid()` (lists) / `added_by = auth.uid()` (items)
- **UPDATE:** `has_role_in(household_id, ['owner','admin','member'])` (using + with check)
- **DELETE:** items → writers; lists → `has_role_in(household_id, ['owner','admin'])`
- Grants: `select, insert, update, delete` to `authenticated`.
- Add both tables to the `supabase_realtime` publication
  (`alter publication supabase_realtime add table ...`). `postgres_changes`
  streams honor RLS for the authenticated role.

## Client — `features/grocery/`

- **`schemas.ts`** — zod schemas: `createListSchema`, `addItemSchema`,
  `updateItemSchema`, `checkoutSchema`. Money entered as major units in UI,
  converted to minor via the existing money helpers.
- **`api.ts`** — data boundary:
  - `listLists(householdId)`, `createList`, `archiveList`
  - `getListWithItems(listId)`, `addItem`, `updateItem` (rename, qty, prices,
    toggle purchased → sets `purchased_by`/`purchased_at`), `deleteItem`
  - `completeList(listId, accountId, categoryId)` → `complete_grocery_list` RPC
  - `subscribeToLists(householdId, cb)` and `subscribeToItems(listId, cb)` —
    return an unsubscribe fn; wrap channel lifecycle.
- **`totals.ts`** — pure helpers: `estimatedTotalMinor(items)`,
  `actualTotalMinor(items)`, `purchasedCount(items)`. Integer minor units.
- Screens:
  - `app/(tabs)/grocery.tsx` — lists index: create list, active + completed
    sections, tap to open. Live via `subscribeToLists`.
  - `app/grocery/_layout.tsx` — stack layout (localized titles).
  - `app/grocery/[id].tsx` — list detail: add item, per-item toggle purchased +
    enter actual price, live estimated-vs-actual totals + purchased count,
    attribution ("added by / purchased by"), "Complete shopping trip" →
    account + category picker → `completeList`. Live via `subscribeToItems`.
- Optimistic UI for the current user's own edits; realtime reconciles.
- **i18n:** add `grocery.*` keys to `locales/en`, `locales/fil`, `locales/ar`
  (existing `screens.groceryTitle/groceryBody` get real content).
- **Types:** add `GroceryListRow`, `GroceryItemRow`, and the
  `complete_grocery_list` RPC signature to `lib/database.types.ts`.

## Tests

- **Unit** — `tests/grocery/totals.test.ts`: estimated/actual totals, purchased
  count, empty list, missing prices treated as 0.
- **RLS** — extend `tests/integration/rls-isolation.mjs`:
  - Household B cannot select/insert/update/delete Household A's lists or items.
  - `complete_grocery_list` refuses a caller who isn't a writer.
  - Currency mismatch (account ccy ≠ list ccy) is rejected.
  - Checkout produces exactly one expense transaction equal to the purchased sum.
- **Realtime concurrency** — best-effort automated: two authenticated clients in
  the same household; client B subscribes, client A inserts an item, assert B
  receives the change within a timeout. Documented manual multi-device check as
  backup (realtime in headless node can be flaky).

## Out of scope (this phase)

Push notifications; item-level (non-checkout) expense conversion; barcode /
price lookup; store/branch selection (that's Phase 5 retail).

## Success criteria

- Two devices in one household see each other's list edits live.
- Completing a trip creates one correct expense in the list currency, linked to
  the list, visible in the transactions feed and dashboard.
- Household isolation holds for all grocery tables (RLS test passes).
- `typecheck` clean, all unit tests pass.
