# Handoff: Global Household App — UX Overhaul (Audit fixes F01–F32)

## Overview
This package implements the UX/UI overhaul designed in the "Budget app analysis" workspace: the 32-finding audit of the Expo/React Native/Supabase codebase and the 21 approved screen designs (mockups 1a–1e, 2a–2d, 3a–3e, 4a–4e, 5a–5b). Primary sample market: United States (Miller Family · USD · Austin, TX); turns 1–3 retain the cross-border OFW example the product must also serve. Direction locked with the founder: **keep the ibilly identity** (indigo, bento tiles, Plus Jakarta Sans), adopt the **spent-vs-budget hero**, adopt **option 6's insight stats**, and spend the effort on the **desktop/web layout**.

## About the Design Files
The bundled `.dc.html` files are **design references created in HTML** — they show intended look and behavior, and are NOT production code. The task is to **recreate these designs inside the existing codebase** (TypeScript + React Native + Expo Router + Supabase), using its established patterns: `components/theme.ts` tokens, `components/ui/*` primitives, `features/*/api.ts` queries, i18n via locale keys (never hard-coded strings), money in minor units. The copies in this folder reference workspace-relative assets, so open the originals at the project root for a live preview; use this README as the source of truth.

## Fidelity
**High-fidelity** for layout, hierarchy, spacing intent, color roles and component treatments — recreate faithfully with the codebase's tokens. **Illustrative** for all data (amounts, FX rates, store names, prices): everything shown must come from the existing queries listed per screen. Glyphs shown as unicode/emoji in mocks = Feather icons in the app (mapping given per screen).

## Design Tokens (already in `components/theme.ts` — do not fork)
- brand `#4343D5` · brandDeep `#2E2BC2` · brandMuted `#E1E0FF`
- accent `#944A1C` · accentMuted `#FFDBCA` · tertiary `#00617E`
- text `#161D1F` · textMuted `#464555` · background `#F4FAFD` · surface `#FFFFFF`
- field `#F1F3F9` · surfaceMuted `#E8EFF1` · border `#C7C4D7`
- danger `#BA1A1A` · dangerMuted `#FFDAD6` · success `#1E7B45` · successMuted `#D8EFE1`
- spacing 4/8/16/24/32/48 · radius 4/8/12/16/24/pill · elevation tile `0 4px 20px rgba(0,0,0,0.04)` / raised `0 8px 28px rgba(0,0,0,0.08)`
- Type: Plus Jakarta Sans (Latin), Readex Pro (Arabic) — per `lib/fonts.ts`

### Token ADDITIONS required (mockup 3d)
- `typography.subheading`: 18px / 600 / lineHeight 24 — list-row titles (replaces misused 24px `heading` in rows)
- `typography.moneyMin`: 14px / 600, `fontVariant: ['tabular-nums']` — the floor for any rendered amount (nothing below 14px)
- `Button` variants: add `danger` (bg `palette.danger`, white label) and `dangerQuiet` (text-only, `palette.danger`); delete per-screen style overrides
- Hover + focus (web): Pressable `hovered` → tint (`field` on white, `brandMuted` on active items) + shadow lift; `focus-visible` → 2px `brand` ring, offset 2 — implement ONCE in Button/Chip/ListRow/Card/rows

## Component-level changes (apply before screens)
1. **One Card** (F16): delete local `styles.card` copies in `app/(tabs)/grocery.tsx`, `app/retail/index.tsx`, `app/household/index.tsx`, `app/subscription.tsx`, `app/grocery/compare/[id].tsx` — use `ui/Card` with style overrides.
2. **Chip semantics** (F30): one shared `Chip` with `accessibilityRole="radio"|"checkbox"` + `accessibilityState.selected`, leading ✓ glyph when selected (selection never color-only). Replace inline chip Pressables in `finance/entry.tsx`, `grocery/[id].tsx`, `finance/budgets.tsx`.
3. **Dates** (F27): `lib/format.ts` gains `formatDateRange(startISO, endISO, locale)` via `Intl.DateTimeFormat.formatRange` — replaces `"${period_start} → ${period_end}"` in `finance/budgets.tsx`.
4. **Amount input** (F29): parse with locale decimal separator (accept "12,50" under fil/ar formats) before `toMinorUnits`.
5. **Currency display** (F26): when a household holds >1 currency, format with code disambiguation (e.g. `SAR 6,500.00`, `US$`), plus `≈ reporting` caption where space allows (see 1c/2b).
6. **EmptyState everywhere** (F19): grocery, household, retail lists get icon + message + CTA (component exists).

## Screens / Views

### 1a Home — mobile (fixes F05 F06 F03 F28)
- Header: greeting (`textMuted` 13), **household switcher** as a white pill button "Santos Family · PHP ▾" (opens household picker — F03), avatar 42px `brand` circle w/ initials.
- Hero (brand `#4343D5`, radius 24, elevation raised, padding 22/20, white text): label "Spent in {month}" 13/600 @85%; amount 34/800 (decimals 20 @80%); 8px meter (track white@22%, fill `accentMuted`); row "62% of ₱78,000 budget" ↔ "₱x left · N days" 12.5 @92%.
  - **Free plan**: below a 1px white@20% rule — per-currency balance rows ("PHP accounts / SAR accounts", 13.5, bold values) + ONE quiet upsell row (white@12% fill, radius 12): "See it as one total in PHP" + `accentMuted` PREMIUM pill. No locked hero, ever.
  - **Premium**: consolidated total + caption "Rates as of {date} · 1 SAR = ₱15.21 →" linking to `/finance/rates` (F28). "Manage FX rates" LEAVES the quick actions.
- Quick actions: 4 white tiles (radius 16, elevation tile): Income ↙ (`successMuted`/`success`), Expense ↗ (`brandMuted`/`brand`), Transfer ⇄, **Compare** (`accentMuted`/`accent`) → basket compare. Feather: arrow-down-left, arrow-up-right, repeat, shopping-bag.
- Recent card: 2–3 latest from the already-fetched `listTransactions` (38px radius-12 icon tile, name 13.5/600, caption 11.5 muted, amount right 13.5/700, income in `success`), "All transactions →" link.
- Budget snapshot card: top 2 category meters (6px, `field` track), "Plan →".
- Data: `listAccounts`, `listAccountBalances`, `listLatestRates`, `listTransactions`, `sumInReporting`, entitlements `has('multi_currency_dashboard')`.

### 1b Plan tab — mobile (fixes F01 F04)
Replaces `app/(tabs)/budget.tsx` stub. August/July segmented control (surfaceMuted track, white active pill). Cards: (1) month ring — 92px conic `brand` on `field`, center "62% used"; right: "₱29,879 left" 21/800, spent/limit caption, "Safe to spend ₱/day" in `brand`; (2) Budgets card: rows icon-tile + meter + "₱x left" / "over by ₱x" (`danger`, full red meter); row tap → Activity pre-filtered by category+month (F04); (3) Goals + Debts half-tiles (goal meter in `accent`; debts total + "next due" date in `danger`). "Manage →" links to `/finance/budgets`, `/finance/goals`, `/finance/debts`. Data: `listBudgets`, `listBudgetStatus`, `budgetRemainingMinor`, goals + debts queries.

### 1c Activity — mobile (fixes F08 F09 F10 F26)
Search field (white, radius 16); filter chips row (Month ▾ active in `brand`, All types ▾, All accounts ▾); In/Out/Net summary card (3 columns, 15/800, In `success`, Net `brand`); day-grouped rows with **chevron ›** (tap → 3a edit sheet), NO trash icons; foreign amounts show code + `≈ ₱x` caption. Swipe-left = quick delete (confirm kept).

### 1d Grocery list — mobile (fixes F11 F12 F17)
- Sticky header: back, list name, "Compare" text-button (`brand`), ⋯ overflow (holds Delete list — dangerQuiet + confirm); 7px progress bar (`success`), "4 of 9"; Est ↔ Actual row; **pinned quick-add bar** (white, radius 14: ＋, placeholder "Add item — try 'Milk 1L ×2'", brand Add pill).
- Item rows (Card radius 16): leading **26px tick circle** (≥44px hit target; border 2.5 `border`; done = `success` fill + white ✓), name 14/700 + "×qty", caption "member · est ₱x · link/linked product ↗" (`brand`), price right. Done rows: `#EDF3F0` bg, strikethrough, "bought by X · paid ₱x".
- Tick behavior (F12): marking purchased prompts once, optionally, for actual price — prefilled with estimate (sheet/inline stepper). No per-row buttons or always-visible fields.
- Pinned bottom CTA: "Finish shopping — log ₱{actual} as expense" (brand, radius 16, glow shadow) → checkout sheet (account/category via 3b-style pickers) → existing `completeList`.

### 1e Home — desktop ≥1024 (fixes F21 F22 F23 F03 F24 F02)
Shell for ALL wide screens: white sidebar 232px (wordmark, **household switcher block** `field` radius 12 w/ ⇅, nav rows — active `brandMuted`/`brand` radius 10) + **fixed top bar** (title 17/800, search pill 220px, brand "＋ Add" pill, avatar). Content: 12-col grid, gap 18, padding 24/28, cap ~1200px. Tiles: hero span-5 (brand card: total, rates-as-of, 4 mini stats); spending trend span-4 (SVG line, "−12% vs July", avg/day + txn count); quick actions span-3 (2×2); recent activity span-7 (5-col row grid); grocery snapshot span-5 (progress, "Best basket: Puregold ₱2,860" in `accent`, Open list / Compare stores buttons).

### 2a Plan — desktop
Same shell. Ring card span-4 (brand bg, conic ring 96px w/ `accentMuted` arc, safe-to-spend chip white@14%); category budgets span-8 (2-col meter grid + "click a meter → filtered Activity" behavior); Goals span-4; Debts span-4 (total 22/800, two rows); "This month so far" span-4 (Spent / Avg-day / vs July `success` / Projected — 2×2, 17/800).

### 2b Activity — desktop
Five filter chips (month/type/account/category/member); 5 stat tiles (In, Out, Net, Avg/day, Transactions); **table** (white, radius 18): grid `110px 1fr 150px 160px 120px 150px 44px` — DATE / DESCRIPTION / CATEGORY (tinted pill: brandMuted, successMuted, accentMuted, dangerMuted) / ACCOUNT / BY / AMOUNT (right, code + ≈ caption on foreign) / ✎. Hover row = `#F7F9FE` tint revealing ✎ → same edit sheet as 3a. Header row 10.5/700 letterspaced `textMuted`.

### 2c Shop — desktop (fixes F02 F11 F21)
Top bar: "Shop" + segmented **Lists · Stores · Coupons** (replaces More → Retail; move retail hub content under Stores/Coupons segments). Master-detail: left 300px list cards (active list w/ 4px `brand` inline-start bar, live dot `success`, progress, est; completed = muted `#EDF3F0`); right: list detail table (tick / ITEM w/ product link / QTY / EST / ACTUAL / BY) + footer Est·Actual + "Finish shopping" brand button; **Compare card** below: 3 store tiles — cheapest gets 2px `accent` border, `#FFF7F2` bg, CHEAPEST pill, total 19/800, "9 of 9 priced · save ₱260"; caption "near {location} · prices as of {date}"; coupon line "🏷 Coupons could save another ₱145" in `accent`. Data: `listLists`, `listItems`, `compareColumns`, `bestFloorMinor`, coupon savings from `listCouponsForProduct` + `applyCoupon`.

### 2d Insights — desktop (premium; fixes F24, adopts concept 6)
PREMIUM pill (`accentMuted`/`accent`); Month/Quarter/Year segmented. Trend card span-8: cumulative August line (`brand` 3.5px) vs July (dashed `border`), gridlines `#EEF1F6`, legend; 4 stat tiles span-4 (Total spent −12% `success`, Avg/day, Transactions +3 `danger`, Sent home); "Where August went" span-7: category bars (8px) colored from `chartSeries`, label + "₱x · %"; **Cross-border card** span-5 (brand bg): Earned in SAR ≈ ₱, Sent home, Rate used + date, one-line insight ("₱1,240 better than July's rate"). Gate: `has('multi_currency_dashboard')` or new capability. All numbers derive from existing transactions + FX snapshot queries.

### 3a Transaction edit sheet (fixes F08 F09 F14 F15)
Bottom sheet (web: centered dialog) over dimmed feed: grab handle, "Edit transaction" + ✕; amount block (`field` radius 14, label "Amount · {ccy}" 11/600, value 28/800); select rows in a bordered radius-16 group — Account ›, Category ›, **Date ›** (Today/Yesterday/picker — enables backdating), Note; "Save changes" brand button; "Delete transaction" dangerQuiet centered below (keeps confirm). Select rows open searchable pickers (3b pattern) — replaces chip clouds at scale (chips remain fine ≤6 options). Dev: reuse `finance/entry.tsx` form with `initialValues`; add `updateTransaction()` to `features/finance/api`.

### 3b Currency picker (fixes F25 F15)
Full-screen/sheet: explainer line; search (matches code, name, symbol); SUGGESTED section from device locale (selected = `brandMuted` row, ✓); ALL CURRENCIES list rows (38px symbol tile `field`, code 14/700, name 12 muted); "Use {code}" brand CTA. Source: `Intl.supportedValuesOf('currency')` + `Intl.DisplayNames`. Reused by: household create (3c), account create, FX rates.

### 3c Create-modal pattern (fixes F13 F19 F25)
"+" in header opens a sheet (pattern already in `grocery/new`, `budget-new` — replicate for household create, retailer create, allocation add). Household sheet: Name field (`field` fill); grouped rows — Reporting currency › (opens 3b), cross-border toggle with explainer "Turns on remittance tracking and FX views" (the spec's onboarding question, in place); "Create household" CTA; "Have an invite code? Join instead" link. Behind it: the list screen shows a REAL EmptyState (icon tile, "No households yet", CTA).

### 4a Login
Brand mark (52px radius-16 `brand` tile), "Welcome back" 24/800, subtitle from the product promise. Email + password fields (white, 1px `#EEF1F6` border, radius 12) with password visibility eye; "Forgot password?" right-aligned link; brand "Sign in" CTA; "or" divider; method buttons — Google (white outlined), Apple (ink `text` fill), "Email me a code instead" (`brandMuted`/`brand`, = email OTP); "Create an account" footer link. Social buttons render once providers are configured (spec 03); layout ships now.

### 4b Onboarding — cross-border step
3-step flow (progress segments in `brand`): 1 household name + currency (via 3b), 2 “Do members of your household live in different countries?” — two option cards (unselected: white, 1px border; selected: `brandMuted` bg + 2px `brand` border + ✓ badge) where the cross-border card explains what it activates (remittance tracking, money sent/received home, FX history, chosen-currency totals), 3 invite members. Footer: “You can change this anytime in Household settings.” Sets `is_cross_border` and activates the cross-border UX (2d card, remittance category).

### 4c Dark theme (post-beta)
Token-only reskin — second palette object: bg `#0F1417`, surface `#1A2126`, field `#232B31`, text `#E9EEF1`, textMuted `#9AA5AC`, brand-on-dark `#8B8BF7` (links/active), success `#4FBF7F`, accent-on-dark `#FFB68C`, icon tile fills `#262650`/`#10331F`/`#3D2417`; hero card keeps `#4343D5`. Requires its own contrast QA pass. Ship as a setting.

### 4d Shop → Stores (desktop)
Stores segment of the 2c shell: active-location banner (📍 tile, “Shopping near: {label} — {store}”, why-it-matters caption, “Change location” pill); retailer cards 3-up (name, country, “N branches · N prices”, freshness pill — `successMuted`/`success` “updated {date}” or `dangerMuted`/`danger` “stale — {date}” per the spec's visible-freshness rule); saved locations rows with “✓ Active” / “Set active” pill. “＋ Add retailer” in the top bar opens a 3c-pattern modal. Products list lives inside each retailer's detail.

### 4e Shop → Coupons (mobile)
PREMIUM pill; location scope line; `accent` banner “₱{n} applies to your {list}”; coupon cards with 4px `accent` inline-start bar — offer 14/700, savings right in `accent`, meta “retailer · conditions · until {date}” (expiry <7 days in `danger`), “On your list ✓ — {item}” in `brand`; non-matching coupons at 85% opacity. Savings roll up into Compare (2c). Data: `listCouponsForProduct` + `applyCoupon` against active-list items.

### 5a Add retailer — seeded directory (US primary)
Replaces free-typed retailer names. Country pill (defaults from household/device locale, 🇺🇸 United States first) + type filter + search; "Popular near {city}" list rows: 38px monogram tile, name 14/700, kind caption ("Supercenter · grocery", "warehouse · membership"), trailing "Add" pill (`field`/`brand`) → "✓ Added" (`brand` fill). US seed set: Walmart, Target, H-E-B, Kroger, Costco, Aldi, Trader Joe's, Safeway, Publix, Sam's Club, Whole Foods, Meijer, Wegmans, Walgreens, CVS, Dollar General. Dashed "Can't find your store? Add custom retailer →" card keeps the manual flow as fallback.
Dev: global read-only `retailer_directory` table (country_code, name, kind, brand_key), seeded per launch market; "Add" calls existing `createRetailer` copying the row + storing `brand_key` (the hook licensed price connectors attach to later). Public read, no RLS change. Manual per-branch prices unchanged.

### 5b Branch picker
After picking a retailer: city/ZIP search, nearest-first branch rows (📍 tile, "Walmart Supercenter — S 1st St", "Austin, TX 78704 · 2.1 mi"), selected row `brandMuted` + ✓; dashed "Branch not listed? Add it manually →"; ink explainer card (prices are per branch; Compare ranks branches; freshness pill shows age); CTA "Save & set as my location" chains `createStore` + `setActiveLocation`. Seeded branch data arrives with connectors — until then branches remain household-created rows on the existing store/branch model.

### 3e Subscription (regional pricing)
Free card: CURRENT pill + one honest sentence (free stays useful). Premium card (brand bg, raised): price **in local currency** ("₱149/month · Priced for the Philippines · ₱1,490/yr") — never USD-only; 4 benefit rows framed as jobs (one total across currencies / basket compare / coupons / insights) with `accentMuted` ✓; white "Try Premium — 14 days free" CTA. Footer: billed via App Store/Play in local currency; owner-only rule stated. `__DEV__` toggle stays dev-only.

## Interactions & Behavior
- Navigation: bottom tabs (mobile) ↔ sidebar+topbar (≥1024px, `useIsWideLayout`) — tab labels become Home · Plan · Activity · Shop · More (+ Insights when premium).
- All destructive actions: never surfaced as row-level icons; inside edit sheets/⋯ menus with the existing confirm ActionSheet; filled `danger` buttons only inside confirms.
- Meters/rows deep-link: budget meter → Activity filtered (category+period); donut slice → category report.
- Realtime: grocery list detail keeps `subscribeToItems` live updates; desktop Shop detail too.
- Loading: existing ActivityIndicator patterns; Errors: `ErrorNotice` with retry, everywhere.
- Transitions: sheets slide-up 250ms ease-out; hover lift 120ms; no other animation.

## State Management
No new global state. Additions: `updateTransaction(id, patch)` in finance api; Activity filter state (month/type/account/category/member) local per screen; entitlement gates via existing `usePlan().has()`. Cloud stays authoritative; all writes through existing `features/*/api.ts` + RLS.

## Accessibility (bake in as you build)
Chips/ticks: role + selected state + non-color cue. Charts: `accessibilityLabel` summarizing top slices + total (F31). Targets ≥44px (tick circles, row heights, icon buttons). Money ≥14px tabular. Web: focus-visible ring, logical tab order top-bar → content.

## Assets
No new imagery. Icons: Feather (`@expo/vector-icons`) throughout. Fonts already loaded via `lib/fonts.ts`.

## Order of work (per the audit roadmap)
1. Component layer: variants, Chip, Card unification, subheading/moneyMin, formatRange, locale amount parsing
2. F08 edit sheet (3a) + F14 date · F05 free hero (1a) · F01 Plan tab (1b) · F25 picker (3b)
3. Desktop shell + screens (1e, 2a, 2b) · form caps (~480px) on remaining screens
4. Grocery in-store mode (1d) + desktop Shop (2c) · create-modals (3c)
5. Insights (2d) · Subscription (3e)
6. Extras when scheduled: Login (4a) · Onboarding (4b) · Stores/Coupons (4d 4e) · Dark theme (4c, post-beta)
7. Retailer directory + branch picker (5a 5b) — seed table first, then swap the add-retailer entry point

## Files in this bundle
- `README.md` — this document (source of truth)
- `Redesign Mockups.dc.html` — turns 1–3, screens 1a–3e (open the original at project root for live preview + Tweaks)
- `UX Audit — Global Household App.dc.html` — full findings F01–F32 with evidence paths
- `Findings Deck.dc.html` — 12-slide summary
- `screenshots/01–08-mockups.png` — canvas captures (01 turn-4 mobile trio, 02 Stores, 03 edit sheet + picker, 04 primitives board, 05 desktop Plan, 06 desktop Shop, 07 turn-1 mobile screens, 08 desktop Home)
