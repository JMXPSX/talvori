# UX OVERHAUL — PHASE A IMPLEMENTATION PROMPT FOR CLAUDE

We are implementing the approved **UX overhaul** of the Global Household App.

You have been provided:
- The approved project context files (`00`–`11`) — still source of truth for architecture.
- `context/design/README.md` — source of truth for the UX overhaul (32 audit findings F01–F32, 21 approved screen designs 1a–5b).
- `context/design/Redesign Mockups.dc.html` + `screenshots/` — visual reference only; recreate in the existing codebase, never ship the HTML.

## IMPORTANT
Do NOT implement all 21 screens yet.

We are beginning only:

# UX PHASE A — COMPONENT LAYER

This phase changes shared primitives and tokens ONLY, so every later screen phase lands on corrected foundations. No screen redesigns in this phase beyond mechanical substitutions.

## Non-Negotiable Global Rules
1. All rules from `context/architecture.md` (non-negotiable architecture rules) remain in force.
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

## Later Phases (for context only — do not start)
- **Phase B** — Transaction edit sheet (3a), free-tier hero (1a), Plan tab (1b), currency picker (3b).
- **Phase C** — Desktop shell + screens (1e, 2a, 2b); form width caps.
- **Phase D** — Grocery in-store mode (1d), Shop tab (2c, 4d, 4e), create-modals (3c).
- **Phase E** — Insights (2d), Subscription (3e), onboarding (4b), login (4a).
- **Phase F** — Retailer directory seed + branch picker (5a, 5b); dark theme (4c) post-beta.
