# Phase 6 Slice 6a — Entitlements & Feature Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-household capability-flag entitlements: a subscription model + RLS, a pure plan resolver, an EntitlementsProvider + gates on two premium features, and an owner-only manual (pre-billing) plan toggle.

**Architecture:** A `household_subscriptions` table (one row per household, no row = free) with owner-only RLS and a `set_household_plan` RPC. A pure `plans.ts` maps plans→capabilities and resolves a subscription row to an effective plan. `EntitlementsProvider` (a context like `ActiveHouseholdProvider`) exposes `usePlan()`; the subscription screen and two gated features consume it.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), i18next, jest.

## Global Constraints

- **Per-household entitlement.** Gates check the active household's plan.
- **Capability flags** only (no numeric limits); the plan→capabilities map lives in `features/billing/plans.ts`.
- **RLS is the security boundary.** SELECT members; writes owner-only. The `set_household_plan` RPC re-checks owner.
- **Data access only through `features/billing/api.ts`.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000009_entitlements.sql`.
- **The manual toggle is a pre-billing placeholder** (owner-only, labeled) — 6b replaces it.
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Migration — household_subscriptions + RLS + RPC

**Files:**
- Create: `supabase/migrations/20260812000009_entitlements.sql`

**Interfaces:**
- Consumes: `public.households`, helpers `is_member_of`, `has_role_in`, `set_updated_at`.
- Produces: table `public.household_subscriptions`; RPC `public.set_household_plan(_household_id uuid, _plan_code text)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260812000009_entitlements.sql`:

```sql
-- ============================================================================
-- Phase 6 slice 6a — household entitlements (subscription state)
-- ============================================================================
-- One row per household; NO ROW = free plan. Owner-only writes; all members read.
-- 6a grants plans manually via set_household_plan (source='manual'); 6b billing
-- writes the SAME row with source apple/google/stripe from a webhook Edge Function.
-- ============================================================================

create table if not exists public.household_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null unique references public.households (id) on delete cascade,
  plan_code          text not null default 'free' check (plan_code in ('free','premium')),
  status             text not null default 'active' check (status in ('active','canceled','expired')),
  source             text not null default 'manual' check (source in ('manual','apple','google','stripe')),
  current_period_end timestamptz,
  updated_by         uuid references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_household_subscriptions_updated_at on public.household_subscriptions;
create trigger trg_household_subscriptions_updated_at
  before update on public.household_subscriptions
  for each row execute function public.set_updated_at();

-- Owner-only manual grant (upsert). 6b writers use the service role instead.
create or replace function public.set_household_plan(_household_id uuid, _plan_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
begin
  if _plan_code not in ('free','premium') then
    raise exception 'invalid plan';
  end if;
  if not public.has_role_in(_household_id, array['owner']::public.household_role[]) then
    raise exception 'only the owner can change the plan';
  end if;
  insert into public.household_subscriptions (household_id, plan_code, status, source, current_period_end, updated_by)
  values (_household_id, _plan_code, 'active', 'manual', null, _uid)
  on conflict (household_id) do update
    set plan_code = excluded.plan_code,
        status = 'active',
        source = 'manual',
        current_period_end = null,
        updated_by = _uid;
end;
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.household_subscriptions enable row level security;

drop policy if exists household_subscriptions_select on public.household_subscriptions;
create policy household_subscriptions_select on public.household_subscriptions
  for select using (public.is_member_of(household_id));

drop policy if exists household_subscriptions_insert on public.household_subscriptions;
create policy household_subscriptions_insert on public.household_subscriptions
  for insert with check (public.has_role_in(household_id, array['owner']::public.household_role[]));

drop policy if exists household_subscriptions_update on public.household_subscriptions;
create policy household_subscriptions_update on public.household_subscriptions
  for update using (public.has_role_in(household_id, array['owner']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner']::public.household_role[]));

drop policy if exists household_subscriptions_delete on public.household_subscriptions;
create policy household_subscriptions_delete on public.household_subscriptions
  for delete using (public.has_role_in(household_id, array['owner']::public.household_role[]));

grant select, insert, update, delete on public.household_subscriptions to authenticated;
```

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor, run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select table_name from information_schema.tables where table_schema='public' and table_name='household_subscriptions';
select proname from pg_proc where proname='set_household_plan';
```
Expected: 1 table, 1 function.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000009_entitlements.sql
git commit -m "feat(billing): 6a schema — household_subscriptions + owner RLS + set_household_plan RPC"
```

---

### Task 2: TypeScript type

**Files:**
- Modify: `lib/database.types.ts` (append after the Phase 5 coupon type)

**Interfaces:**
- Produces: `HouseholdSubscriptionRow`.

- [ ] **Step 1: Append the type**

At the end of `lib/database.types.ts`:

```typescript
// --- Phase 6 (6a): entitlements --------------------------------------------
export interface HouseholdSubscriptionRow {
  id: string;
  household_id: string;
  plan_code: 'free' | 'premium';
  status: 'active' | 'canceled' | 'expired';
  source: 'manual' | 'apple' | 'google' | 'stripe';
  current_period_end: string | null;
  updated_by: string | null;
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
git commit -m "feat(billing): add HouseholdSubscriptionRow type"
```

---

### Task 3: Pure plan logic (TDD)

**Files:**
- Create: `features/billing/plans.ts`
- Test: `tests/billing/plans.test.ts`

**Interfaces:**
- Produces:
  - `type PlanCode = 'free' | 'premium'`
  - `type Capability = 'multi_currency_dashboard' | 'retail_comparison' | 'coupons' | 'multiple_households' | 'unlimited_goals'`
  - `PLAN_CAPABILITIES: Record<PlanCode, Capability[]>`
  - `planIncludes(plan: PlanCode, cap: Capability): boolean`
  - `resolvePlan(sub: { plan_code: PlanCode; status: string; current_period_end: string | null } | null, nowMs: number): PlanCode`

- [ ] **Step 1: Write the failing tests**

Create `tests/billing/plans.test.ts`:

```typescript
import { PLAN_CAPABILITIES, planIncludes, resolvePlan } from '@/features/billing/plans';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

describe('planIncludes', () => {
  it('premium includes retail_comparison; free does not', () => {
    expect(planIncludes('premium', 'retail_comparison')).toBe(true);
    expect(planIncludes('free', 'retail_comparison')).toBe(false);
  });
  it('free grants no capabilities', () => {
    expect(PLAN_CAPABILITIES.free).toEqual([]);
  });
});

describe('resolvePlan', () => {
  it('treats no subscription as free', () => {
    expect(resolvePlan(null, now)).toBe('free');
  });
  it('treats a canceled subscription as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'canceled', current_period_end: null }, now)).toBe('free');
  });
  it('treats an expired premium as free', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now - DAY) }, now)).toBe('free');
  });
  it('honors an active premium with no expiry', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: null }, now)).toBe('premium');
  });
  it('honors an active premium not yet expired', () => {
    expect(resolvePlan({ plan_code: 'premium', status: 'active', current_period_end: iso(now + DAY) }, now)).toBe('premium');
  });
  it('returns free for an active free plan', () => {
    expect(resolvePlan({ plan_code: 'free', status: 'active', current_period_end: null }, now)).toBe('free');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/billing/plans.test.ts`
Expected: FAIL — cannot find module `@/features/billing/plans`.

- [ ] **Step 3: Write the implementation**

Create `features/billing/plans.ts`:

```typescript
/**
 * Plan definitions + resolution (pure). The plan->capabilities map is the single
 * place gates are assigned. `resolvePlan` turns a subscription row (from any
 * source: manual now, apple/google/stripe later) into the effective plan.
 */

export type PlanCode = 'free' | 'premium';

export type Capability =
  | 'multi_currency_dashboard'
  | 'retail_comparison'
  | 'coupons'
  | 'multiple_households'
  | 'unlimited_goals';

const ALL_CAPABILITIES: Capability[] = [
  'multi_currency_dashboard',
  'retail_comparison',
  'coupons',
  'multiple_households',
  'unlimited_goals',
];

export const PLAN_CAPABILITIES: Record<PlanCode, Capability[]> = {
  free: [],
  premium: ALL_CAPABILITIES,
};

export function planIncludes(plan: PlanCode, cap: Capability): boolean {
  return PLAN_CAPABILITIES[plan].includes(cap);
}

interface SubscriptionLike {
  plan_code: PlanCode;
  status: string;
  current_period_end: string | null;
}

/** Effective plan for a subscription row (or null). Missing/expired/canceled = free. */
export function resolvePlan(sub: SubscriptionLike | null, nowMs: number): PlanCode {
  if (!sub) return 'free';
  if (sub.status !== 'active') return 'free';
  if (sub.current_period_end != null && new Date(sub.current_period_end).getTime() < nowMs) {
    return 'free';
  }
  return sub.plan_code;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/billing/plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/billing/plans.ts tests/billing/plans.test.ts
git commit -m "feat(billing): pure plan/capability resolver + tests"
```

---

### Task 4: Billing data access

**Files:**
- Create: `features/billing/api.ts`

**Interfaces:**
- Consumes: `getSupabase`, `AppError`, `HouseholdSubscriptionRow`, `PlanCode`.
- Produces:
  - `getHouseholdSubscription(householdId: string): Promise<HouseholdSubscriptionRow | null>`
  - `setHouseholdPlan(householdId: string, planCode: PlanCode): Promise<void>`

- [ ] **Step 1: Write the module**

Create `features/billing/api.ts`:

```typescript
/**
 * Entitlement data access. Reads the household subscription (RLS: members read);
 * setHouseholdPlan calls the owner-checked RPC (6a manual grant). 6b billing
 * writes the same row server-side.
 */

import type { HouseholdSubscriptionRow } from '@/lib/database.types';
import type { PlanCode } from '@/features/billing/plans';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getHouseholdSubscription(
  householdId: string,
): Promise<HouseholdSubscriptionRow | null> {
  const { data, error } = await getSupabase()
    .from('household_subscriptions')
    .select('*')
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) fail('billing.errors.loadFailed', error);
  return (data ?? null) as HouseholdSubscriptionRow | null;
}

export async function setHouseholdPlan(householdId: string, planCode: PlanCode): Promise<void> {
  const { error } = await getSupabase().rpc('set_household_plan', {
    _household_id: householdId,
    _plan_code: planCode,
  });
  if (error) fail('billing.errors.saveFailed', error);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/billing/api.ts
git commit -m "feat(billing): data access (get subscription, set plan RPC)"
```

---

### Task 5: EntitlementsProvider + mount

**Files:**
- Create: `features/billing/EntitlementsProvider.tsx`
- Modify: `app/_layout.tsx` (wrap with the provider)

**Interfaces:**
- Consumes: `useActiveHousehold`, `getHouseholdSubscription`, `resolvePlan`, `planIncludes`, `PlanCode`, `Capability`.
- Produces: `EntitlementsProvider`, `usePlan(): { plan: PlanCode; has: (c: Capability) => boolean; loading: boolean; refresh: () => void }`.

- [ ] **Step 1: Create the provider**

Create `features/billing/EntitlementsProvider.tsx`:

```typescript
/**
 * Resolves the active household's plan into capabilities for gating. Reloads when
 * the active household changes; `refresh()` re-reads after a plan change.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getHouseholdSubscription } from '@/features/billing/api';
import type { Capability, PlanCode } from '@/features/billing/plans';
import { planIncludes, resolvePlan } from '@/features/billing/plans';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';

interface EntitlementsValue {
  plan: PlanCode;
  has: (c: Capability) => boolean;
  loading: boolean;
  refresh: () => void;
}

const EntitlementsContext = createContext<EntitlementsValue | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { active } = useActiveHousehold();
  const [plan, setPlan] = useState<PlanCode>('free');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!active) {
      setPlan('free');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await getHouseholdSubscription(active.id);
      setPlan(resolvePlan(sub, Date.now()));
    } catch {
      setPlan('free'); // fail closed
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<EntitlementsValue>(
    () => ({ plan, has: (c) => planIncludes(plan, c), loading, refresh: () => void load() }),
    [plan, loading, load],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function usePlan(): EntitlementsValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('usePlan must be used within <EntitlementsProvider>');
  return ctx;
}
```

- [ ] **Step 2: Mount the provider in the root layout**

In `app/_layout.tsx`, add the import:

```typescript
import { EntitlementsProvider } from '@/features/billing/EntitlementsProvider';
```

and wrap `RootNavigator` inside `ActiveHouseholdProvider`:

```typescript
      <AuthProvider>
        <ActiveHouseholdProvider>
          <EntitlementsProvider>
            <RootNavigator />
          </EntitlementsProvider>
        </ActiveHouseholdProvider>
      </AuthProvider>
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add features/billing/EntitlementsProvider.tsx app/_layout.tsx
git commit -m "feat(billing): EntitlementsProvider + usePlan, mounted in root layout"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`

**Interfaces:**
- Produces: a `billing` namespace with matching key sets.

- [ ] **Step 1: Add the `billing` block to `locales/en.json` (after `coupons`, before `errors`)**

```json
"billing": {
  "title": "Subscription",
  "open": "Subscription",
  "currentPlan": "Current plan",
  "planFree": "Free",
  "planPremium": "Premium",
  "capabilities": "Premium includes",
  "capMultiCurrency": "Multi-currency dashboard",
  "capRetailComparison": "Price comparison",
  "capCoupons": "Coupons",
  "capMultipleHouseholds": "Multiple households",
  "capUnlimitedGoals": "Unlimited savings goals",
  "manageOwnerOnly": "Only the household owner can change the plan.",
  "placeholderNote": "Manual switch for testing — real billing arrives with in-app purchases.",
  "switchToFree": "Switch to Free",
  "switchToPremium": "Switch to Premium",
  "lockedTitle": "Premium feature",
  "lockedBody": "This is included with Premium.",
  "manageCta": "Manage subscription",
  "errors": {
    "loadFailed": "Couldn't load the subscription.",
    "saveFailed": "Couldn't change the plan."
  }
}
```

- [ ] **Step 2: Add the same block to `locales/fil.json`**

```json
"billing": {
  "title": "Subscription",
  "open": "Subscription",
  "currentPlan": "Kasalukuyang plano",
  "planFree": "Libre",
  "planPremium": "Premium",
  "capabilities": "Kasama sa Premium",
  "capMultiCurrency": "Multi-currency na dashboard",
  "capRetailComparison": "Paghahambing ng presyo",
  "capCoupons": "Mga kupon",
  "capMultipleHouseholds": "Maraming sambahayan",
  "capUnlimitedGoals": "Walang limitasyong savings goals",
  "manageOwnerOnly": "Ang may-ari lang ng sambahayan ang makakapagpalit ng plano.",
  "placeholderNote": "Manual na pagpalit para sa pagsubok — darating ang tunay na billing kasama ng in-app purchases.",
  "switchToFree": "Lumipat sa Libre",
  "switchToPremium": "Lumipat sa Premium",
  "lockedTitle": "Premium na feature",
  "lockedBody": "Kasama ito sa Premium.",
  "manageCta": "Pamahalaan ang subscription",
  "errors": {
    "loadFailed": "Hindi ma-load ang subscription.",
    "saveFailed": "Hindi mapalitan ang plano."
  }
}
```

- [ ] **Step 3: Add the same block to `locales/ar.json`**

```json
"billing": {
  "title": "الاشتراك",
  "open": "الاشتراك",
  "currentPlan": "الخطة الحالية",
  "planFree": "مجاني",
  "planPremium": "مميّز",
  "capabilities": "يشمل المميّز",
  "capMultiCurrency": "لوحة متعددة العملات",
  "capRetailComparison": "مقارنة الأسعار",
  "capCoupons": "الكوبونات",
  "capMultipleHouseholds": "أسر متعددة",
  "capUnlimitedGoals": "أهداف ادخار غير محدودة",
  "manageOwnerOnly": "يمكن لمالك الأسرة فقط تغيير الخطة.",
  "placeholderNote": "تبديل يدوي للاختبار — تصل الفوترة الحقيقية مع الشراء داخل التطبيق.",
  "switchToFree": "التبديل إلى المجاني",
  "switchToPremium": "التبديل إلى المميّز",
  "lockedTitle": "ميزة مميّزة",
  "lockedBody": "هذه الميزة مضمّنة في المميّز.",
  "manageCta": "إدارة الاشتراك",
  "errors": {
    "loadFailed": "تعذّر تحميل الاشتراك.",
    "saveFailed": "تعذّر تغيير الخطة."
  }
}
```

- [ ] **Step 4: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(billing): i18n strings for en, fil, ar"
```

---

### Task 7: Subscription screen + More link + route

**Files:**
- Create: `app/subscription.tsx`
- Modify: `app/(tabs)/more.tsx` (add link)
- Modify: `app/_layout.tsx` (add a `Stack.Screen` for the title)

**Interfaces:**
- Consumes: `usePlan`; `getHouseholdSubscription`, `setHouseholdPlan` (billing api); `PLAN_CAPABILITIES`; `useActiveHousehold`; `useAuth`.

- [ ] **Step 1: Create the subscription screen**

Create `app/subscription.tsx`:

```typescript
/** Subscription: current plan + premium capabilities. Owner sees a manual
 *  plan toggle (pre-billing placeholder; 6b replaces it with real purchases). */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { setHouseholdPlan } from '@/features/billing/api';
import { PLAN_CAPABILITIES } from '@/features/billing/plans';
import type { Capability } from '@/features/billing/plans';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';

const CAP_LABEL: Record<Capability, string> = {
  multi_currency_dashboard: 'billing.capMultiCurrency',
  retail_comparison: 'billing.capRetailComparison',
  coupons: 'billing.capCoupons',
  multiple_households: 'billing.capMultipleHouseholds',
  unlimited_goals: 'billing.capUnlimitedGoals',
};

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { plan, refresh } = usePlan();
  const { active } = useActiveHousehold();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const isOwner = Boolean(active && user && active.created_by === user.id);

  async function switchTo(next: 'free' | 'premium') {
    if (!active) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await setHouseholdPlan(active.id, next);
      refresh();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.card}>
          <Text variant="caption" muted>{t('billing.currentPlan')}</Text>
          <Text variant="heading">
            {plan === 'premium' ? t('billing.planPremium') : t('billing.planFree')}
          </Text>
        </View>

        <Text variant="heading">{t('billing.capabilities')}</Text>
        <View style={styles.list}>
          {PLAN_CAPABILITIES.premium.map((c) => (
            <Text key={c} muted>• {t(CAP_LABEL[c])}</Text>
          ))}
        </View>

        <View style={styles.divider} />

        {isOwner ? (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('billing.placeholderNote')}</Text>
            {plan === 'premium' ? (
              <Button label={t('billing.switchToFree')} variant="secondary" onPress={() => switchTo('free')} loading={busy} />
            ) : (
              <Button label={t('billing.switchToPremium')} onPress={() => switchTo('premium')} loading={busy} />
            )}
          </View>
        ) : (
          <Text muted>{t('billing.manageOwnerOnly')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
});
```

- [ ] **Step 2: Link from the More tab**

In `app/(tabs)/more.tsx`, add after the retail link:

```typescript
      <Link href="/subscription" style={styles.link}>
        <Text style={{ color: palette.brand }}>{t('billing.open')}</Text>
      </Link>
```

- [ ] **Step 3: Register the route title**

In `app/_layout.tsx`, add to the `<Stack>` in `RootNavigator` (after the `signup` screen):

```typescript
      <Stack.Screen name="subscription" options={{ title: t('billing.title') }} />
```

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/subscription.tsx "app/(tabs)/more.tsx" app/_layout.tsx
git commit -m "feat(billing): subscription screen (owner manual toggle) + More link + route"
```

---

### Task 8: Gate two premium features

**Files:**
- Modify: `app/grocery/compare/[id].tsx` (gate on `retail_comparison`)
- Modify: `app/retail/coupons.tsx` (gate on `coupons`)

**Interfaces:**
- Consumes: `usePlan` (from EntitlementsProvider); `useRouter` (expo-router).

- [ ] **Step 1: Gate the comparison screen**

In `app/grocery/compare/[id].tsx`:

Add imports:

```typescript
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
```

(Note: `Button` may already be imported via `@/components/ui` — if the existing
import is `import { Text } from '@/components/ui';`, change it to
`import { Button, Text } from '@/components/ui';` instead of adding a second line.)

In the component, after `const { active } = useActiveHousehold();`, add:

```typescript
  const { has } = usePlan();
  const router = useRouter();
```

Immediately after the `if (loading) { ... }` early-return block, add a gate:

```typescript
  if (!has('retail_comparison')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 2: Gate the coupons screen**

In `app/retail/coupons.tsx`:

Add imports (merge `Button` into the existing `@/components/ui` import if present):

```typescript
import { useRouter } from 'expo-router';
import { usePlan } from '@/features/billing/EntitlementsProvider';
```

`useFocusEffect` is already imported from `expo-router`; add `useRouter` to that
existing import line instead of a duplicate: `import { useFocusEffect, useRouter } from 'expo-router';`

In the component, after `const { active } = useActiveHousehold();`, add:

```typescript
  const { has } = usePlan();
  const router = useRouter();
```

Immediately before the main `return (`, add a gate (the coupons screen has no
`loading` early-return, so place it right before `return`):

```typescript
  if (!has('coupons')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

(`Button`, `Text`, `SafeAreaView`, `View`, and the `styles.safe/content/card` are
already imported/defined in `coupons.tsx`.)

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/grocery/compare/[id].tsx" "app/retail/coupons.tsx"
git commit -m "feat(billing): gate price comparison + coupons behind premium capabilities"
```

---

### Task 9: Extend RLS integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `idB`).

- [ ] **Step 1: Add owner-set + non-member assertions (after the coupons setup block, before "B cannot read A's household")**

```javascript
  // --- entitlements: owner A sets the household plan; non-owners cannot -------
  const { error: planErr } = await a.rpc('set_household_plan', { _household_id: hid, _plan_code: 'premium' });
  ok('owner A can set the household to premium', !planErr);
  const { data: sub } = await a
    .from('household_subscriptions').select('plan_code, source').eq('household_id', hid).single();
  ok('subscription reads back as premium/manual', sub?.plan_code === 'premium' && sub?.source === 'manual');
```

- [ ] **Step 2: Add B-cannot assertions (in the "B cannot read A" section)**

```javascript
  // B CANNOT read or change A's subscription (not a member yet).
  const { data: bSub } = await b.from('household_subscriptions').select('id').eq('household_id', hid);
  ok("B cannot read A's subscription (RLS)", (bSub ?? []).length === 0);
  const { error: bPlanErr } = await b.rpc('set_household_plan', { _household_id: hid, _plan_code: 'premium' });
  ok("B cannot set A's plan via RPC", Boolean(bPlanErr));
```

- [ ] **Step 3: Add post-join member assertions (after "B can read coupons after joining")**

```javascript
  const { data: bSubAfter } = await b.from('household_subscriptions').select('plan_code').eq('household_id', hid);
  ok('B can read the plan after joining', (bSubAfter ?? []).length === 1);
  // B is a 'member', not owner → still cannot change the plan.
  const { error: bMemberPlanErr } = await b.rpc('set_household_plan', { _household_id: hid, _plan_code: 'free' });
  ok('member B still cannot change the plan', Boolean(bMemberPlanErr));
```

- [ ] **Step 4: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass. Remove the key after.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(billing): entitlement RLS — owner sets plan, members/non-members cannot"
```

---

### Task 10: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; unit suites pass (incl. `tests/billing/plans.test.ts`); RLS suite passes incl. entitlement assertions.

- [ ] **Step 2: Manual smoke (optional)**

More → Subscription → (as owner) Switch to Premium → open a grocery list → Compare
prices works; More → Retail → Coupons works. Switch to Free → both show the
"Premium feature → Manage subscription" locked card.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- household_subscriptions (unique per hh, plan/status/source/period, no-row=free) → Task 1 ✓; type Task 2 ✓
- owner-only RLS + set_household_plan RPC → Task 1 + Task 9 ✓
- capability flags + resolvePlan → Task 3 ✓
- billing data access → Task 4 ✓
- EntitlementsProvider / usePlan, mounted → Task 5 ✓
- subscription screen (owner manual toggle, placeholder note) → Task 7 ✓
- gates on price comparison + coupons → Task 8 ✓
- i18n → Task 6 ✓
- RLS isolation (owner sets, member/non-member cannot) → Task 9 ✓
- 6b deferred → ADR already written ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete. Task 8 gives explicit
import-merge guidance so no duplicate imports are introduced.

**Type consistency:** `PlanCode`/`Capability` (Task 3) used in Tasks 4/5/7/8.
`HouseholdSubscriptionRow` (Task 2) used in Task 4. `usePlan()` shape (Task 5:
`{ plan, has, loading, refresh }`) consumed in Tasks 7/8. `setHouseholdPlan(hid, planCode)`
(Task 4) called in Task 7. RPC name `set_household_plan` consistent across Tasks 1/4/9.
Owner check uses `active.created_by === user.id` (the create_household RPC makes the
creator the owner); the RPC is the authoritative server-side guard.
