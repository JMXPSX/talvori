# 4b — Onboarding cross-border question (design)

Date: 2026-08-22
Status: approved (chat), pre-implementation
Slice: UX overhaul 4b (subset — the cross-border question only)

## Intent

The UX-overhaul mockup 4b frames "Do members of your household live in
different countries?" as step 2 of a 3-step onboarding wizard. This repo already
ships a create-household screen (`app/household/new.tsx`, slice 3c) with name +
reporting currency + a plain cross-border `Switch`. Rather than build a second,
overlapping wizard, we **fold the 4b cross-border question into the existing
create screen**, upgrading the bland Switch into the mockup's two-card decision.

Scope is deliberately the cross-border *question* — not the full wizard, not a
new route, not a data-model change.

## Non-goals

- No `/onboarding` route or multi-step wizard (name/currency already collected on
  this screen; invite members already exists at `app/household/[id].tsx`).
- No schema/RPC change: `households.is_cross_border` and `createHousehold`
  (`_is_cross_border`) already exist and are unchanged.
- No change to what cross-border *activates* downstream (2d insights card,
  remittance category) — only how the choice is presented.

## Change

In `app/household/new.tsx`, replace the `switchRow` block (the `Switch` +
label/explainer) with a cross-border question block. Name + `CurrencyField`,
the Create button, and the "Join instead" link are unchanged.

The block:

1. **Question** — a heading: *"Do members of your household live in different
   countries?"*
2. **Two selectable cards** — a radio pair bound to the existing `crossBorder`
   boolean:
   - **"We're all in one country"** — *"One currency, one set of choices."*
     (selects `crossBorder = false`)
   - **"We live in different countries"** — *"e.g. working abroad, family at
     home"* + activation line *"Turns on remittance tracking, money sent and
     received home, FX history, and totals in your chosen currency."*
     (selects `crossBorder = true`)
3. **Footer note** (muted caption): *"You can change this anytime in Household
   settings."*

## Behavior

- Default selection is **"one country" (`crossBorder = false`)**, matching the
  screen's current default. There is always exactly one selected card; no forced
  empty state.
- Selecting a card sets `crossBorder`; submission is unchanged
  (`validate(createHouseholdSchema, { …, isCrossBorder: crossBorder })`).

## Visual (tokens only)

- Selected card: `palette.brandMuted` fill, 2px `palette.brand` border, a trailing
  ✓ badge.
- Unselected card: `palette.surface` fill, 1px `palette.border`.
- Radius `radius.lg`, padding `spacing.md`, gap `spacing.sm`.
- The ✓ glyph is a non-color selection cue, satisfying the F30 rule (selection is
  never color-only). `accessibilityRole="radio"`, `accessibilityState.selected`,
  ≥44px hit target.

## Component

`OptionCard` — a small radio-style card — lives locally in `new.tsx`. It is
screen-specific for now (YAGNI); promote to `components/ui` only if a later
onboarding slice needs it.

## i18n

Add to `locales/{en,fil,ar}.json` under `household` (matching key sets):

- `crossBorderQuestion`
- `crossBorderOneCountryTitle`, `crossBorderOneCountryCaption`
- `crossBorderMultiTitle`, `crossBorderMultiCaption`, `crossBorderActivates`
- `crossBorderChangeNote`
- `crossBorderSelected` (a11y label suffix, e.g. "selected")

Remove the now-unused `crossBorderLabel` and `crossBorderExplainer` (used only by
this screen). Key-set parity is enforced by `tests/lib/i18n.test.ts`.

## Testing

Selection is trivial boolean UI state — no new pure module to unit-test.
Verification: `npm run typecheck`, the i18n parity test, and a manual look on
web. Consistent with the project's "screens are not render-tested" convention.
