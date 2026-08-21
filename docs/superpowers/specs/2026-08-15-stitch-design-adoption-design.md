# Stitch "ibilly" design adoption — design

**Date:** 2026-08-15
**Status:** Approved for slices A+B
**Source:** `stitch_universal_budget_tracker/` export (Google Stitch), `ibilly/DESIGN.md`

## Intent

Replace the "Ledger & Remittance" design direction (money-teal + remittance-gold on
warm paper) with the Stitch-generated "ibilly" system: indigo primary on cool
blue-white, Plus Jakarta Sans, borderless bento cards with soft ambient shadows.

This is a **rebrand, not a reskin**. The teal/gold identity is retired.

## Source material

The export contains four screen mocks (`ibilly_dashboard`, `ibilly_web_dashboard`,
`budget_settings`, `money_flow`) plus `ibilly/DESIGN.md`, which carries the design
system as YAML frontmatter (~40 Material 3 colour tokens, 8 typography roles, radius
and spacing scales) followed by prose on brand, elevation, shape and components.

The mocks cover roughly two of the app's 38 screens. `budget_settings` fuses budgets,
loyalty cards and settings into one page; `money_flow` has no direct equivalent and is
closest to the Transactions tab. **The remaining ~36 screens have no visual reference**
and must be derived from the system, not copied from a mock.

### Deviations from DESIGN.md prose

- **Gradients are dropped.** The prose calls for gradient primary buttons, gradient
  headline fills and a radial background wash. The exported PNGs render all of these
  flat. React Native has no CSS gradients; matching the prose would cost
  `expo-linear-gradient`, an SVG layer beneath all 38 screens, and a masked-view
  package for text fills. We use solid fills. Revisit additively if missed.
- **`title` is 28px**, not their `headline-lg` 32 (a desktop size) nor
  `headline-lg-mobile` 24 (which would collide with `heading`).
- **Loyalty "Cards" does not become a tab.** It is deferred 5d work with no backend.

## Decomposition

Full adoption is four sub-projects. Each gets its own spec → plan → execute cycle.

| Slice | Scope | Depends on |
|---|---|---|
| **A** Token layer | `theme.ts`, `fonts.ts`, chart series | — |
| **B** Primitives | the 11 components in `components/ui/` | A |
| **C** Flagship screens | dashboard, budget, transactions (the mocked ones) | B |
| **D** Long tail | remaining ~33 screens conformed to C's patterns | C |

**A+B are specced and executed together** as one foundation slice.

### Status (updated 2026-08-15)

A and B are complete. Slice C then absorbed a requirement the original
decomposition did not anticipate — **adaptive navigation** — and was executed
incrementally rather than from its own spec:

- **C0 adaptive nav (done)** — sidebar above 1024px, bottom tabs below, split by
  viewport width rather than `Platform.OS` because the app ships as a Web-PWA.
  Reuses the existing Tabs navigator via `tabBarPosition: 'left' | 'right'`.
- **C1 bento grid + dashboard (done)** — `BentoRow` / `BentoPage`; the dashboard
  moves from a flat stack to weighted tiles in two rows.
- **C2 tab screens (done)** — budget, transactions, grocery, account conformed;
  `Screen` now caps content width on wide viewports, which propagates the
  desktop treatment to every route that uses it.
- **C3 finance detail screens (done)** — budgets/goals/debts/categories, plus the
  two primitives they were each hand-rolling: `ProgressRing` (the mock's
  per-category ring) and `Chip`. Slice B deliberately deferred these until real
  screens defined their requirements, which is how it played out — `ProgressRing`
  took ProgressBar's `(fraction, state)` contract, and `Chip` gained a `tint`
  prop that a mockup-first design would have missed.

- **D long tail (done)** — applied by codemod rather than hand edits, because the
  screens repeated three declarations verbatim: the bordered card style (15
  files), the uncapped scroll content container (26 files), and the outlined chip
  (8 files). No JSX was restructured; the chips' existing label-colour logic
  already matched the `Chip` primitive, so only fills changed.

**Known debt.** Several screens still declare their own `card` and `chip` styles
rather than using the `Card` / `Chip` primitives. The styles now match, so they
render correctly and the palette flows from the theme, but the duplication should
collapse into the primitives when those screens are next opened for other
reasons. Doing it now would mean restructuring JSX in ~20 files that cannot be
visually verified from here.

**Verification ceiling.** Everything past the login screen sits behind the auth
gate, so the primitives are verified exhaustively at `/dev/theme` while the real
screens are verified only by typecheck, lint, tests, and the fact that they
consume verified primitives. A human pass while signed in is the outstanding
step for slices C and D.

## Guiding principle: keep the names, change the values

Existing token and variant *names* are the public API that all 38 screens call. They
stay. Only their values change. This keeps the foundation slice to a handful of files
and lets every screen reskin for free.

Trade-off accepted: our vocabulary drifts from Stitch's, so a future Stitch export
needs manual mapping again. Worth it against renaming across 38 screens.

## Slice A — Token layer

### Palette

Same 12 names, new values:

| Token | Old | New | Stitch source |
|---|---|---|---|
| `brand` | `#0E6E5C` | `#4343D5` | `primary` |
| `brandDeep` | `#0A4E42` | `#2E2BC2` | `on-primary-fixed-variant` |
| `brandMuted` | `#D5E7E1` | `#E1E0FF` | `primary-fixed` |
| `accent` | `#E0A72E` | `#944A1C` | `secondary` |
| `accentMuted` | `#F6E7C4` | `#FFDBCA` | `secondary-fixed` |
| `text` | `#12211C` | `#161D1F` | `on-surface` |
| `textMuted` | `#4F5C54` | `#464555` | `on-surface-variant` |
| `background` | `#F3F5F2` | `#F4FAFD` | `surface` |
| `surface` | `#FFFFFF` | `#FFFFFF` | `surface-container-lowest` |
| `border` | `#E1E7E2` | `#C7C4D7` | `outline-variant` |
| `danger` | `#B23A2E` | `#BA1A1A` | `error` |
| `success` | `#1E7B45` | `#1E7B45` | *unchanged — Stitch has no success token* |
| `white` | `#FFFFFF` | `#FFFFFF` | — |

Four additions:

| Token | Value | Purpose | Stitch source |
|---|---|---|---|
| `field` | `#F1F3F9` | input fills | Components §Input Fields |
| `tertiary` | `#00617E` | chart series, informational | `tertiary` |
| `surfaceMuted` | `#E8EFF1` | inset panels, segmented tracks | `surface-container` |
| `dangerMuted` | `#FFDAD6` | ErrorNotice fill | `error-container` |

### Chart series

`features/finance/donut.ts` currently hardcodes `CATEGORY_COLORS` with the old hexes
(`'#0E6E5C', // teal (brand)`, `'#E0A72E', // gold (accent)`). This is a token leak:
editing `theme.ts` alone would leave the dashboard donut rendering teal and gold on an
indigo app.

Move the series to `theme.ts` as `chartSeries`:
`[brand, accent, tertiary, danger, '#7C5CBF', success]`, and have `donut.ts` import it.
`donut.ts` stays a pure module (theme is plain consts), so its jest tests are unaffected.

### Contrast

Verified ≥4.5:1: `text` and `textMuted` on both `surface` and `background`; `white` on
`brand`; `accent` and `danger` on `surface`.

**Rule:** never place white text on `accentMuted`, `brandMuted`, `dangerMuted` or
`field` — these are light fills and take dark ink only.

### Radius

`sm` 6→4, `md` 12 (unchanged), `lg` 18→16, `pill` 999 (unchanged). Adding `xl` 24 for
hero/bento containers and `control` 8 for buttons and chips (`DESIGN.md` `0.5rem`).

49 `radius.*` call sites across 31 files keep working: their names already align with
Stitch's own scale, and only `sm` and `lg` shift, each by 2px.

### Spacing

No change. The existing scale is already 8px-based, and Stitch's `margin-mobile` 16 and
`gutter` 24 equal the existing `md` and `lg`.

### Typography

Six variant names kept, all restyled. Line heights become RN absolute pixels.

| Variant | Old | New | Stitch source |
|---|---|---|---|
| `title` | 28/700, ls −0.5 | 28/700, lh 34, ls −0.5 | between `headline-lg` and `-mobile` |
| `heading` | 20/600, ls −0.2 | 24/600, lh 31 | `headline-md` |
| `body` | 16/400 | 16/400, lh 26 | `body-md` |
| `caption` | 13/400 | 12/500, lh 14 | `label-sm` |
| `button` | 16/600, ls +0.3 | 16/600, lh 19, ls 0 | `label-md` |
| `eyebrow` | 12/700, ls +1.1, **uppercase** | 14/600, lh 17, ls 0.14 | `label-md` |

**`eyebrow` loses its uppercase and tracking.** It is used app-wide for section labels
and the dashboard household name. Stitch has no uppercase label style — every section
label in the mocks is sentence-case. This is the single most visible break from the old
identity and is intentional. The variant name is retained so no call site changes.

### Fonts

Add `@expo-google-fonts/plus-jakarta-sans` at weights 400/500/600/700. Weight 800 is
skipped (`display-lg` has no consumer).

Arabic keeps Readex Pro entirely — Plus Jakarta Sans has no Arabic coverage. The
script-aware resolver in `lib/fonts.ts` already handles this.

`fontFamilyFor` gains a `caption` case (caption now wants weight 500; RN selects weight
by family name). Arabic caption falls back to `ReadexPro_400Regular`, as Readex has no
medium.

Once migrated, remove `@expo-google-fonts/inter` and `@expo-google-fonts/space-grotesk`.

## Slice B — Primitives

All 11 components in `components/ui/`. No new primitives: the segmented control, toggle
and progress ring the mocks show are built in slice C, against real screen requirements
rather than guessed ones.

| Component | Change |
|---|---|
| `Card` | Borderless. `boxShadow: '0px 4px 20px rgba(0,0,0,0.04)'`, `radius.lg`, padding `spacing.lg` (24). `accented` keeps its name but renders an `accentMuted` tinted surface instead of the gold left rule. |
| `Button` | Flat `brand` fill, white label, `radius.control`. Secondary is ghost: transparent with a 1px `border` hairline. |
| `TextField` | `field` fill, no resting border, 2px `brand` focus ring, `radius.control`. |
| `Text` | New variant styles; resolver gains the `caption` weight case. |
| `Screen` | `background` token, `spacing.lg` gutter. |
| `ListRow` | Borderless rows for use inside cards; separation by spacing, not rules. |
| `ProgressBar` | Rounded caps, `brandMuted` track, `brand` fill. |
| `Donut` | Rounded stroke caps ("soft stroke"), series from `chartSeries`. |
| `EmptyState` | Token pass. |
| `ErrorNotice` | `dangerMuted` fill, `danger` ink. |
| `ActionSheet` | Web modal restyled to bento (borderless, shadowed, `radius.xl`). |

### Shadow migration

The dev server currently warns `"shadow*" style props are deprecated. Use "boxShadow"`
from `Card.tsx` and the dashboard hero. `DESIGN.md`'s shadow is already written in
`boxShadow` syntax, so slice B clears this deprecation rather than carrying it forward.

## Verification

The codebase has **no screen rendering tests** by deliberate convention — screens are
verified by typecheck, the live RLS drill, and manual run. `tsc` will not catch a single
visual regression in this slice.

**Dev-only theme gallery.** Add `app/dev/theme.tsx`, `__DEV__`-gated the same way the 6a
plan toggle in `app/subscription.tsx` is, rendering every primitive in every state on one
scrollable page: all six text variants in Latin and Arabic, Card default and tinted,
Button primary/ghost/disabled, TextField idle/focused/error, ListRow, ProgressBar, Donut,
EmptyState, ErrorNotice, ActionSheet.

This is the only practical way to see the transient states (focus, error, empty) and the
Arabic faces before shipping them. It stays useful for slices C and D.

Then: `npm run typecheck`, `npm test` (the donut and component unit tests must stay
green), `npm run lint`, and a manual spot-check of five real screens.

## Out of scope

- **Dark mode.** `DESIGN.md` ships a light-only palette; the app has no dark mode today.
- **Screen layouts.** Slices C and D.
- **New primitives.** Slice C.
- **Renaming the app to "ibilly".** That is Stitch's invented brand, not a decision made here.
