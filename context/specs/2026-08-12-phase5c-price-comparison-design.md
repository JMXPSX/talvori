# Phase 5 Slice 5c — Price Comparison & Basket — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5c of Phase 5. Bridges Phase 4 grocery lists and the 5a/5b retail catalog:
link grocery items to catalog products, then compare what a list costs across
branches, find the cheapest single-store basket, and surface applicable coupons
per item. Follows established patterns (Supabase + RLS, integer-minor-unit money,
`features/<domain>` boundary, pure helpers unit-tested, i18n ×3).

Phase 5 decomposition: 5a foundation ✓; 5b coupons ✓; **5c (this doc) = price
comparison + grocery↔product linking**; 5d = live connectors, loyalty OAuth,
global catalog.

## Locked design decisions

1. **Grocery↔product link:** a nullable `product_id` FK on the existing
   `grocery_items` table, tagged manually (no fuzzy matching). Only linked items
   participate in comparison.
2. **Comparison model:** single-store cheapest with coverage flagging (each
   column shows its total AND how many linked items are unpriced there), plus a
   "best price anywhere" floor (one number, no multi-store routing).
3. **Coupons:** shown as *potential* savings per item (via 5b `applyCoupon`);
   ranked totals stay pre-coupon (we don't bake in min-purchase/usage/stacking
   assumptions we deliberately deferred).
4. **Currency:** comparison runs in the household **reporting currency**. Prices
   in other store currencies are excluded from ranked totals and flagged.
   Cross-currency comparison (FX) is deferred — the money invariant forbids
   mixing, and FX-converted rankings would be uncertain.

## Data model — migration `20260812000008_grocery_product_link.sql`

```sql
alter table public.grocery_items
  add column if not exists product_id uuid references public.products (id) on delete set null;
create index if not exists idx_grocery_items_product on public.grocery_items (product_id);
```

Extend `public.grocery_items_enforce_list()` (created in the Phase 4 migration) so
that, in addition to forcing `household_id` from the parent list, it verifies a
non-null `product_id` belongs to the same household:

```sql
create or replace function public.grocery_items_enforce_list()
returns trigger language plpgsql security definer set search_path = '' as $$
declare _h uuid; _ph uuid;
begin
  select household_id into _h from public.grocery_lists where id = new.list_id;
  if _h is null then raise exception 'grocery list not found'; end if;
  new.household_id := _h;
  if new.product_id is not null then
    select household_id into _ph from public.products where id = new.product_id;
    if _ph is null or _ph <> _h then
      raise exception 'product does not belong to this household';
    end if;
  end if;
  return new;
end; $$;
```

(The trigger itself is unchanged — only the function body is replaced. RLS on
`grocery_items` is unchanged.)

## Pure helper — `features/retail/basket.ts` (unit-tested)

Keyed by an opaque `columnKey` so the helper stays pure; the caller (screen/api)
maps a physical branch or an online retailer to a `columnKey` + human label.

```
interface BasketItem { productId: string }
interface PricePoint { productId: string; columnKey: string; effectiveMinor: number }
interface ColumnTotal { columnKey: string; totalMinor: number; pricedCount: number; missingCount: number }

// Per column: sum effectiveMinor of items priced there; missingCount = linked
// items with NO price in that column. Sorted by totalMinor ascending.
compareColumns(items: BasketItem[], prices: PricePoint[]): ColumnTotal[]

// Best (lowest) price per item across ALL columns, summed. pricedCount = items
// that have at least one price anywhere. The theoretical floor.
bestFloorMinor(items: BasketItem[], prices: PricePoint[]): { totalMinor: number; pricedCount: number }
```

`effectiveMinor` is `min(regular_price_minor, sale_price_minor ?? regular)`, computed
by the caller when building `PricePoint`s. If an item appears multiple times in one
column (shouldn't after latest-reduction), the lowest is used.

## Data layer

- `features/grocery/api.ts`: add
  `setGroceryItemProduct(itemId: string, productId: string | null): Promise<void>`
  (updates `grocery_items.product_id`; the trigger validates household).
- `features/retail/basketApi.ts`:
  `getBasketPrices(productIds: string[], currencyCode: string): Promise<{ prices: PricePoint[]; labels: Record<string, string> }>`
  - Query `price_snapshots` joined `retailer_product:retailer_products(product_id, retailer:retailers(id,name))`,
    `store:retailer_stores(id,name,currency_code)`, filtered to `currency_code = currencyCode`
    and the products' `retailer_products`. (Fetch the products' retailer_product ids first, like couponApi.)
  - Build `columnKey` = `store.id` for a branch, or `online:{retailerId}` when `store_id` is null.
  - `label` = branch name, or `"Online · {retailer name}"`.
  - Reduce to the latest snapshot per `(productId, columnKey)`; `effectiveMinor = min(regular, sale ?? regular)`.

## Screens

- `app/grocery/[id].tsx` (edit): for each item show its linked product (or a
  "Link product" affordance) that routes to `/grocery/link/{itemId}`; add a
  **Compare prices** button routing to `/grocery/compare/{listId}` (only when the
  list has ≥1 linked item). Requires new stack entries in
  `app/grocery/_layout.tsx` for `link/[itemId]` and `compare/[id]`.
- `app/grocery/link/[itemId].tsx` (new): lists the household's products; tapping
  one calls `setGroceryItemProduct(itemId, productId)` and navigates back; an
  "Unlink" action clears it.
- `app/grocery/compare/[id].tsx` (new): loads the list's linked items, calls
  `getBasketPrices` with the reporting currency, runs `compareColumns` +
  `bestFloorMinor`, and renders:
  - a ranked list of columns: `label`, total (in reporting currency), and coverage
    (`pricedCount`/total, `missingCount` flagged)
  - the best-price-anywhere floor
  - per-item potential coupon savings: for each linked item, `listCouponsForProduct`
    + `applyCoupon` against the item's best price; sum the applicable savings into a
    single "potential coupon savings" figure (shown separately, not deducted).

## Other
- `GroceryItemRow` in `lib/database.types.ts` gains `product_id: string | null`.
- i18n: add `grocery.linkProduct`, `grocery.linkedTo`, `grocery.unlink`,
  `grocery.compareCta`, and a `grocery.compare.*` sub-block (title, columnTotal,
  coverage, floor, potentialSavings, noLinked, notInCurrency) in en/fil/ar with
  matching key sets.

## Tests
- Unit `tests/retail/basket.test.ts`: `compareColumns` (totals, coverage/missing,
  sorting), `bestFloorMinor` (floor across columns, pricedCount), empty inputs.
- RLS: extend `tests/integration/rls-isolation.mjs` — A links a grocery item to a
  product (via update); the trigger rejects linking a product from another household
  (use B's household product id — expect error); after linking, the item's
  `product_id` reads back.

## Success criteria
- A household can link list items to catalog products and see per-branch basket
  totals (reporting currency) with coverage, a best-price floor, and potential
  coupon savings.
- The trigger blocks cross-household product links.
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice)
Multi-store routing optimization; cross-currency (FX) comparison; auto-applying
coupons into ranked totals; live price sourcing (5d).
