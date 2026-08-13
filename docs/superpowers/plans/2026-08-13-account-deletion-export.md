# Account Deletion & Data Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-service GDPR-style data export (full household JSON) and account deletion (blocking owner-handoff rule) per `docs/superpowers/specs/2026-08-13-account-deletion-export-design.md`.

**Architecture:** One hand-applied SQL migration (FK re-pointing + `delete_my_account()` security-definer RPC); pure export shaper + IO reader loop in `features/account/`; one new `app/account.tsx` screen reached from the More tab.

**Tech Stack:** Expo / React Native, Supabase (RLS + RPC), jest.

## Global Constraints

- Money stays integer minor units; export copies rows verbatim — no float math.
- All copy through `t('…')`; keys added to `locales/{en,fil,ar}.json` together.
- Screens never call `getSupabase()` — only `features/*/api*.ts`.
- Migration is applied BY THE HUMAN in the Supabase SQL editor; never claim it ran.
- `lib/database.types.ts` updated by hand in the same task as the migration.
- Gates after every task: `npx tsc --noEmit`; full gates at the end.

---

### Task 1: Migration + database.types sync

**Files:**
- Create: `supabase/migrations/20260813000010_account_deletion.sql`
- Modify: `lib/database.types.ts` (affected `created_by`-style Row fields → `string | null`)

**Interfaces:**
- Produces: RPC `public.delete_my_account()` (no args, void; raises message `owner_handoff_required` when blocked). Consumed by Task 3's `deleteMyAccount()`.

- [ ] **Step 1: Write the migration** — full content:

```sql
-- Account deletion (Phase 8 QA item 3). Two parts:
--   1. Re-point user-attribution FKs so shared history survives a member's
--      departure (attribution nulls out) instead of blocking auth-row deletion.
--   2. delete_my_account(): self-service deletion with a blocking
--      owner-handoff rule. Owned by postgres (SQL editor), which may delete
--      from auth.users — the documented Supabase self-deletion pattern.

-- 1) created_by-style columns: nullable + on delete set null ------------------

do $$
declare
  col record;
begin
  for col in
    select * from (values
      ('households',        'created_by'),
      ('accounts',          'created_by'),
      ('transactions',      'created_by'),
      ('fx_rate_snapshots', 'created_by'),
      ('budgets',           'created_by'),
      ('savings_goals',     'created_by'),
      ('goal_contributions','created_by'),
      ('debts',             'created_by'),
      ('debt_payments',     'created_by'),
      ('grocery_lists',     'created_by'),
      ('grocery_items',     'added_by'),
      ('grocery_items',     'purchased_by'),
      ('retailers',         'created_by'),
      ('retailer_stores',   'created_by'),
      ('products',          'created_by'),
      ('retailer_products', 'created_by'),
      ('price_snapshots',   'created_by'),
      ('saved_locations',   'created_by'),
      ('coupons',           'created_by'),
      ('household_subscriptions', 'updated_by')
    ) as t(tbl, col)
  loop
    execute format('alter table public.%I alter column %I drop not null', col.tbl, col.col);
    execute format(
      'alter table public.%I drop constraint if exists %I',
      col.tbl, col.tbl || '_' || col.col || '_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
      col.tbl, col.tbl || '_' || col.col || '_fkey', col.col);
  end loop;
end $$;

-- Pending invitations die with the inviter.
alter table public.household_invitations
  drop constraint if exists household_invitations_invited_by_fkey;
alter table public.household_invitations
  add constraint household_invitations_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete cascade;

-- 2) Self-service account deletion -------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'unauthorized';
  end if;

  -- Block: the caller owns a household that other members still use.
  if exists (
    select 1
    from public.household_members om
    where om.user_id = _uid
      and om.role = 'owner'
      and exists (
        select 1 from public.household_members m
        where m.household_id = om.household_id
          and m.user_id <> _uid
      )
  ) then
    raise exception 'owner_handoff_required';
  end if;

  -- Households where the caller is the only member: delete (cascades wipe data).
  delete from public.households h
  where exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id = _uid)
    and not exists (
      select 1 from public.household_members m
      where m.household_id = h.id and m.user_id <> _uid);

  -- Remaining references: memberships cascade, invitations cascade,
  -- content attribution nulls out via the FKs above.
  delete from auth.users where id = _uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

- [ ] **Step 2: Sync `lib/database.types.ts`** — for each Row type of the 20 columns above, change `created_by: string` (etc.) to `created_by: string | null`. Leave Insert types unchanged.
- [ ] **Step 3: `npx tsc --noEmit`** — fix any code assuming non-null attribution (expected: grocery display already null-safe).
- [ ] **Step 4: Commit** — `feat(account): migration for FK set-null + delete_my_account RPC (unapplied)`

### Task 2: Pure export shaper + tests (TDD)

**Files:**
- Create: `features/account/export.ts`, Test: `tests/account/export.test.ts`

**Interfaces:**
- Produces:
  - `interface HouseholdExportBundle { household: HouseholdRow; members: …; accounts: AccountRow[]; balances: AccountBalanceRow[]; categories: CategoryRow[]; transactions: TransactionWithRefs[]; fxRates: LatestFxRateRow[]; budgets: BudgetRow[]; budgetStatus: BudgetStatusRow[]; goals: …[]; goalStatus: …[]; debts: …[]; debtStatus: …[]; grocery: { lists: GroceryListRow[]; items: Record<listId, items[]> }; retail: { retailers; stores; products; retailerProducts?; prices }; coupons }`
  - `interface AccountExport { exportedAt: string; user: { id: string; email: string | null }; households: HouseholdExportBundle[] }`
  - `buildExport(user, bundles, exportedAt): AccountExport` (pure: sorts households by name, stamps fields, no mutation)
  - `exportFilename(exportedAt: string): string` → `household-export-<YYYYMMDD-HHMMSS>.json` derived only from the ISO string (no Date.now inside).

- [ ] Write failing tests: filename shape from a fixed ISO string; buildExport stamps user/exportedAt; households sorted by name; empty bundle list yields `households: []`.
- [ ] Run: `npx jest tests/account/export.test.ts` → FAIL (module missing).
- [ ] Implement; run again → PASS. Commit `feat(account): pure export shaper`.

### Task 3: Account IO — exportApi, saveExport, deleteMyAccount

**Files:**
- Create: `features/account/exportApi.ts`, `features/account/saveExport.ts`, `features/account/api.ts`

**Interfaces:**
- Consumes existing readers: `listMyHouseholds, listMembers` (household), `listAccounts, listAccountBalances, listCategories, listTransactions(id, 10000)` (finance), `listLatestRates`, `listBudgets, listBudgetStatus, listGoals, listGoalStatus, listDebts, listDebtStatus` (planning), `listLists, listItems` (grocery), `listRetailers, listStores, listProducts, listPricesForProduct, listSavedLocations` (retail), `listCoupons` (couponApi), plus Task 2's `buildExport`.
- Produces: `assembleExport(userId, email): Promise<AccountExport>`; `saveExport(json: string, filename: string): Promise<void>` (web: Blob+anchor; native: expo-file-system cache + expo-sharing — `npx expo install expo-sharing` if missing); `deleteMyAccount(): Promise<void>` mapping `owner_handoff_required` → `AppError('forbidden', { messageKey: 'account.errors.ownerHandoff' })`, other errors → `account.errors.deleteFailed`.

- [ ] Implement all three modules; `npx tsc --noEmit`; commit `feat(account): export assembly + save + delete RPC client`.

### Task 4: i18n keys (en/fil/ar together)

**Files:** Modify all three `locales/*.json` — new `account` block: `title, open, exportTitle, exportBody, exportCta, deleteTitle, deleteWarning, typeEmailLabel, deleteCta, confirmTitle, confirmBody, errors.ownerHandoff, errors.deleteFailed, errors.exportFailed`.

- [ ] Add keys; run `npx jest tests/lib/i18n.test.ts` → PASS (parity). Commit `feat(i18n): account screen keys`.

### Task 5: Account screen + navigation

**Files:**
- Create: `app/account.tsx`
- Modify: `app/_layout.tsx` (add `<Stack.Screen name="account" options={{ title: t('account.title') }} />` after `subscription`), `app/(tabs)/more.tsx` (ListRow icon `user` → `/account`, above sign-out).

**Behavior:** Export Card (`exportTitle`/`exportBody`, secondary Button `exportCta`, busy state, failure → `ErrorNotice` retry). Danger-zone Card (`deleteTitle` heading, `deleteWarning` muted, TextField `typeEmailLabel`; destructive-styled Button `deleteCta` disabled until input equals user email case-insensitively; press → `useActionSheet` confirm (`confirmTitle`/`confirmBody`, destructive action) → `deleteMyAccount()` → `signOut()`; `ownerHandoff` error → inline `ErrorNotice` without retry). Uses `Screen`-less SafeAreaView with `edges={['left','right','bottom']}` (native header on).

- [ ] Implement; `npx tsc --noEmit`; manual web smoke via preview. Commit `feat(account): account screen — export + guarded deletion`.

### Task 6: Live RLS drill extension

**Files:** Modify `tests/integration/rls-isolation.mjs`.

- [ ] Append scenarios (service client creates users D1/D2): D1 owns household with member D2 → D1 `rpc('delete_my_account')` → expect error containing `owner_handoff_required`; remove D2's membership → RPC succeeds → assert `auth.admin.getUserById(D1)` gone and household query (service role) returns no rows; separate shared household where D1 was a member: D1's transaction row survives with `created_by null`; anon client RPC → error. Update the suite's expected count.
- [ ] Commit `test(rls): account deletion drill`. (Runs only when the human does the key drill.)

### Task 7: Final gates

- [ ] `npx tsc --noEmit`, `npm test`, `npm run lint`, `npx expo export --platform web` all green; update Phase 8 spec status + memory; final commit.

## Self-review

Spec coverage: 1a/1b→Task 1, export→Tasks 2–3, UI→Task 5, i18n→Task 4, testing→Tasks 2/6/7. Type names match `lib/database.types.ts` usage in existing api modules. No placeholders in the SQL (the one authoritative artifact); TS interfaces named exactly as consumed.
