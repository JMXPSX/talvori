# UX OVERHAUL — PHASE A IMPLEMENTATION PROMPT FOR CLAUDE

We are implementing the approved **UX overhaul** of the Global Household App.

You have been provided:
- The approved project context files (`00`–`11`) — still source of truth for architecture.
- `design_handoff_ux_overhaul/README.md` — source of truth for the UX overhaul (32 audit findings F01–F32, 21 approved screen designs 1a–5b).
- `design_handoff_ux_overhaul/Redesign Mockups.dc.html` + `screenshots/` — visual reference only; recreate in the existing codebase, never ship the HTML.

## IMPORTANT
Do NOT implement all 21 screens yet.

We are beginning only:

# UX PHASE A — COMPONENT LAYER

This phase changes shared primitives and tokens ONLY, so every later screen phase lands on corrected foundations. No screen redesigns in this phase beyond mechanical substitutions.

## Brand (Talvori)
The app is **Talvori** — apply the identity as part of Phase A's token work: rename the product everywhere (`app.json`, locale keys, any "ibilly" string), keep Plus Jakarta Sans, and replace the indigo token set with the brand palette: navy #0F172A, purple #6D4CFF (+#5A38E8 pressed, #EDE7FF tint), blue #3B82F6/#1D4ED8 on #EAF2FE, teal #14B8A6 (#0E9384 for small text), warm orange #F59E0B (#B45309 for small text), destructive #DC2626. The mark is `assets/talvori-mark.png`; the lockup is mark + lowercase "talvori" + "One plan. Everyone. Together.". No component may hard-code a color — extend `components/theme.ts`.

## Non-Negotiable Global Rules
1. All rules from `02_NON_NEGOTIABLE_ARCHITECTURE_RULES.md` remain in force.
2. Never hard-code a color, size, or font — extend `components/theme.ts`; screens consume tokens.
3. Never hard-code UI strings — every new label is a locale key in `locales/en.json`, `fil.json`, `ar.json`.
4. Money stays in minor units; no floating-point persistence.
5. Do not add npm dependencies without stating why and waiting for approval.
6. Do not touch Supabase schema, RLS, or `features/*/api.ts` query shapes in this phase (one exception: deliverable H below).
7. Do not restyle screens opportunistically — Phase B+ owns screen layouts.
8. RTL: every new style uses logical/direction-safe properties; no hard-coded left/right or "→" glyphs.

## Phase A Deliverables

### A. Button variants (F17)
Extend `components/ui/Button.tsx` with `danger` (filled `palette.danger`, white label) and `dangerQuiet` (text-only danger) variants. Replace the style-override delete buttons (e.g. `app/grocery/[id].tsx` `deleteButton`) with the variants. Filled `danger` is legal only inside confirm flows.

### B. Chip semantics (F30, F16)
Make `components/ui/Chip.tsx` the ONLY chip: `accessibilityRole` `"radio"` or `"checkbox"` per usage, `accessibilityState.selected`, leading check glyph when selected (selection never color-only). Replace the inline chip Pressables in `app/finance/entry.tsx`, `app/grocery/[id].tsx`, `app/finance/budgets.tsx`.

### C. Card unification (F16)
Delete the hand-rolled `styles.card` copies in `app/(tabs)/grocery.tsx`, `app/retail/index.tsx`, `app/household/index.tsx`, `app/subscription.tsx`, `app/grocery/compare/[id].tsx`; use `components/ui/Card` with style overrides where spacing differs.

### D. Typography additions (F20, F32)
Add to `components/theme.ts`: `subheading` (18px / 600 / lineHeight 24) and `moneyMin` (14px / 600, tabular numerals). Swap list-row titles currently using `heading` (24px) to `subheading`. No rendered amount below 14px.

### E. Localized dates (F27)
Add `formatDateRange(startISO, endISO, locale)` to `lib/format.ts` using `Intl.DateTimeFormat.formatRange`. Replace the raw `"${period_start} → ${period_end}"` in `app/finance/budgets.tsx`.

### F. Locale-aware amount input (F29)
Amount fields must accept the locale's decimal separator (e.g. "12,50") before `toMinorUnits`. Add a parse helper beside `lib/money.ts` with unit tests for en/fil/ar formats. Do not change stored representation.

### G. Web interaction states (F22)
In shared primitives only (Button, Chip, ListRow, Card-as-pressable, table/list rows): hover tint + pressed state via Pressable state props, and a visible keyboard focus ring (2px `palette.brand`, offset 2) on web. No per-screen one-offs.

### H. EmptyState rollout (F19)
Replace bare muted-text empty messages in grocery, household, and retail list screens with the existing `EmptyState` (icon + message + CTA). New strings are locale keys. This is the only permitted screen-file content change beyond mechanical substitution.

### I. Currency display disambiguation (F26)
Extend `lib/format.ts` so that when a household holds more than one currency, amounts render with an unambiguous code (e.g. `SAR 6,500.00`); single-currency households keep the plain symbol. Screens pass a flag or context — no per-screen formatting logic.

### J. Tests
Unit tests for D, E, F, I; snapshot/behavior tests for A and B (roles/states asserted).

## Before Writing Code
First output:
1. Files you intend to create/change (exact paths).
2. Any conflicts found between the handoff README and the existing code.
3. New locale keys you will add.
4. Anything in this phase you believe belongs in a later phase.

Then implement incrementally.

## For Every File
- State exact file path.
- Give complete file content.
- Explain purpose.
- Avoid unrelated modifications.

## Definition of Done for UX Phase A
- All five duplicate card styles deleted; one Card in use.
- Button has danger/dangerQuiet; no ad-hoc red overrides remain.
- One Chip component app-wide with roles/states; check glyph visible when selected.
- `subheading` + `moneyMin` tokens exist and are applied to list rows / amounts.
- Budget periods render localized ranges in en, fil, and ar (RTL verified).
- "12,50" parses correctly under a comma-decimal locale; tests pass.
- Hover + focus-visible states work in the web build; keyboard tab order sane.
- Empty grocery/household/retail lists show EmptyState with CTA.
- Mixed-currency amounts show codes; single-currency unchanged.
- `npm test` (or project test command) passes; app starts on iOS, Android, web.

At the end, provide a Phase A verification checklist.

Do NOT automatically continue to Phase B (screens).
Stop after Phase A and wait for developer review.

## Decided Money Model (from the interactive prototype)
`design_handoff_ux_overhaul/Flow Prototype.dc.html` is a runnable click-through of sign-in → onboarding → dashboard. It is a **behavior spec, not shippable code** — recreate it in React Native. The following decisions were made with the product owner during review and override anything looser in the older spec docs:

1. **Accounts are user-defined, plural, and renameable.** Seed two (`Checking`, `Savings`); the user can rename them to real banks ("BPI Checking", "Chase Savings"), add more, and delete down to a floor of two. Renaming must cascade to existing transactions (both legs of a transfer), category funding accounts, and the dashboard scope filter. Deleting re-points affected budgets to the first remaining account.
2. **Payroll is NOT an account.** Salary is income *into* Checking or Savings; its origin is captured by the `Salary` category. Account pickers therefore never list a payroll/holding account.
3. **Every category budget names its funding account** (`{limit, account}`). The Plan meter reads "… spent of … · paid from <account>". Migration: any legacy numeric limit is read as `{limit, account: 'Checking'}`.
4. **The dashboard hero is account-scoped.** Pills `All · <each account>` filter both halves of the ratio — spend from that account against the budgets funded by that account. Checking and Savings are never silently combined. The scope caption states what is in view.
5. **Dashboard "By account" is the account ledger surface**: one row per account with In / Out / Net for the month (transfers count on both legs; goal contributions and debt payments count as Out on their account). Rows are two-way synced with the hero scope — tapping a row focuses that account, tapping the focused row returns to All — and each row carries the ✎ affordance for rename/delete/add.
6. **Goals and debts write to the ledger.** A contribution or a debt payment posts a read-only transaction (🎯 `<goal> contribution · Goal`, 🧾 `<debt> payment · Debt payment`) and appends to that goal's/debt's own last-5 history list in Plan. They are excluded from budget "Spent" (saving is not category spending) and are not editable from Activity, since editing would desync the balance.
7. **Transfers exist in the data model but not in quick actions.** Keep the transfer transaction kind (neutral sign, excluded from In/Out/Net and from budget spend, both legs credited in By-account) and its same-account guard: the To picker excludes the current From account, and changing From auto-moves a colliding To. The dashboard quick-action row is three tiles — Income · Expense · Compare.
8. **Transaction edit is destructive-safe**: ✎ on income/expense rows only, opening the same sheet as creation with a two-tap-confirm delete.

## Shop Module — "Our Grocery List" (decided V1 scope)
Shop is a **grocery planning** surface for the household budget, NOT a retailer price-comparison product. Live worldwide retailer pricing is out of scope for V1: `priceComparisonEnabled = false`. Keep the concept architecturally possible (offers/stores can return later as "Compare prices — Beta" in supported countries) but ship none of its UI.

9. **Screen**: title "Our Grocery List", sub "<household> · Shared" → **Groceries budget** card (monthly budget, spent this month, meter, remaining) → **This week's list** (items remaining, estimated total, "After this trip ≈ X left") → **List | Start shopping** segmented control (exactly one mode visible, active state filled) → budget-intelligence line → the active mode's card.
10. **List mode**: shared household list. Item = `{id, name, qty, unit, price?, note?, status: need|cart|purchased, addedBy, createdAt}`; units each/pack/lb/oz/kg/g/L/mL/gallon/dozen. Adding is fast — name + qty + unit, with note and estimated price behind "More options". Rows show "Est. X" and "by <member>", tap to edit/remove, and **Buy again** chips come from purchase history.
11. **Estimates without any API**: item estimate = manual price if given, else **last price paid** from local purchase history. Unpriced items show "no estimate" and offer "Last paid X · use as estimate". Estimated is always labelled "Est."; only recorded purchases are actual amounts.
12. **Budget intelligence** beats price comparison for V1: "Your usual grocery trip is $79.75. This week's list is about $36 lower." (average of past trips vs current estimate), plus "After this trip ≈ X left" against the Groceries budget.
13. **Start shopping mode**: focused trip view — remaining count, groceries budget left, one row per item with a checkbox and an OPTIONAL price field (placeholder = the estimate), a live **running total**, plus **Finish shopping** and **Pause** (returns to List, keeps the checked state).
14. **Finish shopping** → Shopping complete: **free-text store name** (any retailer, any country — never a fixed list; recent stores offered as chips), estimated total, actual total (defaults to the running total), paid-from account, category (the Groceries budget's own name), date. **Record purchase** posts exactly ONE expense through the existing transaction/account/budget path, saves a trip `{store, estimated_total, actual_total, account, date, expense_transaction_id}`, writes the per-item prices into purchase history (so future lists self-estimate), flips checked items to purchased, and lands on Activity with a confirmation banner. Adding to a list NEVER creates an expense.
15. **Purchased items** collect in a Purchased section with "Clear purchased"; clearing keeps price history for Buy again and future estimates.
16. **Worldwide by construction**: household currency, its grocery budget, manual/estimated prices, purchase history, actual totals. No US retailer, store list, or country behavior is hardcoded anywhere.

## Later Phases (for context only — do not start)
- **Phase B** — Transaction edit sheet (3a), free-tier hero (1a), Plan tab (1b), currency picker (3b).
- **Phase C** — Desktop shell + screens (1e, 2a, 2b); form width caps.
- **Phase D** — Grocery in-store mode (1d), Shop tab (2c, 4d, 4e), create-modals (3c).
- **Phase E** — Insights (2d), Subscription (3e), onboarding (4b), login (4a).
- **Phase F** — Retailer directory seed + branch picker (5a, 5b); dark theme (4c) post-beta.
