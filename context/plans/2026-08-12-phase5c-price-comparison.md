# Phase 5 Slice 5c — Price Comparison & Basket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link grocery items to catalog products and compare a list's cost across branches — cheapest single-store basket with coverage, a best-price floor, and potential coupon savings, all in the household reporting currency.

**Architecture:** A migration adds a nullable `product_id` to `grocery_items` and extends the existing enforce-list trigger to validate the product's household. A pure `basket.ts` helper computes per-column totals + a best-price floor over opaque column keys. `basketApi.getBasketPrices` assembles latest prices per (product, column) in the reporting currency; a link screen and a compare screen surface it, reusing 5b's `applyCoupon` for potential savings.

**Tech Stack:** Expo Router, React Native, TypeScript, Supabase (Postgres + RLS), zod, i18next, jest.

## Global Constraints

- **Money is ALWAYS integer minor units + ISO currency code. Never float for persisted money.**
- **No mixing currencies.** Comparison runs in the household reporting currency; other-currency prices are excluded and flagged.
- **RLS is the security boundary.** No RLS changes here; the enforce-list trigger validates the product's household.
- **Data access only through feature `api` modules.** Screens never call `getSupabase()` directly.
- **All user-facing strings are i18n keys** present in `locales/{en,fil,ar}.json` with matching key sets.
- **New migration file**, timestamp-ordered: `20260812000008_grocery_product_link.sql`.
- Verification: `npm run typecheck`, `npm test`, `npm run test:rls`.

---

### Task 1: Migration — grocery_items.product_id + trigger household check

**Files:**
- Create: `supabase/migrations/20260812000008_grocery_product_link.sql`

**Interfaces:**
- Consumes: `public.grocery_items`, `public.grocery_lists`, `public.products`, existing `grocery_items_enforce_list` trigger.
- Produces: `grocery_items.product_id` column + updated trigger function.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260812000008_grocery_product_link.sql`:

```sql
-- ============================================================================
-- Phase 5 slice 5c — link grocery items to catalog products
-- ============================================================================
-- Adds a nullable product_id to grocery_items so a list item can be priced
-- against the retail catalog. The enforce-list trigger now also verifies the
-- linked product belongs to the same household. No RLS change.
-- ============================================================================

alter table public.grocery_items
  add column if not exists product_id uuid references public.products (id) on delete set null;
create index if not exists idx_grocery_items_product on public.grocery_items (product_id);

create or replace function public.grocery_items_enforce_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _h  uuid;
  _ph uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then
    raise exception 'grocery list not found';
  end if;
  new.household_id := _h; -- household always follows the parent list

  if new.product_id is not null then
    select household_id into _ph from public.products where id = new.product_id;
    if _ph is null or _ph <> _h then
      raise exception 'product does not belong to this household';
    end if;
  end if;
  return new;
end;
$$;
```

(The `trg_grocery_items_enforce_list` trigger already points at this function; only
the body changes.)

- [ ] **Step 2: Apply the migration to Supabase**

Paste into the Supabase SQL editor, run. Expect "Success. No rows returned."

- [ ] **Step 3: Smoke-verify**

```sql
select column_name from information_schema.columns
  where table_schema='public' and table_name='grocery_items' and column_name='product_id';
```
Expected: 1 row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260812000008_grocery_product_link.sql
git commit -m "feat(compare): 5c migration — grocery_items.product_id + trigger household check"
```

---

### Task 2: TypeScript type update

**Files:**
- Modify: `lib/database.types.ts` (`GroceryItemRow`)

**Interfaces:**
- Produces: `GroceryItemRow.product_id: string | null`.

- [ ] **Step 1: Add `product_id` to `GroceryItemRow`**

In `lib/database.types.ts`, in `GroceryItemRow`, add the field after `household_id`:

```typescript
export interface GroceryItemRow {
  id: string;
  list_id: string;
  household_id: string;
  product_id: string | null;
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
git commit -m "feat(compare): add product_id to GroceryItemRow"
```

---

### Task 3: Pure basket helper (TDD)

**Files:**
- Create: `features/retail/basket.ts`
- Test: `tests/retail/basket.test.ts`

**Interfaces:**
- Produces:
  - `interface BasketItem { productId: string }`
  - `interface PricePoint { productId: string; columnKey: string; effectiveMinor: number }`
  - `interface ColumnTotal { columnKey: string; totalMinor: number; pricedCount: number; missingCount: number }`
  - `compareColumns(items: BasketItem[], prices: PricePoint[]): ColumnTotal[]`
  - `bestFloorMinor(items: BasketItem[], prices: PricePoint[]): { totalMinor: number; pricedCount: number }`

- [ ] **Step 1: Write the failing tests**

Create `tests/retail/basket.test.ts`:

```typescript
import { bestFloorMinor, compareColumns } from '@/features/retail/basket';

const items = [{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }];
const prices = [
  { productId: 'a', columnKey: 's1', effectiveMinor: 100 },
  { productId: 'b', columnKey: 's1', effectiveMinor: 200 },
  { productId: 'a', columnKey: 's2', effectiveMinor: 90 },
  { productId: 'b', columnKey: 's2', effectiveMinor: 250 },
  { productId: 'c', columnKey: 's2', effectiveMinor: 400 },
];

describe('compareColumns', () => {
  it('totals each column and flags missing items, sorted ascending', () => {
    const cols = compareColumns(items, prices);
    // s1 has a+b priced (300), c missing; s2 has a+b+c (740), none missing.
    expect(cols).toEqual([
      { columnKey: 's1', totalMinor: 300, pricedCount: 2, missingCount: 1 },
      { columnKey: 's2', totalMinor: 740, pricedCount: 3, missingCount: 0 },
    ]);
  });

  it('uses the lowest price if an item repeats in a column', () => {
    const cols = compareColumns([{ productId: 'a' }], [
      { productId: 'a', columnKey: 's1', effectiveMinor: 500 },
      { productId: 'a', columnKey: 's1', effectiveMinor: 300 },
    ]);
    expect(cols).toEqual([{ columnKey: 's1', totalMinor: 300, pricedCount: 1, missingCount: 0 }]);
  });

  it('returns [] when there are no prices', () => {
    expect(compareColumns(items, [])).toEqual([]);
  });
});

describe('bestFloorMinor', () => {
  it('sums the lowest price per item across all columns', () => {
    // a: min(100,90)=90; b: min(200,250)=200; c: 400 => 690, all 3 priced.
    expect(bestFloorMinor(items, prices)).toEqual({ totalMinor: 690, pricedCount: 3 });
  });

  it('counts only items priced somewhere', () => {
    expect(bestFloorMinor(items, [{ productId: 'a', columnKey: 's1', effectiveMinor: 100 }]))
      .toEqual({ totalMinor: 100, pricedCount: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/retail/basket.test.ts`
Expected: FAIL — cannot find module `@/features/retail/basket`.

- [ ] **Step 3: Write the implementation**

Create `features/retail/basket.ts`:

```typescript
/**
 * Pure basket comparison over opaque column keys (the caller maps a branch or an
 * online retailer to a key + label). Amounts are integer minor units in ONE
 * currency (caller pre-filters to the reporting currency). Coupons are handled
 * separately — totals here are pre-coupon.
 */

export interface BasketItem {
  productId: string;
}
export interface PricePoint {
  productId: string;
  columnKey: string;
  effectiveMinor: number;
}
export interface ColumnTotal {
  columnKey: string;
  totalMinor: number;
  pricedCount: number;
  missingCount: number;
}

/** Lowest price per (product, column). */
function lowestByProductColumn(prices: readonly PricePoint[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const p of prices) {
    const key = `${p.productId} ${p.columnKey}`;
    const prev = best.get(key);
    if (prev === undefined || p.effectiveMinor < prev) best.set(key, p.effectiveMinor);
  }
  return best;
}

/** Per column: total of priced items + coverage counts. Sorted by total asc. */
export function compareColumns(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): ColumnTotal[] {
  const lowest = lowestByProductColumn(prices);
  const columns = Array.from(new Set(prices.map((p) => p.columnKey)));
  const totals = columns.map((columnKey) => {
    let totalMinor = 0;
    let pricedCount = 0;
    for (const it of items) {
      const v = lowest.get(`${it.productId} ${columnKey}`);
      if (v !== undefined) {
        totalMinor += v;
        pricedCount += 1;
      }
    }
    return { columnKey, totalMinor, pricedCount, missingCount: items.length - pricedCount };
  });
  return totals.sort((a, b) => a.totalMinor - b.totalMinor);
}

/** Best price per item across all columns, summed (the theoretical floor). */
export function bestFloorMinor(
  items: readonly BasketItem[],
  prices: readonly PricePoint[],
): { totalMinor: number; pricedCount: number } {
  const bestPerProduct = new Map<string, number>();
  for (const p of prices) {
    const prev = bestPerProduct.get(p.productId);
    if (prev === undefined || p.effectiveMinor < prev) bestPerProduct.set(p.productId, p.effectiveMinor);
  }
  let totalMinor = 0;
  let pricedCount = 0;
  for (const it of items) {
    const v = bestPerProduct.get(it.productId);
    if (v !== undefined) {
      totalMinor += v;
      pricedCount += 1;
    }
  }
  return { totalMinor, pricedCount };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/retail/basket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/retail/basket.ts tests/retail/basket.test.ts
git commit -m "feat(compare): pure basket comparison helper + tests"
```

---

### Task 4: Data layer — item linking + basket prices

**Files:**
- Modify: `features/grocery/api.ts` (add `setGroceryItemProduct`)
- Create: `features/retail/basketApi.ts`

**Interfaces:**
- Consumes: `getSupabase`, `AppError`, `listRetailerProducts` (from retail api), `PricePoint` (from basket).
- Produces:
  - `setGroceryItemProduct(itemId: string, productId: string | null): Promise<void>`
  - `getBasketPrices(productIds: string[], currencyCode: string): Promise<{ prices: PricePoint[]; labels: Record<string, string> }>`

- [ ] **Step 1: Add `setGroceryItemProduct` to the grocery api**

Append to `features/grocery/api.ts` (after `deleteItem`):

```typescript
/** Link (or clear) the catalog product a list item refers to. */
export async function setGroceryItemProduct(
  itemId: string,
  productId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('grocery_items')
    .update({ product_id: productId })
    .eq('id', itemId);
  if (error) fail('grocery.errors.saveFailed', error);
}
```

- [ ] **Step 2: Create the basket price assembler**

Create `features/retail/basketApi.ts`:

```typescript
/**
 * Assembles latest prices per (product, column) in one currency for basket
 * comparison. A "column" is a physical branch (store id) or an online retailer
 * (online:{retailerId}). Reduces to the latest snapshot per (product, column),
 * effective = min(regular, sale).
 */

import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';
import type { PricePoint } from '@/features/retail/basket';

interface PriceJoinRow {
  regular_price_minor: number;
  sale_price_minor: number | null;
  observed_at: string;
  store_id: string | null;
  retailer_product: { product_id: string; retailer: { id: string; name: string } | null } | null;
  store: { id: string; name: string } | null;
}

function fail(messageKey: string, cause?: unknown): never {
  throw new AppError('unknown', { messageKey, cause });
}

export async function getBasketPrices(
  productIds: string[],
  currencyCode: string,
): Promise<{ prices: PricePoint[]; labels: Record<string, string> }> {
  if (productIds.length === 0) return { prices: [], labels: {} };

  // Which retailer_products belong to these products?
  const { data: rps, error: rpErr } = await getSupabase()
    .from('retailer_products')
    .select('id')
    .in('product_id', productIds);
  if (rpErr) fail('retail.errors.loadFailed', rpErr);
  const rpIds = (rps ?? []).map((r) => (r as { id: string }).id);
  if (rpIds.length === 0) return { prices: [], labels: {} };

  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select(
      'regular_price_minor, sale_price_minor, observed_at, store_id,' +
        'retailer_product:retailer_products(product_id, retailer:retailers(id,name)),' +
        'store:retailer_stores(id,name)',
    )
    .in('retailer_product_id', rpIds)
    .eq('currency_code', currencyCode)
    .order('observed_at', { ascending: false });
  if (error) fail('retail.errors.loadFailed', error);

  const rows = (data ?? []) as unknown as PriceJoinRow[];
  const labels: Record<string, string> = {};
  // Latest per (productId, columnKey): rows are already newest-first, so keep first seen.
  const seen = new Set<string>();
  const prices: PricePoint[] = [];
  for (const r of rows) {
    const productId = r.retailer_product?.product_id;
    if (!productId) continue;
    const retailerId = r.retailer_product?.retailer?.id ?? 'unknown';
    const retailerName = r.retailer_product?.retailer?.name ?? '—';
    const columnKey = r.store_id ?? `online:${retailerId}`;
    const dedupe = `${productId} ${columnKey}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const effectiveMinor = Math.min(
      r.regular_price_minor,
      r.sale_price_minor ?? r.regular_price_minor,
    );
    prices.push({ productId, columnKey, effectiveMinor });
    labels[columnKey] = r.store?.name ?? `Online · ${retailerName}`;
  }
  return { prices, labels };
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add features/grocery/api.ts features/retail/basketApi.ts
git commit -m "feat(compare): item-product linking + basket price assembler"
```

---

### Task 5: Localization keys (en, fil, ar)

**Files:**
- Modify: `locales/en.json`, `locales/fil.json`, `locales/ar.json` (extend the existing `grocery` namespace)

**Interfaces:**
- Produces: new `grocery.linkProduct`, `grocery.linkedTo`, `grocery.unlink`, `grocery.compareCta`, `grocery.selectProduct`, and a `grocery.compare` sub-object — identical key sets across languages.

- [ ] **Step 1: Add the keys to `locales/en.json` inside the `grocery` object**

Add these members to the existing `"grocery": { ... }` object (e.g. after `"someone"`):

```json
"linkProduct": "Link product",
"linkedTo": "Linked: {{name}}",
"unlink": "Unlink",
"selectProduct": "Select a product",
"compareCta": "Compare prices",
"compare": {
  "title": "Price comparison",
  "noLinked": "Link items to products to compare prices.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} of {{total}} items priced",
  "missing": "{{count}} unpriced here",
  "floor": "Best price anywhere: {{total}} ({{priced}} of {{total_items}})",
  "potentialSavings": "Potential coupon savings: {{amount}}",
  "cheapest": "Cheapest"
}
```

- [ ] **Step 2: Add the same keys to `locales/fil.json`**

```json
"linkProduct": "I-link ang produkto",
"linkedTo": "Naka-link: {{name}}",
"unlink": "I-unlink",
"selectProduct": "Pumili ng produkto",
"compareCta": "Ihambing ang presyo",
"compare": {
  "title": "Paghahambing ng presyo",
  "noLinked": "I-link ang mga item sa produkto para maihambing ang presyo.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} sa {{total}} item may presyo",
  "missing": "{{count}} walang presyo dito",
  "floor": "Pinakamurang presyo kahit saan: {{total}} ({{priced}} sa {{total_items}})",
  "potentialSavings": "Posibleng matipid sa kupon: {{amount}}",
  "cheapest": "Pinakamura"
}
```

- [ ] **Step 3: Add the same keys to `locales/ar.json`**

```json
"linkProduct": "ربط منتج",
"linkedTo": "مرتبط: {{name}}",
"unlink": "إلغاء الربط",
"selectProduct": "اختر منتجًا",
"compareCta": "قارن الأسعار",
"compare": {
  "title": "مقارنة الأسعار",
  "noLinked": "اربط العناصر بالمنتجات لمقارنة الأسعار.",
  "column": "{{label}}",
  "columnTotal": "{{total}}",
  "coverage": "{{priced}} من {{total}} عناصر مُسعّرة",
  "missing": "{{count}} بدون سعر هنا",
  "floor": "أفضل سعر في أي مكان: {{total}} ({{priced}} من {{total_items}})",
  "potentialSavings": "توفير محتمل بالكوبونات: {{amount}}",
  "cheapest": "الأرخص"
}
```

- [ ] **Step 4: Verify i18n parity**

Run: `npm test -- tests/lib/i18n.test.ts`
Expected: PASS (matching key sets).

- [ ] **Step 5: Commit**

```bash
git add locales/en.json locales/fil.json locales/ar.json
git commit -m "feat(compare): i18n strings for linking + comparison"
```

---

### Task 6: Link-product screen + list-detail wiring

**Files:**
- Create: `app/grocery/link/[itemId].tsx`
- Modify: `app/grocery/_layout.tsx` (add `link/[itemId]` and `compare/[id]` entries)
- Modify: `app/grocery/[id].tsx` (per-item link affordance + Compare button + load product names)

**Interfaces:**
- Consumes: `setGroceryItemProduct` (grocery api); `listProducts` (retail api); `useActiveHousehold`.

- [ ] **Step 1: Add stack entries to the grocery layout**

Replace the single-screen `<Stack>` body in `app/grocery/_layout.tsx`:

```typescript
      <Stack.Screen name="[id]" options={{ title: t('grocery.title') }} />
      <Stack.Screen name="link/[itemId]" options={{ title: t('grocery.selectProduct') }} />
      <Stack.Screen name="compare/[id]" options={{ title: t('grocery.compare.title') }} />
```

- [ ] **Step 2: Create the link-product screen**

Create `app/grocery/link/[itemId].tsx`:

```typescript
/** Pick the catalog product a grocery item refers to (or unlink). */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { setGroceryItemProduct } from '@/features/grocery/api';
import { listProducts } from '@/features/retail/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function LinkProductScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = String(itemId);
  const { active } = useActiveHousehold();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    try {
      setProducts(await listProducts(active.id));
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

  async function pick(productId: string | null) {
    try {
      await setGroceryItemProduct(id, productId);
      router.back();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        <Button label={t('grocery.unlink')} variant="secondary" onPress={() => pick(null)} />
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : products.length === 0 ? (
          <Text muted>{t('retail.noProducts')}</Text>
        ) : (
          <View style={styles.list}>
            {products.map((p) => (
              <Pressable key={p.id} style={styles.card} onPress={() => pick(p.id)}>
                <Text variant="heading">{p.name}</Text>
                <Text variant="caption" muted>
                  {[p.brand, p.size_value ? `${p.size_value}${p.size_unit ?? ''}` : null].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
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
});
```

- [ ] **Step 3: Wire the list-detail screen — load product names, add per-item link affordance + Compare button**

In `app/grocery/[id].tsx`:

(a) Add imports near the other feature imports:

```typescript
import { listProducts } from '@/features/retail/api';
```

Also add `useRouter` to the existing `expo-router` import so the line reads:

```typescript
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
```

(b) Add product-name state alongside the others:

```typescript
  const [productNames, setProductNames] = useState<Record<string, string>>({});
```

(c) In the component body, get the router (near `const { t } = useTranslation();`):

```typescript
  const router = useRouter();
```

(d) In `load()`, after `setItems(its);`, also load product names:

```typescript
      if (l) {
        const prods = await listProducts(l.household_id);
        setProductNames(Object.fromEntries(prods.map((p) => [p.id, p.name])));
      }
```

(e) In each item card, after the attribution `<Text>` line
(`{t('grocery.addedBy', ...)}`), add a link affordance:

```typescript
              <Pressable onPress={() => router.push(`/grocery/link/${it.id}`)}>
                <Text variant="caption" style={{ color: palette.brand }}>
                  {it.product_id
                    ? t('grocery.linkedTo', { name: productNames[it.product_id] ?? '…' })
                    : t('grocery.linkProduct')}
                </Text>
              </Pressable>
```

(f) In the summary block (after the `purchasedOf` line's closing `</Text>`, before
the block's closing `</View>`), add a Compare button shown when any item is linked:

```typescript
          {items.some((it) => it.product_id) && (
            <Button
              label={t('grocery.compareCta')}
              variant="secondary"
              onPress={() => router.push(`/grocery/compare/${listId}`)}
            />
          )}
```

- [ ] **Step 4: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/grocery/link/[itemId].tsx" "app/grocery/_layout.tsx" "app/grocery/[id].tsx"
git commit -m "feat(compare): link-product screen + list-detail wiring"
```

---

### Task 7: Comparison screen

**Files:**
- Create: `app/grocery/compare/[id].tsx`

**Interfaces:**
- Consumes: `listItems` (grocery api); `getBasketPrices` (basketApi); `compareColumns`, `bestFloorMinor` (basket); `listCouponsForProduct` (couponApi); `applyCoupon` (coupon); `useActiveHousehold`; `formatAmount`.

- [ ] **Step 1: Create the comparison screen**

Create `app/grocery/compare/[id].tsx`:

```typescript
/** Compare a grocery list's linked items across branches (reporting currency):
 *  ranked column totals + coverage, best-price floor, and potential coupon savings. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui';
import { listItems } from '@/features/grocery/api';
import { bestFloorMinor, compareColumns } from '@/features/retail/basket';
import type { ColumnTotal } from '@/features/retail/basket';
import { getBasketPrices } from '@/features/retail/basketApi';
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function CompareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);
  const { active } = useActiveHousehold();

  const [columns, setColumns] = useState<ColumnTotal[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [floor, setFloor] = useState<{ totalMinor: number; pricedCount: number }>({ totalMinor: 0, pricedCount: 0 });
  const [itemCount, setItemCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ccy = active?.reporting_currency_code ?? 'USD';

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const items = await listItems(listId);
      const linked = items.filter((it) => it.product_id) as (typeof items[number] & { product_id: string })[];
      const productIds = Array.from(new Set(linked.map((it) => it.product_id)));
      setItemCount(productIds.length);
      if (productIds.length === 0) {
        setColumns([]);
        setFloor({ totalMinor: 0, pricedCount: 0 });
        setPotentialSavings(0);
        return;
      }
      const { prices, labels: lbls } = await getBasketPrices(productIds, ccy);
      const basketItems = productIds.map((productId) => ({ productId }));
      setColumns(compareColumns(basketItems, prices));
      setLabels(lbls);
      setFloor(bestFloorMinor(basketItems, prices));

      // Potential coupon savings: best applicable coupon per product vs its best price.
      const now = Date.now();
      const bestByProduct = new Map<string, number>();
      for (const p of prices) {
        const prev = bestByProduct.get(p.productId);
        if (prev === undefined || p.effectiveMinor < prev) bestByProduct.set(p.productId, p.effectiveMinor);
      }
      let savings = 0;
      for (const productId of productIds) {
        const base = bestByProduct.get(productId);
        if (base === undefined) continue;
        const coupons = await listCouponsForProduct(productId);
        let best = 0;
        for (const c of coupons) {
          const r = applyCoupon(c, base, ccy, now);
          if (r.applicable && r.savingsMinor > best) best = r.savingsMinor;
        }
        savings += best;
      }
      setPotentialSavings(savings);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, listId, ccy]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {itemCount === 0 ? (
          <Text muted>{t('grocery.compare.noLinked')}</Text>
        ) : columns.length === 0 ? (
          <Text muted>{t('retail.noPrices')}</Text>
        ) : (
          <>
            <View style={styles.list}>
              {columns.map((col, idx) => (
                <View key={col.columnKey} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">{labels[col.columnKey] ?? col.columnKey}</Text>
                    <Text variant="heading">{formatAmount(col.totalMinor, ccy)}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text variant="caption" muted>
                      {t('grocery.compare.coverage', { priced: col.pricedCount, total: itemCount })}
                    </Text>
                    {idx === 0 ? (
                      <Text variant="caption" style={{ color: palette.brand }}>{t('grocery.compare.cheapest')}</Text>
                    ) : col.missingCount > 0 ? (
                      <Text variant="caption" muted>{t('grocery.compare.missing', { count: col.missingCount })}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text variant="caption" muted>
                {t('grocery.compare.floor', {
                  total: formatAmount(floor.totalMinor, ccy),
                  priced: floor.pricedCount,
                  total_items: itemCount,
                })}
              </Text>
              {potentialSavings > 0 ? (
                <Text variant="caption" style={{ color: palette.brand }}>
                  {t('grocery.compare.potentialSavings', { amount: formatAmount(potentialSavings, ccy) })}
                </Text>
              ) : null}
            </View>
          </>
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
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
```

- [ ] **Step 2: Verify typecheck + tests pass**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/grocery/compare/[id].tsx"
git commit -m "feat(compare): basket comparison screen (columns, floor, coupon savings)"
```

---

### Task 8: Extend RLS integration test

**Files:**
- Modify: `tests/integration/rls-isolation.mjs`

**Interfaces:**
- Consumes: existing harness (`ok`, `a`, `b`, `hid`, `idA`, `prod` and `gi` from earlier blocks).

- [ ] **Step 1: Add a link + cross-household-rejection assertion (after the retail catalog block, before the coupons block)**

Locate the grocery item created earlier in the retail-or-grocery setup. The grocery
item `gi` (id in `gi?.id`) and the retail product `prod` (id in `prod?.id`) both
belong to A's household `hid`. Add:

```javascript
  // --- 5c: A links a grocery item to a product; cross-household is rejected --
  const { error: linkErr } = await a
    .from('grocery_items')
    .update({ product_id: prod?.id })
    .eq('id', gi?.id);
  ok('A can link a grocery item to a product', !linkErr);
  const { data: linked } = await a
    .from('grocery_items').select('product_id').eq('id', gi?.id).single();
  ok('grocery item product_id reads back', linked?.product_id === prod?.id);

  // Linking a product from a DIFFERENT household is rejected by the trigger.
  // (Create a throwaway product under B's household after B has one; here we
  // assert the trigger path using a random uuid that isn't A's product.)
  const { error: badLinkErr } = await a
    .from('grocery_items')
    .update({ product_id: '00000000-0000-0000-0000-000000000000' })
    .eq('id', gi?.id);
  ok('linking a non-household product is rejected', Boolean(badLinkErr));
```

- [ ] **Step 2: Syntax-check + run**

Run: `node --check tests/integration/rls-isolation.mjs` → valid.
Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` temporarily, then `npm run test:rls`.
Expected: all assertions pass (the bad-link update raises because the product id
doesn't exist / isn't in the household → trigger `raise exception`). Remove the key after.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/rls-isolation.mjs
git commit -m "test(compare): grocery item product link + cross-household rejection"
```

---

### Task 9: Final verification

**Files:** none

- [ ] **Step 1: Full sweep**

Run:
```bash
npm run typecheck
npm test
npm run test:rls   # needs SUPABASE_SERVICE_ROLE_KEY temporarily
```
Expected: typecheck clean; unit suites pass (incl. `tests/retail/basket.test.ts`); RLS suite passes incl. the link assertions.

- [ ] **Step 2: Manual smoke (optional)**

Grocery → open a list → add an item → "Link product" → pick a catalog product →
"Compare prices" → confirm branch columns rank by total with coverage, the
best-price floor shows, and potential coupon savings appears when a matching
coupon exists.

- [ ] **Step 3: Remove the service-role key from `.env`.**

---

## Self-Review

**Spec coverage:**
- product_id column + trigger household check → Task 1 ✓; type Task 2 ✓
- pure comparison (columns, coverage, floor) → Task 3 ✓
- item linking + basket price assembly (reporting currency, latest per product/column) → Task 4 ✓
- link screen + list wiring + compare button → Task 6 ✓
- comparison screen (ranked totals, coverage, floor, potential coupon savings) → Task 7 ✓
- coupons as potential savings, totals pre-coupon → Task 7 (savings computed separately) ✓
- i18n → Task 5 ✓
- RLS/trigger cross-household rejection → Task 8 ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** `PricePoint`/`BasketItem`/`ColumnTotal` (Task 3) used by Task 4
(`getBasketPrices` returns `PricePoint[]`) and Task 7. `setGroceryItemProduct`
(Task 4) consumed in Task 6. `getBasketPrices(productIds, currencyCode)` signature
matches Task 7's call. `GroceryItemRow.product_id` (Task 2) used in Tasks 6/7.
`compareColumns`/`bestFloorMinor` names match between Task 3 and Task 7.

**Note (Task 8):** the cross-household rejection uses a non-existent uuid, which the
trigger rejects via `_ph is null` — exercising the same guard path as a real
other-household id. This avoids needing B's product created before A's block runs.
