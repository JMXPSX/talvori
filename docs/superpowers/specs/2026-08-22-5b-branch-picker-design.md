# 5b — Branch picker (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 5b — retailer branch picker

## Intent

`app/retail/[retailerId].tsx` is already the retailer's Branches screen (list +
add-branch form). 5b upgrades it into a **picker** that ends in "set this as my
shopping location": search + nearest-first branches, a selectable list, an
explainer, and a one-tap manual add that also activates. No new route (entry
point already exists — tapping a retailer in the hub). The global saved-locations
manager (`locations.tsx`) is unchanged.

## Pure module (tested)

`features/retail/branchRank.ts` — `rankBranches(stores, coords, query)`:
- Filters by a **city/ZIP/name** query (`name`, `city`, `region`, `postal_code`,
  case-insensitive `includes`).
- Sorts **nearest-first** when `coords` present (existing pure `haversineKm`);
  branches without lat/lng fall to the bottom; with no coords at all, sorts
  alphabetically.
- Returns `{ store, km: number | null }[]`. Unit-tested: filter, distance sort,
  no-coords fallback, coords-missing branch ordering.

## API

`saveAndActivateLocation(hid, storeId, label)` in `features/retail/api.ts`:
reuses an existing `saved_location` for that store if one exists (no duplicates),
else creates one, then `setActiveLocation`. This is the shared "make it active"
glue for both paths below.

## UI (upgraded `[retailerId].tsx`)

- **City/ZIP search** field filtering the branch list (via `rankBranches`).
- **"Use current location"** button → GPS (expo-location) → reorders nearest
  first, each row showing `· {km}` (existing `retail.distanceKm`).
- **Selectable branch rows**: name + address line (+ distance); the selected row
  is `brandMuted` + ✓, `accessibilityRole="radio"`.
- **Ink explainer card** (`tertiary` surface): "Prices are per branch. Compare
  ranks branches, and each price shows how fresh it is."
- **Primary CTA "Save & set as my location"** — enabled once a branch is
  selected → `saveAndActivateLocation(store.name)`, then back to `/retail`.
- **Dashed "Branch not listed? Add it manually"** → the existing add-branch form
  (name / city / currency / coords). Its button **"Add & set as my location"**
  chains `createStore` → `saveAndActivateLocation` in **one tap**.

## i18n

New `retail.*` keys (en/fil/ar): `branchSearch`, `saveAndSetActive`,
`addAndSetActive`, `branchNotListed`, `branchExplainer`, `selected`. Reuse
existing `useCurrentLocation`, `distanceKm`, `addBranch`, `branchName`, `city`,
`currency`, `latitude`, `longitude`, `noBranches`.

## Non-goals

- No seeded/directory branch data (arrives with connectors); branches remain
  household-created rows.
- No change to `locations.tsx` or the store/saved-location schema.

## Testing

`rankBranches` unit-tested. Screen + the api chain via `typecheck` + i18n parity
+ manual. `haversineKm` already has its own tests.
