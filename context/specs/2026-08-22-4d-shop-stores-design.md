# 4d — Shop → Stores (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4d — the Stores segment of the retail hub

## Intent

The Stores segment of `app/retail/index.tsx` currently lists retailers as bare
cards (name + country only) under a plain active-location card. 4d makes it the
mockup's store hub: a location banner, retailer cards that show reach ("N
branches · N prices") and **price freshness** (the spec's visible-freshness
rule), and a clear add-retailer affordance. Responsive — 3-up on wide viewports,
stacked below — via the app's `useIsWideLayout` (≥1024px).

## Non-goals

- Coupons and Locations segments unchanged (4e / later).
- No schema/RPC change and no new migration: metrics are aggregated from existing
  household-scoped tables client-side.
- Not moving the products list into each retailer's detail (a separate nav
  change); the existing products link stays.

## Data layer (no migration)

- **Pure module** `features/retail/retailerStats.ts`:
  `computeRetailerStats(stores, retailerProducts, prices) → Map<retailerId,
  RetailerStat>` where `RetailerStat = { branches, prices, lastObservedAt: string
  | null }`. Counts branches per retailer, maps `retailer_product_id →
  retailer_id` to count prices, and keeps the newest `observed_at`. Pure →
  jest-unit-tested.
- **`listRetailerStats(hid)`** in `features/retail/api.ts`: three minimal
  household-scoped selects (`retailer_stores.retailer_id`,
  `retailer_products{id,retailer_id}`, `price_snapshots{retailer_product_id,
  observed_at}`) run in parallel, fed to the pure aggregator. Added to the hub's
  `load()` Promise.all; a retailer with no entry renders as zeros.

## UI

**Active-location banner** (top of hub, all segments): a map-pin tile, a caption
(*"Shopping near"* / *"No location set"*), the `label — store` line, a
why-it-matters caption, and a pill that switches to the Locations segment
(*"Change location"* / *"Set location"*).

**Retailer cards** (Stores segment, `RetailerCard` local component): name,
country, **"{branches} · {prices}"** (plural keys), and a **freshness pill** from
`freshnessOf(Date.parse(lastObservedAt), now)`:
- `null` → muted **"No prices yet"** (`field`/`textMuted`)
- fresh | recent → **"Updated {date}"** (`successMuted`/`success`)
- stale → **"Stale — {date}"** (`dangerMuted`/`danger`)

Date via `formatDate`. Card tap → `/retail/[id]`. A persistent **"＋ Add
retailer"** row (→ `/retail/new`) sits above the grid; the `EmptyState` stays for
zero retailers.

**Saved-location rows** (Locations segment): minor polish — `✓ Active` (brand)
vs a `Set active` pill (already present; aligned to tokens).

## i18n

New `retail.*` keys in en/fil/ar (matching sets): `branchCount`/`branchCount_other`,
`priceCount`/`priceCount_other`, `updated`, `stale`, `noPricesYet`, `shoppingNear`,
`setLocationPrompt`, `locationWhy`, `changeLocation`, `setLocation`, `addRetailer`
(reuse if present). Plurals follow the existing `itemsCount` base + `_other`
pattern.

## Testing

`computeRetailerStats` gets unit tests (branch/price counts, newest-date
selection, unknown retailer_product ignored, empty inputs). The screen is
verified by `typecheck` + i18n parity + manual. Freshness bucketing is already
covered by `tests/retail/freshness.test.ts`.
