# UI Tokens

> **Adapted to Expo / React Native.** JSM's original assumes Tailwind v4 `@theme` +
> `globals.css`; we have neither. Our single source of design truth is
> **`components/theme.ts`** — the **Talvori** design system (purple/navy/teal/orange, Plus Jakarta
> Sans; brand "Talvori", tagline "One plan. Everyone. Together."). Token *names* are the public
> API every screen calls — only their values change on a reskin. This file transcribes those
> tokens; `components/theme.ts` wins on any discrepancy.

## How to use

```ts
import { palette, spacing, radius, typography, elevation } from '@/components/theme';

// ✅ correct — tokens as RN style values
<View style={{ backgroundColor: palette.surface, padding: spacing.md, borderRadius: radius.lg }} />

// ❌ wrong — raw hex / magic numbers / Tailwind-isms
<View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16 }} />
```

There are no utility classes and no CSS variables — tokens are imported and spread into RN
style objects.

## Palette

| Token | Value | Use |
|-------|-------|-----|
| `brand` | `#6D4CFF` | purple — primary actions, active nav, hero |
| `brandDeep` | `#5A38E8` | pressed / emphasis |
| `brandMuted` | `#EDE7FF` | meters, chips, muted fills (purple tint) |
| `accent` | `#F59E0B` | warm orange — shopping + goal accents (`#B45309` for small text) |
| `accentMuted` | `#FEF3C7` | tinted accent fills (amber) |
| `text` | `#0F172A` | navy ink / dark surfaces |
| `textMuted` | `#475569` | secondary text (tertiary text `#94A3B8`) |
| `background` | `#F6F7FB` | near-white app canvas |
| `surface` | `#FFFFFF` | white tiles (brighter than canvas) |
| `field` | `#F1F5F9` | input fills (so fields read inside white tiles) |
| `border` | `#E2E8F0` | soft hairline — used sparingly; depth comes from shadow |
| `tertiary` | `#3B82F6` | blue — informational + secondary data series |
| `surfaceMuted` | `#EDF1F7` | inset panels, segmented-control tracks |
| `danger` / `dangerMuted` | `#DC2626` / `#FEE2E2` | error ink / container |
| `success` / `successMuted` | `#14B8A6` / `#CCFBF1` | teal — income / positive / on-track |

**Chart series** (`chartSeries`): purple → warm-orange → blue → red → violet `#7C5CBF` →
teal → light-blue `#93C5FD` → slate `#94A3B8`. Lives in `theme.ts` so the palette has one home
(`features/finance/donut.ts` imports it).

## Typography

Absolute pixel line heights (RN has no unitless ratios). Consume via `<Text variant="…">`.

| Variant | Size / weight / line-height | Role |
|---------|------------------------------|------|
| `title` | 28 / 700 / 34, tracking −0.5 | screen title |
| `heading` | 24 / 600 / 31 | section heading |
| `subheading` | 18 / 600 / 24 | list-row / card titles |
| `body` | 16 / 400 / 26 | body copy |
| `button` | 16 / 600 / 19 | button label |
| `eyebrow` | 14 / 600 / 17, tracking 0.14 | section label (sentence-case — no uppercase style) |
| `caption` | 12 / 500 / 14 | captions/meta |
| `moneyMin` | 14 / 600 / 18, tabular-nums | **floor** for any rendered amount; digits align in columns |

Fonts resolve through `lib/fonts.ts` (script-aware; never system fallbacks). See `ui-rules.md`.

## Spacing

`xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48`. (`md` = Stitch mobile margin, `lg` = gutter.)

## Radius

`sm 4 · control 8 (buttons + chips) · md 12 · lg 16 (standard bento container) · xl 24 (hero
tiles) · pill 999`.

## Elevation

Cards are **borderless white bento tiles that float via soft ambient shadow**, not hairline
rules. Use `boxShadow` (the `shadow*` props are deprecated):
- `elevation.tile` = `0px 4px 20px rgba(0,0,0,0.04)`
- `elevation.raised` = `0px 8px 28px rgba(0,0,0,0.08)`

## Focus ring (web)

`webFocusRing` — a 2px `palette.brand` outline offset from the box (keyboard focus, F22).
`outline*` is a react-native-web style key; it is **platform-gated to web** (empty object on
native, so it composes harmlessly). Spread into a Pressable's `focused` state style.

## Invariants

1. Never hardcode hex, spacing, or radius — import from `@/components/theme`.
2. The palette is closed: only `theme.ts` values. No new colors inline.
3. Depth comes from shadow (`elevation.*`), not borders. Cards are white on the canvas.
4. Fonts resolve through `lib/fonts.ts`; no system-font fallbacks.
5. Any rendered amount uses at least `moneyMin` (14px, tabular-nums) — nothing smaller.
