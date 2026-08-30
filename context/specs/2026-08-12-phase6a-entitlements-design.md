# Phase 6 Slice 6a — Entitlements & Feature Gating — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Phase 6 (Commercialization) = plans, entitlements, Apple/Google/web billing,
regional pricing, restore, webhooks. The live billing pieces are blocked on
external accounts (App Store Connect, Play Console, Stripe) and a backend. So
Phase 6 splits:

- **6a (this doc) — entitlements & feature gating:** the plan/entitlement model,
  a pure resolver, a client provider + gate mechanism, a manual (pre-billing)
  grant, and real gates on two premium features. Fully buildable now.
- **6b — billing integrations:** Apple IAP / Google Play / Stripe-web adapters, a
  webhook reconciliation Edge Function, restore purchase, regional pricing.
  Deferred; documented as an ADR so it drops onto 6a's model unchanged.

Follows established patterns: Supabase + RLS, `features/<domain>` boundary, a
React context provider (like `ActiveHouseholdProvider`), pure helpers unit-tested,
i18n ×3.

## Locked design decisions

1. **Per-household entitlement.** A subscription covers the whole household; gates
   check the *active household's* plan. (App-store purchases, tied to one payer's
   account, map to "payer upgrades the household.")
2. **Capability flags.** Each plan grants a set of named capabilities; a gate is
   "does the active plan include capability X?" The plan→capabilities map lives in
   one module. No numeric limits this slice.
3. **Manual grant (pre-billing).** An owner can switch the household plan on a
   Subscription screen for now; the row carries a `source` so 6b billing writes
   the same table. Owner-gated, labeled a placeholder, flagged for removal/guard
   before launch.

## Data model — migration `20260812000009_entitlements.sql`

### `household_subscriptions`
| column               | type          | notes                                              |
|----------------------|---------------|----------------------------------------------------|
| `id`                 | uuid pk       | `gen_random_uuid()`                                |
| `household_id`       | uuid not null | fk → households, cascade; **unique** (one per hh)  |
| `plan_code`          | text not null | check `in ('free','premium')`, default `'free'`    |
| `status`             | text not null | check `in ('active','canceled','expired')`, default `'active'` |
| `source`             | text not null | check `in ('manual','apple','google','stripe')`, default `'manual'` |
| `current_period_end` | timestamptz   | nullable (null = no expiry, e.g. manual/free)      |
| `updated_by`         | uuid          | fk → auth.users, nullable                          |
| `created_at`/`updated_at` | timestamptz | `set_updated_at()` trigger                        |

**No row = free** (the resolver treats absence as the free plan).

### RLS
- SELECT: `is_member_of(household_id)` (all members see the plan)
- INSERT/UPDATE/DELETE: `has_role_in(household_id, ['owner'])` — only the owner
  manages the subscription directly. (6b billing writes via the service role in a
  webhook Edge Function, which bypasses RLS.)
- Grants: `select, insert, update, delete` to `authenticated`.

### RPC `set_household_plan(_household_id uuid, _plan_code text) returns void`
`security definer`, `search_path=''`. Verifies caller `has_role_in(hh, ['owner'])`
and `_plan_code in ('free','premium')`; upserts the household's row
(`on conflict (household_id) do update`) setting `plan_code`, `status='active'`,
`source='manual'`, `current_period_end=null`, `updated_by=auth.uid()`. This is the
6a manual grant.

## Pure plan logic — `features/billing/plans.ts` (unit-tested)

```
export type PlanCode = 'free' | 'premium';
export type Capability =
  | 'multi_currency_dashboard'
  | 'retail_comparison'
  | 'coupons'
  | 'multiple_households'
  | 'unlimited_goals';

export const PLAN_CAPABILITIES: Record<PlanCode, Capability[]>;
// free: []; premium: [all five]

planIncludes(plan: PlanCode, cap: Capability): boolean

interface SubscriptionLike {
  plan_code: PlanCode; status: string; current_period_end: string | null;
}
resolvePlan(sub: SubscriptionLike | null, nowMs: number): PlanCode
// null -> 'free'; status !== 'active' -> 'free';
// plan 'premium' with current_period_end < now -> 'free'; else sub.plan_code
```

## Client

- `features/billing/api.ts`:
  - `getHouseholdSubscription(householdId): Promise<HouseholdSubscriptionRow | null>`
  - `setHouseholdPlan(householdId, planCode: PlanCode): Promise<void>` (RPC)
- `features/billing/EntitlementsProvider.tsx`: on active-household change, loads the
  subscription, computes `plan = resolvePlan(sub, Date.now())` and the capability
  set. Exposes `usePlan(): { plan: PlanCode; has: (c: Capability) => boolean; loading: boolean; refresh: () => void }`.
  Mounted inside `ActiveHouseholdProvider` in `app/_layout.tsx` (or the provider
  tree that already wraps authed screens).
- `app/subscription.tsx`: shows the current plan and its capabilities. If the
  caller is the household **owner**, shows a free/premium toggle (calls
  `setHouseholdPlan` then `refresh()`), with a visible "pre-billing placeholder"
  note. Linked from `app/(tabs)/more.tsx`.
- **Gates on real features:**
  - `app/grocery/compare/[id].tsx` → requires `retail_comparison`
  - `app/retail/coupons.tsx` → requires `coupons`
  Locked state: a card with a "Premium feature" message + a link to `/subscription`,
  shown instead of the feature body when `!has(capability)`.

## Other
- `HouseholdSubscriptionRow` (and reuse `PlanCode` from `plans.ts`) in
  `lib/database.types.ts`.
- `billing.*` i18n in en/fil/ar (plan names, capability labels, manage/toggle,
  locked-feature prompt, placeholder note) with matching key sets.
- `app/_layout.tsx` (or wherever `ActiveHouseholdProvider` is mounted): wrap with
  `EntitlementsProvider`.

## Tests
- Unit `tests/billing/plans.test.ts`: `planIncludes` (free excludes, premium
  includes); `resolvePlan` (null→free, canceled→free, expired premium→free, active
  premium→premium, active free→free).
- RLS: extend `tests/integration/rls-isolation.mjs` — owner A sets the household to
  premium via `set_household_plan` and it reads back; a non-owner member cannot set
  the plan (RPC raises); B (non-member) cannot read or set A's subscription; after
  B joins as a member, B can read the plan but still cannot set it.

## Success criteria
- An owner can switch the household plan on the Subscription screen; gated features
  lock/unlock accordingly across the household.
- `resolvePlan` correctly treats missing/expired/canceled as free.
- RLS: only owners write the subscription; members read; non-members are blocked.
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice → 6b)
Any real purchase flow (Apple IAP, Google Play, Stripe/web), webhooks and state
reconciliation, restore purchase, regional pricing, numeric/metered limits. The
manual toggle is a placeholder to be guarded/removed before launch. See the 6b ADR
(`2026-08-12-phase6b-billing-architecture.md`).
