# 4e — Shop → Coupons (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4e — the Coupons screen tied to the active list

## Intent

Rework `app/retail/coupons.tsx` so coupons connect to what the household is
actually buying: match coupons to the current grocery list, surface a **dollar
savings** banner, and make each card show its offer, urgency, and list link.
Also make **US/USD the default** country/currency so the sample market (and this
banner) reads in dollars.

## Matching + savings (pure, tested)

New `features/retail/couponMatch.ts`:

```
computeListCouponSavings(coupons, listItems, listCurrency, nowMs)
  → { matches: { coupon, matchedItemName: string|null, savingsMinor: number }[],
      totalSavingsMinor: number }
```

- **Match** by `coupon.retailer_product.product_id === item.product_id`.
  Retailer-wide coupons (no product) and coupons whose product isn't on the list
  are `matchedItemName: null`, `savingsMinor: 0`.
- **Savings** for a matched item with an estimated price:
  `applyCoupon(coupon, item.estimatedPriceMinor, listCurrency, nowMs).savingsMinor`
  (reuses existing pure coupon math — fixed coupons must match `listCurrency`,
  percent always applies; no estimated price → 0).
- **Total** takes the **best coupon per item** (max savings per `product_id`) so
  two coupons on one item don't double-count.
- Unit-tested: match, currency mismatch, percent, best-per-item, missing price,
  expired coupon → 0.

## Data

Load alongside coupons: the **most recent non-archived grocery list**
(`listLists(hid)[0]`) and its items (`listItems`, using `product_id`, `name`,
`estimated_price_minor`). Extend the coupon select + `CouponWithRefs` to include
`retailer_product.product_id` (additive).

## UI (`app/retail/coupons.tsx`)

- **PREMIUM pill** at the top (screen already premium-gated).
- **Savings banner** (accent surface): *"{amount} in coupon savings on
  {listName}"* when `totalSavingsMinor > 0`; hidden otherwise. Amount via
  `formatAmount(total, listCurrency)`.
- **Coupon cards** (matched first): a 4px accent inline-start bar, title, the
  discount/savings in accent (₱/$ or %), a meta line *"retailer · code · until
  {date}"* with **expiry < 7 days in `danger`**, and — when matched — *"On your
  list ✓ — {item}"* in `brand`. **Non-matching coupons render at 85% opacity.**
- Active/expired grouping and the existing add-coupon form stay.

## Default country = USA (fallback)

New `lib/defaults.ts`: `DEFAULT_COUNTRY = 'US'`, `DEFAULT_CURRENCY = 'USD'`,
`defaultCurrencyCode()` = device currency **or** `USD`, `defaultCountryCode()` =
device region **or** `US`. Device locale still wins when present (this is a
fallback, not a forced override — correct for a global app). Wired into:
- `app/household/new.tsx` reporting-currency default (replaces its local
  `deviceCurrency()`).
- `app/retail/new.tsx` retailer-directory country default.

## Non-goals

- No "roll savings into Compare (2c)" — that's a Compare-screen integration for a
  later 2c slice.
- Coupon base price uses the item's **estimated** price, not `price_snapshots`
  (which list items rarely have); good enough for a planning-time figure.
- The retail-hub Coupons *preview* (`app/retail/index.tsx`) is unchanged.

## Testing

`computeListCouponSavings` unit-tested. Screen + defaults via `typecheck` + i18n
parity + manual. Existing `applyCoupon`/`couponStatus` tests already cover the
math underneath.
