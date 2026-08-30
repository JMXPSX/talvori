# Phase 5 Slice 5b — Coupons — Design

Date: 2026-08-12
Status: Approved (brainstorming complete)
Author: Claude + Joseph

## Context

Slice 5b of Phase 5 (Retail Intelligence). Builds on 5a's household-scoped retail
catalog (retailers, retailer_products, price_snapshots). Adds **coupons**: a
code/clip-able discount applied on top of the shelf/sale price, with a savings
engine and Level-1 discovery. Follows Phases 1–5a patterns: Supabase + RLS
(writer/viewer), integer-minor-unit money, `features/<domain>` boundary, screens
under `app/`, i18n in three locales, pure helpers unit-tested.

Phase 5 decomposition: 5a done; **5b (this doc) = coupons**; 5c = price
comparison / basket + grocery↔product linking; 5d = live connectors, loyalty
OAuth, global catalog.

## Locked design decisions

1. **Coupon model: fixed or percent**, with optional min-purchase threshold and
   an optional max-discount cap (percent). Scoped to a retailer, optionally
   narrowed to one `retailer_product`. Has an optional code, source URL (Level-1
   "where to clip"), and start/expiry dates. No BOGO / quantity tiers / usage
   limits / loyalty requirements this slice (5d).
2. **Grocery matching deferred to 5c.** 5b coupons live in the retail module.
   The grocery-list ↔ product bridge (and coupon-to-grocery-item surfacing) is
   designed holistically in 5c.
3. **No separate promotions table.** A "promotion" is already a price snapshot
   whose `sale_price_minor` is set (5a). A coupon stacks on top of the effective
   shelf price = `min(regular, sale)`.

## Money & currency invariants

- Fixed coupons carry `currency_code`; a fixed coupon applies only to a price in
  the same currency (the helper returns `applicable: false` otherwise).
- Percent coupons are currency-agnostic; savings compute in the price's currency.
- All amounts are integer minor units.

## Data model — migration `20260812000007_coupons.sql`

### `coupons`
| column                | type          | notes                                            |
|-----------------------|---------------|--------------------------------------------------|
| `id`                  | uuid pk       | `gen_random_uuid()`                              |
| `household_id`        | uuid          | fk → households, cascade                         |
| `retailer_id`         | uuid not null | fk → retailers, cascade                          |
| `retailer_product_id` | uuid          | nullable; fk → retailer_products, cascade        |
| `title`               | text not null |                                                  |
| `code`                | text          | nullable                                         |
| `source_url`          | text          | nullable (Level-1 link)                          |
| `notes`               | text          | nullable                                         |
| `discount_type`       | text not null | check `in ('fixed','percent')`                   |
| `discount_amount_minor` | bigint      | nullable; `>= 0`; set for fixed                  |
| `discount_percent`    | numeric       | nullable; `> 0 and <= 100`; set for percent      |
| `currency_code`       | text          | nullable; `^[A-Z]{3}$`; set for fixed            |
| `min_purchase_minor`  | bigint        | nullable; `>= 0`                                 |
| `max_discount_minor`  | bigint        | nullable; `>= 0` (cap, mainly for percent)       |
| `starts_at`           | timestamptz   | nullable                                         |
| `expires_at`          | timestamptz   | nullable                                         |
| `created_by`          | uuid not null | fk → auth.users                                  |
| `created_at`/`updated_at` | timestamptz | `set_updated_at()` trigger                      |

CHECK `chk_coupon_shape`:
`(discount_type = 'fixed'   and discount_amount_minor is not null and currency_code is not null and discount_percent is null)`
`or (discount_type = 'percent' and discount_percent is not null and discount_percent > 0 and discount_percent <= 100 and discount_amount_minor is null)`

Index `(household_id, retailer_id)` and `(retailer_product_id)`.

### RLS (mirrors retail price rows)
- SELECT `is_member_of(household_id)`
- INSERT `has_role_in(household_id, ['owner','admin','member'])` and `created_by = auth.uid()`
- UPDATE writers (using + check)
- DELETE writers (coupons churn like prices)
- Grants `select, insert, update, delete` to `authenticated`.

## Pure helper — `features/retail/coupon.ts` (unit-tested)

```
type CouponStatus = 'scheduled' | 'active' | 'expired';

interface CouponLike {
  discount_type: 'fixed' | 'percent';
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
}

couponStatus(c: Pick<CouponLike,'starts_at'|'expires_at'>, nowMs: number): CouponStatus
// expired if expires_at < now; scheduled if starts_at > now; else active.

interface ApplyResult {
  applicable: boolean;
  finalMinor: number;      // base when not applicable
  savingsMinor: number;    // 0 when not applicable
  reason?: 'expired' | 'scheduled' | 'currency' | 'min_purchase';
}
applyCoupon(c: CouponLike, basePriceMinor: number, currencyCode: string, nowMs: number): ApplyResult
```

Rules (in order): status must be `active` (else reason expired/scheduled);
for fixed, `c.currency_code === currencyCode` (else reason `currency`);
`min_purchase_minor == null || base >= min` (else reason `min_purchase`).
Savings: fixed → `min(discount_amount_minor, base)`; percent →
`min(round(base * pct / 100), max_discount_minor ?? Infinity, base)`.
`finalMinor = base - savingsMinor` (never below 0).

## Data layer — `features/retail/couponApi.ts`

- `listCoupons(hid): CouponWithRefs[]` — joined with retailer + retailer_product display.
- `listCouponsForProduct(productId): CouponWithRefs[]` — coupons scoped to any of the
  product's `retailer_products`, OR retailer-wide (null `retailer_product_id`) for any
  retailer the product is sold at. (Two-step: fetch the product's retailer_products →
  gather retailer ids + retailer_product ids → `or(...)` filter.)
- `createCoupon(hid, input): CouponRow`
- `deleteCoupon(id): void`

Types: `CouponRow` in `lib/database.types.ts`; `CouponWithRefs` exported from couponApi.
Schema: `createCouponSchema` in `features/retail/schemas.ts` (amounts entered in major
units → minor at the screen boundary; percent entered as a number 0–100).

## Screens

- `app/retail/coupons.tsx` — discovery hub: active vs expired sections (via
  `couponStatus`), each row shows retailer/product scope, the discount, code, and a
  Level-1 source link when present. Add-coupon form: pick retailer (chips), optional
  product (chips from that retailer's products), type (fixed/percent), value, optional
  min-purchase, optional cap, expiry, code, URL. Linked from the retail hub
  (`app/retail/index.tsx`) and the `_layout` gets a `coupons` screen entry.
- `app/retail/product/[id].tsx` — add a **Coupons** section: coupons applicable to the
  product (via `listCouponsForProduct`), each showing expected **final price / savings**
  computed with `applyCoupon` against the product's cheapest current effective price
  (`min(regular, sale)`), skipping non-applicable ones (or labeling why).

## Other
- `coupons.*` i18n namespace in `locales/{en,fil,ar}.json` (matching key sets).
- `app/retail/_layout.tsx`: add `<Stack.Screen name="coupons" .../>`.
- `app/retail/index.tsx`: add a link to `/retail/coupons`.

## Tests
- Unit `tests/retail/coupon.test.ts`: `couponStatus` (scheduled/active/expired),
  `applyCoupon` for fixed, percent, percent-with-cap, below-min-purchase,
  currency-mismatch, expired, and final-never-below-zero.
- RLS: extend `tests/integration/rls-isolation.mjs` — A creates a coupon; the CHECK
  constraint rejects a malformed coupon (percent with an amount); B (non-member)
  cannot read/write; after joining B can read.

## Success criteria
- A household can record coupons and browse them by active/expired status.
- A product screen shows applicable coupons with correct expected final price/savings.
- Household isolation holds for coupons (RLS test passes).
- `typecheck` clean; all unit tests pass.

## Out of scope (this slice)
Grocery-item matching (5c); BOGO / quantity tiers; usage-limit tracking; loyalty
requirements; Level-2 deep-link and Level-3 native clipping/activation; a separate
promotions table.
