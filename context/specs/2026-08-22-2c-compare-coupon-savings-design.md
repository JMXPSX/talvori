# 2c — Coupon savings in Compare (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 2c hook — roll coupon savings into the basket comparison

## Intent

`app/grocery/compare/[id].tsx` ranks store columns by pre-coupon list price and
shows a single coupon "potential savings" figure computed against the theoretical
floor (global best price per product) — disconnected from the ranked columns.
Make the columns **coupon-aware** so the best basket reflects applicable coupons:
each column's total nets out coupons valid at that column's retailer, and the
ranking uses the **net** total.

## Pure module (tested)

`features/retail/basketCoupons.ts`:

```
compareColumnsWithCoupons(items, prices, columnRetailer, couponsByProduct, ccy, nowMs)
  → ColumnTotalCoupon[]   // { columnKey, grossMinor, savingsMinor, netMinor,
                          //   pricedCount, missingCount }, sorted by netMinor asc
```

- Lowest price per (product, column), same as `compareColumns`.
- Per column: `retailerId = columnRetailer[columnKey]`. For each priced item, best
  savings = max `applyCoupon(coupon, base, ccy, now).savingsMinor` over
  `couponsByProduct[productId]` whose `retailerId` matches the column's retailer
  (coupons are retailer-scoped). `net = gross − savings`.
- No matching coupons → `savingsMinor 0`, `net == gross` (identical ordering to
  `compareColumns`). Reuses the existing pure `applyCoupon`.
- Unit-tested: retailer scoping (a coupon only helps its own retailer's column),
  ranking flips by net, cap/percent, empty inputs.

## Data

`getBasketPrices` also returns `columnRetailer: Record<columnKey, retailerId>`
(the retailer is already on each row — store column → its retailer, online column
→ the embedded id). No new query. The screen builds `couponsByProduct: Map<
productId, {retailerId, coupon}[]>` from the `listCouponsForProduct` calls it
**already makes** — each coupon carries `retailer_id`.

## Screen

- Columns ranked by **net**; the card headline amount is the net total.
- Cards with `savingsMinor > 0` show an accent line **"🏷 {amount} off with
  coupons"**. Cheapest (index 0) keeps its badge; coverage/missing unchanged.
- Keep the theoretical-floor card; **remove** the old floor-based
  `potentialSavings` line and its coupon loop (superseded).

## i18n

Add `grocery.compare.couponSaved` = "🏷 {{amount}} off with coupons"; remove
`grocery.compare.potentialSavings` from en/fil/ar (key sets stay matched).

## Non-goals

- The theoretical-floor figure stays pre-coupon (it's the split-shopping floor, a
  different concept).
- No schema change; coupons and prices already exist.

## Testing

`compareColumnsWithCoupons` unit-tested. Screen via `typecheck` + i18n parity +
manual. `applyCoupon`/`compareColumns` keep their existing tests.
