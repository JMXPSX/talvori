# Phase 5 Slice 5b — Coupons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add household-scoped coupons (fixed/percent, retailer- or product-scoped) with a pure savings engine, a discovery screen, and applicable-coupon display on the product-prices screen.

**Architecture:** One new `coupons` table with RLS mirroring 5a retail rows and a CHECK enforcing the fixed-vs-percent shape. A pure `coupon.ts` helper computes status and applies a coupon to a base price. Client follows the `features/retail` boundary: `couponApi.ts` data access, `createCouponSchema`, a `coupons` discovery screen, and a coupons section on the product-prices screen. i18n in three locales.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.**
- **Fixed coupons carry a currency and apply only to a same-currency price.** Percent coupons are currency-agnostic.
- **RLS is the security boundary.** SELECT `public.is_member_of(household_id)`; writes `public.has_role_in(household_id, array[...]::public.household_role[])`.
- **Coupons are household-scoped** (`household_id` on the table).
- **Data access only through `features/retail/couponApi.ts`.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000007_coupons.sql`.
- **Never fake coupon clipping** — Level-1 only (show a source URL).
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Database migration — coupons table + RLS

**Files:**
- Create: `supabase/migrations/20260812000007_coupons.sql`

**Interfaces:**
- Consumes: `public.households`, `public.retailers`, `public.retailer_products`, helpers `is_member_of`, `has_role_in`, `set_updated_at`.
- Produces: table `public.coupons`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260812000007_coupons.sql`:

```sql
-- ============================================================================
-- Phase 5 slice 5b — Coupons (household-scoped)
-- ============================================================================
-- A coupon is a code/clip-able discount applied ON TOP of the effective shelf
-- price (min of regular/sale from 5a price_snapshots). Fixed or percent; scoped
-- to a retailer and optionally one retailer_product. Savings math is a pure
-- client helper; this table just stores the terms. Level-1 discovery only
-- (source_url) — no clipping/activation.
-- ============================================================================

create table if not exists public.coupons (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  retailer_id           uuid not null references public.retailers (id) on delete cascade,
  retailer_product_id   uuid references public.retailer_products (id) on delete cascade,
  title                 text not null,
  code                  text,
  source_url            text,
  notes                 text,
  discount_type         text not null check (discount_type in ('fixed','percent')),
  discount_amount_minor bigint check (discount_amount_minor >= 0),
  discount_percent      numeric check (discount_percent > 0 and discount_percent <= 100),
  currency_code         text check (currency_code ~ '^[A-Z]{3}$'),
  min_purchase_minor    bigint check (min_purchase_minor >= 0),
  max_discount_minor    bigint check (max_discount_minor >= 0),
  starts_at             timestamptz,
  expires_at            timestamptz,
  created_by            uuid not null references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint chk_coupon_shape check (
    (discount_type = 'fixed'
      and discount_amount_minor is not null
      and currency_code is not null
      and discount_percent is null)
    or (discount_type = 'percent'
      and discount_percent is not null
      and discount_amount_minor is null)
  )
);
create index if not exists idx_coupons_household on public.coupons (household_id, retailer_id);
create index if not exists idx_coupons_retailer_product on public.coupons (retailer_product_id);

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS (writers may delete; like price rows)
-- ===========================================================================
alter table public.coupons enable row level security;

drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons
  for select using (public.is_member_of(household_id));

drop policy if exists coupons_insert on public.coupons;
create policy coupons_insert on public.coupons
  for insert with check (
    public.has_role_in(household_id, array['owner','admin','member']::public.household_role[])
    and created_by = (select auth.uid()));

drop policy if exists coupons_update on public.coupons;
create policy coupons_update on public.coupons
  for update using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]))
  with check (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

drop policy if exists coupons_delete on public.coupons;
create policy coupons_delete on public.coupons
  for delete using (public.has_role_in(household_id, array['owner','admin','member']::public.household_role[]));

grant select, insert, update, delete on public.coupons to authenticated;
```

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor and run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select table_name from information_schema.tables where table_schema='public' and table_name='coupons';
select conname from pg_constraint where conname='chk_coupon_shape';
```
Expected: 1 table, 1 constraint.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000007_coupons.sql
git commit -m "feat(coupons): 5b schema — coupons table with fixed/percent shape + RLS"
```

---

### Task 2: TypeScript database type

**Files:**
- Modify: `lib/database.types.ts` (append after the 5a `SavedLocationRow`)

**Interfaces:**
- Produces: `CouponRow`, `CouponDiscountType`.

- [ ] **Step 1: Append the coupon type**

At the end of `lib/database.types.ts`:

```typescript
// --- Phase 5 (5b): coupons -------------------------------------------------
export type CouponDiscountType = 'fixed' | 'percent';

export interface CouponRow {
  id: string;
  household_id: string;
  retailer_id: string;
  retailer_product_id: string | null;
  title: string;
  code: string | null;
  source_url: string | null;
  notes: string | null;
  discount_type: CouponDiscountType;
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string;
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
git commit -m "feat(coupons): add CouponRow type"
```

---

### Task 3: Pure coupon helper (TDD)

**Files:**
- Create: `features/retail/coupon.ts`
- Test: `tests/retail/coupon.test.ts`

**Interfaces:**
- Consumes: `CouponRow` (structurally, via `CouponLike`).
- Produces:
  - `couponStatus(c, nowMs): 'scheduled'|'active'|'expired'`
  - `applyCoupon(c, basePriceMinor, currencyCode, nowMs): { applicable, finalMinor, savingsMinor, reason? }`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/coupon.test.ts`:

```typescript
import { applyCoupon, couponStatus } from '@/features/retail/coupon';
import type { CouponRow } from '@/lib/database.types';

const DAY = 24 * 3600 * 1000;
const now = 1_000 * DAY;
const iso = (ms: number) => new Date(ms).toISOString();

function coupon(over: Partial<CouponRow>): CouponRow {
  return {
    id: 'c', household_id: 'h', retailer_id: 'r', retailer_product_id: null,
    title: 'Test', code: null, source_url: null, notes: null,
    discount_type: 'fixed', discount_amount_minor: 500, discount_percent: null,
    currency_code: 'USD', min_purchase_minor: null, max_discount_minor: null,
    starts_at: null, expires_at: null, created_by: 'u', created_at: iso(now), updated_at: iso(now),
    ...over,
  };
}

describe('couponStatus', () => {
  it('is active with no dates', () => {
    expect(couponStatus(coupon({}), now)).toBe('active');
  });
  it('is expired past expires_at', () => {
    expect(couponStatus(coupon({ expires_at: iso(now - DAY) }), now)).toBe('expired');
  });
  it('is scheduled before starts_at', () => {
    expect(couponStatus(coupon({ starts_at: iso(now + DAY) }), now)).toBe('scheduled');
  });
});

describe('applyCoupon', () => {
  it('applies a fixed discount', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 500, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 1500, savingsMinor: 500 });
  });
  it('caps a fixed discount at the base price', () => {
    const r = applyCoupon(coupon({ discount_amount_minor: 5000, currency_code: 'USD' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: true, finalMinor: 0, savingsMinor: 2000 });
  });
  it('applies a percent discount', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 10, currency_code: null }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1800, savingsMinor: 200 });
  });
  it('respects a percent max-discount cap', () => {
    const r = applyCoupon(
      coupon({ discount_type: 'percent', discount_amount_minor: null, discount_percent: 50,
        currency_code: null, max_discount_minor: 300 }),
      2000, 'USD', now,
    );
    expect(r).toEqual({ applicable: true, finalMinor: 1700, savingsMinor: 300 });
  });
  it('is not applicable below min purchase', () => {
    const r = applyCoupon(coupon({ min_purchase_minor: 3000 }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'min_purchase' });
  });
  it('is not applicable on a currency mismatch (fixed)', () => {
    const r = applyCoupon(coupon({ currency_code: 'EUR' }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'currency' });
  });
  it('is not applicable when expired', () => {
    const r = applyCoupon(coupon({ expires_at: iso(now - DAY) }), 2000, 'USD', now);
    expect(r).toEqual({ applicable: false, finalMinor: 2000, savingsMinor: 0, reason: 'expired' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/coupon.test.ts`
Expected: FAIL — cannot find module `@/features/retail/coupon`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/coupon.ts`:

```typescript
/**
 * Pure coupon math. A coupon applies ON TOP of an effective base price (the
 * caller passes min(regular, sale)). Fixed coupons must match the price currency;
 * percent coupons are currency-agnostic. Savings never exceed the base price.
 */

export type CouponStatus = 'scheduled' | 'active' | 'expired';

export interface CouponLike {
  discount_type: 'fixed' | 'percent';
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

export interface ApplyResult {
  applicable: boolean;
  finalMinor: number;
  savingsMinor: number;
  reason?: 'expired' | 'scheduled' | 'currency' | 'min_purchase';
}

export function couponStatus(
  c: Pick<CouponLike, 'starts_at' | 'expires_at'>,
  nowMs: number,
): CouponStatus {
  if (c.expires_at != null && new Date(c.expires_at).getTime() < nowMs) return 'expired';
  if (c.starts_at != null && new Date(c.starts_at).getTime() > nowMs) return 'scheduled';
  return 'active';
}

export function applyCoupon(
  c: CouponLike,
  basePriceMinor: number,
  currencyCode: string,
  nowMs: number,
): ApplyResult {
  const notApplicable = (reason: ApplyResult['reason']): ApplyResult => ({
    applicable: false,
    finalMinor: basePriceMinor,
    savingsMinor: 0,
    reason,
  });

  const status = couponStatus(c, nowMs);
  if (status === 'expired') return notApplicable('expired');
  if (status === 'scheduled') return notApplicable('scheduled');
  if (c.discount_type === 'fixed' && c.currency_code !== currencyCode) {
    return notApplicable('currency');
  }
  if (c.min_purchase_minor != null && basePriceMinor < c.min_purchase_minor) {
    return notApplicable('min_purchase');
  }

  let raw: number;
  if (c.discount_type === 'fixed') {
    raw = c.discount_amount_minor ?? 0;
  } else {
    raw = Math.round((basePriceMinor * (c.discount_percent ?? 0)) / 100);
  }
  const cap = c.max_discount_minor ?? Infinity;
  const savingsMinor = Math.max(0, Math.min(raw, cap, basePriceMinor));
  return { applicable: true, finalMinor: basePriceMinor - savingsMinor, savingsMinor };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/coupon.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add features/retail/coupon.ts tests/retail/coupon.test.ts
git commit -m "feat(coupons): pure savings engine (couponStatus + applyCoupon) + tests"
```

---

### Task 4: Validation schema

**Files:**
- Modify: `features/retail/schemas.ts` (append `createCouponSchema`)

**Interfaces:**
- Produces: `createCouponSchema` + `CreateCouponInput`.

- [ ] **Step 1: Append the coupon schema**

Add to `features/retail/schemas.ts` (reuses the existing `currency`, `optionalText`, `optionalMajor` helpers already defined in that file):

```typescript
export const createCouponSchema = z
  .object({
    retailerId: z.string().uuid(),
    retailerProductId: z.string().uuid().optional(),
    title: name,
    code: optionalText(60),
    sourceUrl: optionalText(300),
    discountType: z.enum(['fixed', 'percent']),
    // fixed:
    amountMajor: optionalMajor,
    currencyCode: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .refine((s) => s === '' || /^[A-Z]{3}$/.test(s), { message: 'invalid_currency' })
      .optional()
      .transform((v) => (v ? v : undefined)),
    // percent:
    percent: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 100), {
        message: 'invalid_percent',
      }),
    minPurchaseMajor: optionalMajor,
    maxDiscountMajor: optionalMajor,
    expiresAt: optionalText(40),
  })
  .refine(
    (v) =>
      v.discountType === 'fixed'
        ? v.amountMajor !== undefined && v.currencyCode !== undefined
        : v.percent !== undefined,
    { message: 'incomplete_discount', path: ['discountType'] },
  );

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/schemas.ts
git commit -m "feat(coupons): zod createCouponSchema"
```

---

### Task 5: Coupon data access

**Files:**
- Create: `features/retail/couponApi.ts`

**Interfaces:**
- Consumes: `getSupabase()`, `AppError`, `CouponRow`, `RetailerRow`, `RetailerProductRow`, `listRetailerProducts` from `features/retail/api`.
- Produces:
  - interface `CouponWithRefs extends CouponRow { retailer, retailer_product }`
  - interface `CreateCouponData` (minor-unit input from the screen)
  - `listCoupons(hid): CouponWithRefs[]`
  - `listCouponsForProduct(productId): CouponWithRefs[]`
  - `createCoupon(hid, data): CouponRow`
  - `deleteCoupon(id): void`

- [ ] **Step 1: Write the module**

Create `features/retail/couponApi.ts`:

```typescript
/**
 * Coupon data access. Household scoping + writer/viewer permission via RLS.
 * Amounts cross this boundary as integer minor units (screen converts from major).
 */

import type { CouponRow, RetailerProductRow, RetailerRow } from '@/lib/database.types';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import { listRetailerProducts } from '@/features/retail/api';

export interface CouponWithRefs extends CouponRow {
  retailer: Pick<RetailerRow, 'id' | 'name'> | null;
  retailer_product: Pick<RetailerProductRow, 'id' | 'display_name'> | null;
}

/** Minor-unit coupon input assembled by the screen (major->minor already done). */
export interface CreateCouponData {
  retailerId: string;
  retailerProductId?: string;
  title: string;
  code?: string;
  sourceUrl?: string;
  discountType: 'fixed' | 'percent';
  discountAmountMinor?: number;
  discountPercent?: number;
  currencyCode?: string;
  minPurchaseMinor?: number;
  maxDiscountMinor?: number;
  expiresAt?: string;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}
async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new AppError('unauthorized', { messageKey: 'errors.unauthorized' });
  return data.user.id;
}

const SELECT =
  '*, retailer:retailers(id,name), retailer_product:retailer_products(id,display_name)';

export async function listCoupons(hid: string): Promise<CouponWithRefs[]> {
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .eq('household_id', hid)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  return (data ?? []) as unknown as CouponWithRefs[];
}

/**
 * Coupons applicable to a product: those scoped to any of the product's
 * retailer_products, OR retailer-wide (null retailer_product_id) for any retailer
 * the product is sold at. Fetched by retailer, filtered in JS to avoid fragile
 * PostgREST `or()` strings.
 */
export async function listCouponsForProduct(productId: string): Promise<CouponWithRefs[]> {
  const rps = await listRetailerProducts(productId);
  if (rps.length === 0) return [];
  const retailerIds = Array.from(new Set(rps.map((r) => r.retailer_id)));
  const rpIds = new Set(rps.map((r) => r.id));
  const { data, error } = await getSupabase()
    .from('coupons')
    .select(SELECT)
    .in('retailer_id', retailerIds)
    .order('created_at', { ascending: false });
  if (error) fail('coupons.errors.loadFailed', error);
  const rows = (data ?? []) as unknown as CouponWithRefs[];
  return rows.filter(
    (c) => c.retailer_product_id == null || rpIds.has(c.retailer_product_id),
  );
}

export async function createCoupon(hid: string, data: CreateCouponData): Promise<CouponRow> {
  const created_by = await currentUserId();
  const { data: row, error } = await getSupabase()
    .from('coupons')
    .insert({
      household_id: hid,
      retailer_id: data.retailerId,
      retailer_product_id: data.retailerProductId ?? null,
      title: data.title,
      code: data.code ?? null,
      source_url: data.sourceUrl ?? null,
      discount_type: data.discountType,
      discount_amount_minor: data.discountAmountMinor ?? null,
      discount_percent: data.discountPercent ?? null,
      currency_code: data.currencyCode ?? null,
      min_purchase_minor: data.minPurchaseMinor ?? null,
      max_discount_minor: data.maxDiscountMinor ?? null,
      expires_at: data.expiresAt ?? null,
      created_by,
    })
    .select('*')
    .single();
  if (error) fail('coupons.errors.saveFailed', error);
  return row as CouponRow;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await getSupabase().from('coupons').delete().eq('id', id);
  if (error) fail('coupons.errors.deleteFailed', error);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add features/retail/couponApi.ts
git commit -m "feat(coupons): data access (list, list-for-product, create, delete)"
```

---

### Task 6: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json`

**Interfaces:**
- Produces: a `coupons` namespace present in all three files with identical key sets.

- [ ] **Step 1: Add the `coupons` block to each locale (place after `retail`, before `errors`)**

English (`locales/en.json`):

```json
"coupons": {
  "title": "Coupons",
  "open": "Coupons",
  "active": "Active",
  "expired": "Expired",
  "scheduled": "Scheduled",
  "addTitle": "Add coupon",
  "couponTitle": "Title",
  "chooseRetailer": "Retailer",
  "chooseProduct": "Product (optional)",
  "anyProduct": "Any product",
  "discountType": "Discount type",
  "fixed": "Fixed amount",
  "percent": "Percent",
  "amount": "Amount",
  "percentValue": "Percent (0-100)",
  "currency": "Currency",
  "minPurchase": "Minimum purchase",
  "maxDiscount": "Max discount",
  "code": "Code",
  "sourceUrl": "Where to get it (URL)",
  "expiresAt": "Expires (YYYY-MM-DD)",
  "addCta": "Add coupon",
  "empty": "No coupons yet.",
  "applicableTitle": "Coupons",
  "expectedFinal": "Final: {{price}}",
  "expectedSavings": "Save {{amount}}",
  "notApplicable": "Not applicable here",
  "openLink": "Get coupon",
  "delete": "Delete",
  "errors": {
    "loadFailed": "Couldn't load coupons.",
    "saveFailed": "Couldn't save the coupon.",
    "deleteFailed": "Couldn't delete the coupon."
  }
}
```

Filipino (`locales/fil.json`):

```json
"coupons": {
  "title": "Mga kupon",
  "open": "Mga kupon",
  "active": "Aktibo",
  "expired": "Paso na",
  "scheduled": "Nakatakda",
  "addTitle": "Magdagdag ng kupon",
  "couponTitle": "Pamagat",
  "chooseRetailer": "Tindahan",
  "chooseProduct": "Produkto (opsyonal)",
  "anyProduct": "Kahit anong produkto",
  "discountType": "Uri ng diskwento",
  "fixed": "Takdang halaga",
  "percent": "Porsyento",
  "amount": "Halaga",
  "percentValue": "Porsyento (0-100)",
  "currency": "Pera",
  "minPurchase": "Pinakamababang bili",
  "maxDiscount": "Pinakamataas na diskwento",
  "code": "Code",
  "sourceUrl": "Saan makukuha (URL)",
  "expiresAt": "Paso (YYYY-MM-DD)",
  "addCta": "Magdagdag ng kupon",
  "empty": "Wala pang kupon.",
  "applicableTitle": "Mga kupon",
  "expectedFinal": "Panghuli: {{price}}",
  "expectedSavings": "Makakatipid ng {{amount}}",
  "notApplicable": "Hindi magamit dito",
  "openLink": "Kunin ang kupon",
  "delete": "Burahin",
  "errors": {
    "loadFailed": "Hindi ma-load ang mga kupon.",
    "saveFailed": "Hindi ma-save ang kupon.",
    "deleteFailed": "Hindi mabura ang kupon."
  }
}
```

Arabic (`locales/ar.json`):

```json
"coupons": {
  "title": "الكوبونات",
  "open": "الكوبونات",
  "active": "نشط",
  "expired": "منتهٍ",
  "scheduled": "مجدول",
  "addTitle": "إضافة كوبون",
  "couponTitle": "العنوان",
  "chooseRetailer": "المتجر",
  "chooseProduct": "المنتج (اختياري)",
  "anyProduct": "أي منتج",
  "discountType": "نوع الخصم",
  "fixed": "مبلغ ثابت",
  "percent": "نسبة مئوية",
  "amount": "المبلغ",
  "percentValue": "النسبة (0-100)",
  "currency": "العملة",
  "minPurchase": "الحد الأدنى للشراء",
  "maxDiscount": "أقصى خصم",
  "code": "الرمز",
  "sourceUrl": "أين تحصل عليه (رابط)",
  "expiresAt": "ينتهي (YYYY-MM-DD)",
  "addCta": "إضافة كوبون",
  "empty": "لا توجد كوبونات بعد.",
  "applicableTitle": "الكوبونات",
  "expectedFinal": "النهائي: {{price}}",
  "expectedSavings": "وفّر {{amount}}",
  "notApplicable": "غير قابل للتطبيق هنا",
  "openLink": "احصل على الكوبون",
  "delete": "حذف",
  "errors": {
    "loadFailed": "تعذّر تحميل الكوبونات.",
    "saveFailed": "تعذّر حفظ الكوبون.",
    "deleteFailed": "تعذّر حذف الكوبون."
  }
}
```

- [ ] **Step 2: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (matching key sets).

- [ ] **Step 3: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(coupons): i18n strings for en, fil, ar"
```

---

### Task 7: Coupons discovery screen + hub link + layout entry

**Files:**
- Create: `app/retail/coupons.tsx`
- Modify: `app/retail/_layout.tsx` (add the `coupons` screen)
- Modify: `app/retail/index.tsx` (add a link to `/retail/coupons`)

**Interfaces:**
- Consumes: `listCoupons`, `createCoupon`, `deleteCoupon`, `CouponWithRefs` from `couponApi`; `listRetailers`, `listRetailerProducts` from `api`; `createCouponSchema`; `couponStatus`; `formatAmount`, `toMinorUnits`; `useActiveHousehold`.

- [ ] **Step 1: Add the coupons screen to the retail stack layout**

In `app/retail/_layout.tsx`, add after the `locations` screen line:

```typescript
      <Stack.Screen name="coupons" options={{ title: t('coupons.title') }} />
```

- [ ] **Step 2: Add a coupons link to the retail hub**

In `app/retail/index.tsx`, extend the `rowLinks` View (currently containing only the Products link) to also link coupons:

```typescript
        <View style={styles.rowLinks}>
          <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
          <Link href="/retail/coupons"><Text style={{ color: palette.brand }}>{t('coupons.title')}</Text></Link>
        </View>
```

- [ ] **Step 3: Create the coupons screen**

Create `app/retail/coupons.tsx`:

```typescript
/** Coupons discovery: active/expired sections + add coupon (fixed or percent). */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { listRetailerProducts, listRetailers } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
} from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import { createCouponSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerProductWithRetailer } from '@/features/retail/api';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function CouponsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();

  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [products, setProducts] = useState<RetailerProductWithRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [rpId, setRpId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [percent, setPercent] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [cs, rs] = await Promise.all([listCoupons(active.id), listRetailers(active.id)]);
      setCoupons(cs);
      setRetailers(rs);
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

  async function onPickRetailer(id: string) {
    setRetailerId(id);
    setRpId(null);
    // Products for a retailer aren't directly listable; gather from all products'
    // retailer_products is out of scope — the retailer-product picker uses the
    // product screen instead. Here we keep coupons retailer-wide by default.
    setProducts([]);
  }

  async function onAdd() {
    if (!active || !retailerId) {
      setErrorKey('coupons.errors.saveFailed');
      return;
    }
    const result = validate(createCouponSchema, {
      retailerId,
      retailerProductId: rpId ?? undefined,
      title,
      code,
      sourceUrl: url,
      discountType: type,
      amountMajor: type === 'fixed' ? amount : undefined,
      currencyCode: type === 'fixed' ? currency : undefined,
      percent: type === 'percent' ? percent : undefined,
      minPurchaseMajor: minPurchase,
      maxDiscountMajor: maxDiscount,
      expiresAt: expires,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    const ccy = type === 'fixed' ? (result.data.currencyCode as string) : active.reporting_currency_code;
    setSubmitting(true);
    try {
      await createCoupon(active.id, {
        retailerId: result.data.retailerId,
        retailerProductId: result.data.retailerProductId,
        title: result.data.title,
        code: result.data.code,
        sourceUrl: result.data.sourceUrl,
        discountType: result.data.discountType,
        discountAmountMinor:
          result.data.discountType === 'fixed' && result.data.amountMajor !== undefined
            ? toMinorUnits(result.data.amountMajor, ccy)
            : undefined,
        currencyCode: result.data.discountType === 'fixed' ? result.data.currencyCode : undefined,
        discountPercent: result.data.discountType === 'percent' ? result.data.percent : undefined,
        minPurchaseMinor:
          result.data.minPurchaseMajor === undefined ? undefined : toMinorUnits(result.data.minPurchaseMajor, ccy),
        maxDiscountMinor:
          result.data.maxDiscountMajor === undefined ? undefined : toMinorUnits(result.data.maxDiscountMajor, ccy),
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt).toISOString() : undefined,
      });
      setTitle(''); setAmount(''); setPercent(''); setMinPurchase(''); setMaxDiscount('');
      setCode(''); setUrl(''); setExpires('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCoupon(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  const now = Date.now();
  const activeCoupons = coupons.filter((c) => couponStatus(c, now) !== 'expired');
  const expiredCoupons = coupons.filter((c) => couponStatus(c, now) === 'expired');

  function describe(c: CouponWithRefs): string {
    if (c.discount_type === 'fixed' && c.discount_amount_minor != null && c.currency_code) {
      return formatAmount(c.discount_amount_minor, c.currency_code);
    }
    return `${c.discount_percent ?? 0}%`;
  }

  function renderCoupon(c: CouponWithRefs) {
    return (
      <View key={c.id} style={styles.card}>
        <View style={styles.cardRow}>
          <Text variant="heading">{c.title}</Text>
          <Text variant="heading">{describe(c)}</Text>
        </View>
        <Text variant="caption" muted>
          {c.retailer?.name ?? '—'}
          {c.retailer_product?.display_name ? ` · ${c.retailer_product.display_name}` : ''}
          {c.code ? ` · ${c.code}` : ''}
        </Text>
        <View style={styles.cardRow}>
          {c.source_url ? (
            <Pressable onPress={() => void Linking.openURL(c.source_url as string)}>
              <Text variant="caption" style={{ color: palette.brand }}>{t('coupons.openLink')}</Text>
            </Pressable>
          ) : <View />}
          <Pressable onPress={() => onDelete(c.id)}>
            <Text variant="caption" style={{ color: palette.danger }}>{t('coupons.delete')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : coupons.length === 0 ? (
          <Text muted>{t('coupons.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {activeCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.active')}</Text>
                {activeCoupons.map(renderCoupon)}
              </>
            )}
            {expiredCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.expired')}</Text>
                {expiredCoupons.map(renderCoupon)}
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('coupons.addTitle')}</Text>
        <View style={styles.form}>
          <Text variant="caption" muted>{t('coupons.chooseRetailer')}</Text>
          <View style={styles.chips}>
            {retailers.map((r) => {
              const on = r.id === retailerId;
              return (
                <Pressable key={r.id} onPress={() => void onPickRetailer(r.id)}
                  style={[styles.chip, on ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{r.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField label={t('coupons.couponTitle')} value={title} onChangeText={setTitle}
            autoCapitalize="sentences" error={fieldErrors.title ? t('errors.validation') : undefined} />

          <Text variant="caption" muted>{t('coupons.discountType')}</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setType('fixed')} style={[styles.chip, type === 'fixed' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'fixed' ? palette.white : palette.text }}>{t('coupons.fixed')}</Text>
            </Pressable>
            <Pressable onPress={() => setType('percent')} style={[styles.chip, type === 'percent' ? styles.chipActive : null]}>
              <Text variant="caption" style={{ color: type === 'percent' ? palette.white : palette.text }}>{t('coupons.percent')}</Text>
            </Pressable>
          </View>

          {type === 'fixed' ? (
            <>
              <TextField label={t('coupons.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric"
                error={fieldErrors.amountMajor ? t('errors.validation') : undefined} />
              <TextField label={t('coupons.currency')} value={currency} onChangeText={setCurrency}
                autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
            </>
          ) : (
            <TextField label={t('coupons.percentValue')} value={percent} onChangeText={setPercent} keyboardType="numeric"
              error={fieldErrors.percent ? t('errors.validation') : undefined} />
          )}

          <TextField label={t('coupons.minPurchase')} value={minPurchase} onChangeText={setMinPurchase} keyboardType="numeric" />
          <TextField label={t('coupons.maxDiscount')} value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
          <TextField label={t('coupons.code')} value={code} onChangeText={setCode} />
          <TextField label={t('coupons.sourceUrl')} value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TextField label={t('coupons.expiresAt')} value={expires} onChangeText={setExpires} autoCapitalize="none" />
          <Button label={submitting ? t('auth.processing') : t('coupons.addCta')} onPress={onAdd} loading={submitting} />
        </View>
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
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
```

Note: this discovery screen creates retailer-wide coupons (no product picker —
product-scoped coupons are added from the product screen in a later slice if
needed; the schema/API already support `retailerProductId`). The unused `products`
state + `listRetailerProducts` import are intentionally omitted to avoid dead code:
remove `products`/`setProducts` and the `listRetailerProducts`/`RetailerProductWithRetailer`
imports if the linter flags them. (Keep only what the screen uses.)

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean. (If typecheck flags unused `products`/`listRetailerProducts`, delete those lines.)

- [ ] **Step 5: Commit**

```bash
git add "app/retail/coupons.tsx" "app/retail/_layout.tsx" "app/retail/index.tsx"
git commit -m "feat(coupons): discovery screen + hub link + stack entry"
```

---

### Task 8: Applicable coupons on the product-prices screen

**Files:**
- Modify: `app/retail/product/[id].tsx`

**Interfaces:**
- Consumes: `listCouponsForProduct`, `CouponWithRefs` from `couponApi`; `applyCoupon` from `coupon`; existing `prices`, `product`, `formatAmount`.

- [ ] **Step 1: Load applicable coupons in the product screen**

In `app/retail/product/[id].tsx`, add the imports near the other feature imports:

```typescript
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
```

Add coupon state alongside the other `useState` hooks:

```typescript
  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
```

In `load()`, extend the `Promise.all` destructure to also fetch coupons — change:

```typescript
      const [p, pr, ls, rs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
      ]);
```

to:

```typescript
      const [p, pr, ls, rs, cs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
        listCouponsForProduct(productId),
      ]);
      setCoupons(cs);
```

- [ ] **Step 2: Render an applicable-coupons section**

Immediately after the `sorted`-prices `View style={styles.list}` block (before the
`<View style={styles.divider} />` that precedes "linkRetailer"), insert a coupons
section. It computes savings against the cheapest current effective price:

```typescript
        {coupons.length > 0 && sorted.length > 0 && (() => {
          const cheapest = sorted[0];
          const base = cheapest.sale_price_minor ?? cheapest.regular_price_minor;
          const nowMs = Date.now();
          return (
            <View style={styles.list}>
              <Text variant="heading">{t('coupons.applicableTitle')}</Text>
              {coupons.map((c) => {
                const r = applyCoupon(c, base, cheapest.currency_code, nowMs);
                return (
                  <View key={c.id} style={styles.card}>
                    <Text variant="heading">{c.title}</Text>
                    <Text variant="caption" muted>{c.retailer?.name ?? '—'}</Text>
                    {r.applicable ? (
                      <Text variant="caption" style={{ color: palette.brand }}>
                        {t('coupons.expectedFinal', { price: formatAmount(r.finalMinor, cheapest.currency_code) })}
                        {' · '}
                        {t('coupons.expectedSavings', { amount: formatAmount(r.savingsMinor, cheapest.currency_code) })}
                      </Text>
                    ) : (
                      <Text variant="caption" muted>{t('coupons.notApplicable')}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}
```

- [ ] **Step 3: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/retail/product/[id].tsx"
git commit -m "feat(coupons): show applicable coupons + expected savings on product screen"
```

---

### Task 9: Extend RLS integration test for coupons

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `idB`, `ret`, `rp` from the retail block).

- [ ] **Step 1: Add coupon setup + constraint check (after the retail saved-location block, before "B cannot read A's household")**

```javascript
  // --- coupons: A creates a valid coupon; malformed one is rejected ---------
  const { data: coup, error: coupErr } = await a
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: '10% off',
      discount_type: 'percent', discount_percent: 10, created_by: idA })
    .select('id').single();
  ok('A can create a percent coupon', !coupErr && Boolean(coup?.id));

  // CHECK: a percent coupon may not carry a fixed amount.
  const { error: badErr } = await a
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: 'bad',
      discount_type: 'percent', discount_percent: 10, discount_amount_minor: 500, created_by: idA });
  ok('coupon CHECK rejects a mixed fixed/percent shape', Boolean(badErr));
```

- [ ] **Step 2: Add B-cannot-access assertions (in the "B cannot read A" section)**

```javascript
  // B CANNOT read or write A's coupons (not a member yet).
  const { data: bCoupons } = await b.from('coupons').select('id').eq('household_id', hid);
  ok("B cannot read A's coupons (RLS)", (bCoupons ?? []).length === 0);
  const { error: bCoupErr } = await b
    .from('coupons')
    .insert({ household_id: hid, retailer_id: ret?.id, title: 'x',
      discount_type: 'percent', discount_percent: 5, created_by: idB });
  ok("B cannot create a coupon in A's household", Boolean(bCoupErr));
```

- [ ] **Step 3: Add a post-join read assertion (after "B can read retailers after joining")**

```javascript
  const { data: bCouponsAfter } = await b.from('coupons').select('id').eq('household_id', hid);
  ok('B can read coupons after joining', (bCouponsAfter ?? []).length >= 1);
```

- [ ] **Step 4: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass. Remove the key after.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(coupons): RLS isolation + fixed/percent CHECK constraint"
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
Expected: typecheck clean; unit suites pass (incl. `tests/retail/coupon.test.ts`); RLS suite passes incl. coupon assertions.

- [ ] **Step 2: Manual smoke (optional)**

More → Retail → Coupons → add a percent coupon for a retailer → confirm it appears
under Active. Open a product sold at that retailer → confirm the coupon shows an
expected final price + savings against the cheapest price.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- coupons table (fixed/percent, min/cap, expiry, code, source_url, scope) → Task 1 ✓; type Task 2 ✓
- fixed-vs-percent CHECK → Task 1 + Task 9 assertion ✓
- savings engine (couponStatus, applyCoupon, currency guard, min-purchase, cap, floor at 0) → Task 3 ✓
- data access incl. list-for-product (product's retailer_products OR retailer-wide) → Task 5 ✓
- discovery screen (active/expired, add, Level-1 URL) → Task 7 ✓
- applicable coupons + expected savings on product screen → Task 8 ✓
- i18n en/fil/ar → Task 6 ✓
- RLS isolation → Task 9 ✓
- grocery matching / BOGO / loyalty / L2-L3 → explicitly deferred (not built) ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete. Task 7 notes to drop
the unused `products`/`listRetailerProducts` lines if the linter flags them — to
keep the shipped screen dead-code-free, omit them from the start (create-retailer-wide
coupons only this slice).

**Type consistency:** `CouponRow`/`CouponDiscountType` (Task 2) used in Tasks 3/5.
`CouponWithRefs`, `CreateCouponData` (Task 5) used in Tasks 7/8. `createCouponSchema`
(Task 4) fields (`amountMajor`, `currencyCode`, `percent`, `minPurchaseMajor`,
`maxDiscountMajor`, `expiresAt`) match the screen in Task 7. `applyCoupon`/`couponStatus`
signatures (Task 3) match Tasks 7/8. `createCoupon` takes minor units (`CreateCouponData`);
the screen converts via `toMinorUnits`.
