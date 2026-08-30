# UI Rules

> **Adapted to Expo / React Native.** Interface behavior, layout, and interaction rules for the
> **Talvori** design system (purple/navy/teal/orange, Plus Jakarta Sans). Concrete specifications,
> not abstract guidelines. Tokens come from `components/theme.ts` (see `ui-tokens.md`); components
> come from `components/ui/` (see `ui-registry.md`).

## Fonts & direction

- Resolve every face through **`lib/fonts.ts`** — RN picks weight by *family name*, so the
  module maps (variant, isArabic) → Space Grotesk / Inter (Latin) or Readex Pro (Arabic).
  Fonts load as a gate in `app/_layout.tsx`. Never use system fallbacks.
- **RTL is first-class.** Use `lib/rtl.ts` (`direction`, `isRTLLanguage`) — never raw
  left/right. Layouts must not assume LTR. Test Arabic.

## Layout

- Screens use the `Screen` primitive as the canvas (`palette.background`, cool blue-white).
- Content is width-bounded on large screens: `CONTENT_MAX_WIDTH` for reading columns,
  `FORM_MAX_WIDTH` for forms (from `components/ui/Bento`). Use `BentoPage` / `BentoRow` for
  the tiled dashboard layout.
- Spacing uses the scale (`spacing.md` gutter default). No magic numbers.

## Navigation

- **Native:** `BottomTabBar` — Home, Budget, Transactions, Grocery, More.
- **Web/desktop:** `SideNav` (`SIDEBAR_WIDTH`).
- Feature stacks open from those; create-flows are **modal routes**.

## Cards / tiles

Every content section lives in a **borderless white bento tile** (`Card` / `BentoRow`) that
floats on the canvas via `elevation.tile` — **not** a colored background and **not** a hairline
border. Radius `radius.lg` (hero tiles `radius.xl`). Depth is shadow, not rules.

## Typography hierarchy

Use `<Text variant="…">`: `title` (screen), `heading` (section), `subheading` (row/card
title), `body`, `eyebrow` (sentence-case section label — no uppercase), `caption`. Any money
value renders at ≥ `moneyMin` with tabular figures so columns align.

## Buttons

`Button` variants: **primary** (indigo `brand`, white label), **secondary** (muted/tonal),
**ghost** (transparent, ink label). Radius `radius.control` (8) to stay tactile. Pressed uses
`brandDeep`. Web keyboard focus gets `webFocusRing`.

## Form inputs

`TextField` for text; **`CurrencyField`** for money (enters major units, converts at the
boundary via `lib/money.ts`). Field fill is `palette.field` so inputs read inside white tiles.
Focus state uses the brand color; placeholders use `textMuted`.

## Chips & badges

`Chip` — pill-shaped (`radius.pill`), used for filters, tags, and status (e.g. premium pill,
coupon match). Muted fills from `brandMuted` / `accentMuted` / status-muted tokens.

## Lists

`ListRow` for tappable rows (title `subheading`, supporting `caption`, optional trailing
value/chevron). Day-grouped transaction feeds. No alternating row stripes — separation comes
from spacing.

## Progress & data viz

`ProgressBar` / `ProgressRing` for budget meters and goals (states drive color: on-track vs
danger). `Donut` for category spending, colored by `chartSeries`.

## Empty states

Use the `EmptyState` primitive — minimal placeholder with optional icon + a single clear
action. Every list/feed has one.

## Confirmation & destructive actions

- **Never `Alert.alert`** (no-op on web). Use `useActionSheet` from `components/ui`; render
  `sheet.element` in the screen.
- Every entity has a **guarded delete**: trash affordance → ActionSheet confirm that names
  what cascades.

## Errors & retry

Surface failures via `ErrorNotice` (from normalized `AppError`), with retry affordance where
the action is retryable.

## Do-nots

- No raw hex / magic spacing / Tailwind color classes — tokens only (`ui-tokens.md`).
- No raw left/right — use `lib/rtl.ts`.
- No `Alert.alert`.
- No colored card backgrounds or hairline-bordered cards — white tiles + shadow.
- No money value below `moneyMin`; no non-tabular figures in aligned columns.
- No hard-coded copy — every string is a `t('…')` key in all three locales.
