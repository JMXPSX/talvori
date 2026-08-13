# Account deletion & data export — design

Date: 2026-08-13
Status: Approved (Approach A: SQL RPC deletion + client-side export)
Phase: 8 (Security/QA/Hardening), QA item 3

## Goal

GDPR-style self-service: a signed-in user can (a) download everything their RLS
access already lets them see, and (b) permanently delete their account, without
support tickets, service keys on the client, or new infrastructure.

## Decisions (user-approved)

1. **Owner handoff is blocking.** Deleting an account that owns a household with
   other members is refused with a typed error; the user must transfer
   ownership, remove the members, or delete the household first. Households
   where the user is the **sole member** are deleted with all their data.
2. **Export = full household JSON.** One JSON file containing every household
   the user belongs to, with all rows their RLS access returns. No CSVs, no
   personal-data-only filtering.
3. **Mechanism = Approach A.** Deletion is a `security definer` RPC in a
   hand-applied migration; export is pure client code over the existing
   `features/*/api.ts` readers. No Edge Functions.

## 1. Migration `supabase/migrations/20260813000010_account_deletion.sql`

### 1a. FK groundwork (verified against existing migrations)

Already correct: every `household_id` FK cascades from `households`;
`household_members.user_id` and `profiles.id` cascade from `auth.users`.

Must change — columns referencing `auth.users` with NO delete action (deleting
the auth row would violate them in surviving shared households):

| Change to `on delete set null` + drop `not null` | Tables |
|---|---|
| `created_by` | households, accounts*, categories*, transactions, fx_rate_snapshots, budgets, budget_allocations*, goals, goal_contributions, debts, debt_payments, grocery_lists, retailers, retailer_stores, products, retailer_products, prices, coupons |
| `added_by`, `purchased_by` (already nullable) | grocery_list_items |

\* only where the column exists — the implementation enumerates by grepping each
`create table` in the migrations; any table without the column is skipped.

| Change to `on delete cascade` | Tables |
|---|---|
| `invited_by` | household_invitations (pending invites die with the inviter) |

`household_subscriptions.updated_by` is already nullable → just add
`on delete set null`.

Semantics: shared history **survives** a member's departure; attribution is
removed (UI already falls back, e.g. `grocery.someone`).

### 1b. RPC

```sql
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
```

Steps (single transaction, `auth.uid()` as `_uid`, raise `unauthorized` if null):

1. **Block:** if any household exists where `_uid` has role `owner` and the
   household has ≥ 2 members → `raise exception using errcode = 'P0001',
   message = 'owner_handoff_required'`.
2. **Sole-member households:** delete every household where `_uid` is the only
   member (any role — includes orphaned memberships). Cascades wipe all data.
3. **Leave the rest:** nothing to do explicitly — `household_members.user_id`
   cascades when the auth row goes; content FKs null out per 1a.
4. `delete from auth.users where id = _uid;`

`grant execute on function public.delete_my_account() to authenticated;`
(revoke from `anon`/`public`.)

## 2. Export — `features/account/`

- **`export.ts` (pure, unit-tested):** `buildExport(input) -> AccountExport` —
  takes already-fetched per-household row bundles plus `exportedAt: string`
  (ISO) and shapes `{ exportedAt, user: { id, email }, households: [{ household,
  members, accounts, balances, categories, transactions, fxRates, budgets,
  allocations (status rows), goals, contributions?, debts, grocery: { lists,
  items }, retail: { retailers, stores, products, retailerProducts, prices },
  coupons }] }`. Also `exportFilename(exportedAt)` →
  `household-export-YYYYMMDD-HHmmss.json`. Contribution/payment child rows are
  included where an existing list API exists; none are added just for export.
- **`exportApi.ts` (IO):** loops the user's households, calls the existing
  readers (`features/household|finance|grocery|retail/api.ts` +
  `planningApi`/`fxApi`/`couponApi`), returns the bundles. RLS is the scope
  boundary — the export can never contain more than the user can already read.
- **`api.ts` (IO):** `deleteMyAccount()` → `rpc('delete_my_account')`; maps the
  `owner_handoff_required` message to `AppError('forbidden', messageKey:
  'account.errors.ownerHandoff')`; other failures →
  `account.errors.deleteFailed`.
- **Delivery:** web → `Blob` + anchor download; native → `expo-file-system`
  cache write + `expo-sharing` share sheet (install `expo-sharing` if absent).
  Platform fork lives in one small `saveExport.ts` helper.

## 3. UI — `app/account.tsx`

New stack route (native header, title `account.title`), reached from a new
`ListRow` (icon `user`) on the More tab, placed above the sign-out button.

- **Export card:** body copy + secondary Button `account.exportCta`; busy
  spinner while assembling; errors via `ErrorNotice` (retry).
- **Danger zone card:** heading `account.deleteTitle`, warning copy
  `account.deleteWarning` (irreversible; owner-handoff rule mentioned), then
  the arm-and-confirm flow: TextField `account.typeEmailLabel` — the destructive
  Button `account.deleteCta` stays disabled until the input equals the user's
  email (case-insensitive) — then an ActionSheet confirm
  (`account.confirmTitle` / `account.confirmBody`) actually calls
  `deleteMyAccount()`. On success: local `signOut()`; the auth gate lands on
  /login. `owner_handoff_required` renders inline via `ErrorNotice` (no retry).

This is the interim step-up per 03_SECURITY (real MFA/biometric step-up is a
later phase).

## 4. i18n (en/fil/ar, matching key sets)

`account.title, .open, .exportTitle, .exportBody, .exportCta, .deleteTitle,
.deleteWarning, .typeEmailLabel, .deleteCta, .confirmTitle, .confirmBody,
.errors.ownerHandoff, .errors.deleteFailed, .errors.exportFailed`

## 5. Types

`lib/database.types.ts`: affected `created_by`-style Row fields become
`string | null` (Insert paths unchanged — the app still writes them).

## 6. Testing

- **Unit:** `tests/account/export.test.ts` — shaping, filename, empty
  households, multi-household ordering.
- **Live RLS (extend `tests/integration/rls-isolation.mjs`):**
  1. owner-with-member calls RPC → refused with `owner_handoff_required`;
  2. after removing the member, RPC succeeds → auth user gone, household rows
     gone;
  3. a second household where the deleted user was a plain member survives with
     their transactions intact and `created_by` null;
  4. `anon` cannot execute the RPC.
- Gates: `tsc --noEmit`, `npm test`, `expo lint`, i18n parity, web export.

## Out of scope

MFA/biometric step-up, CSV export, Edge Functions, export of other users'
emails beyond what member listing already exposes, scheduled/automatic exports.

## Manual steps (human)

1. Paste `20260813000010_account_deletion.sql` into the Supabase SQL editor.
2. Temporarily add `SUPABASE_SERVICE_ROLE_KEY` to `.env` → `npm run test:rls`
   → remove the key.
