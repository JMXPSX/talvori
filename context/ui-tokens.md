# UI Tokens

> **Adapted to Expo / React Native.** JSM's original assumes Tailwind v4 `@theme` +
> `globals.css`; we have neither. Our single source of design truth is
> **`components/theme.ts`** (the "ibilly / Expertly Approachable" direction, adopted from the
> Google Stitch export). Token *names* are the public API every screen calls — only their
> values change on a reskin. This file transcribes those tokens; `components/theme.ts` wins on
> any discrepancy.

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

> **Heads-up:** a vermilion "Broadsheet Ledger" redesign is proposed in
> [`design-proposal.md`](design-proposal.md). It is **not shipped** — this file (indigo ibilly,
> matching `components/theme.ts`) remains current truth until the reskin is executed.

## Palette

| Token | Value | Use |
|-------|-------|-----|
| `brand` | `#4343D5` | indigo — primary actions |
| `brandDeep` | `#2E2BC2` | pressed / emphasis |
| `brandMuted` | `#E1E0FF` | meters, chips, muted fills |
| `accent` | `#944A1C` | burnt orange — warmth/"growth", legible as ink on light |
| `accentMuted` | `#FFDBCA` | tinted accent fills |
| `text` | `#161D1F` | deep slate ink |
| `textMuted` | `#464555` | secondary text |
| `background` | `#F4FAFD` | cool blue-white canvas |
| `surface` | `#FFFFFF` | bento tiles (brighter than canvas) |
| `field` | `#F1F3F9` | input fills (so fields read inside white tiles) |
| `border` | `#C7C4D7` | soft hairline — used sparingly; depth comes from shadow |
| `tertiary` | `#00617E` | sky — informational + secondary data series |
| `surfaceMuted` | `#E8EFF1` | inset panels, segmented-control tracks |
| `danger` / `dangerMuted` | `#BA1A1A` / `#FFDAD6` | error ink / container |
| `success` / `successMuted` | `#1E7B45` / `#D8EFE1` | success ink / income tiles |

**Chart series** (`chartSeries`): indigo → burnt-orange → sky → red → violet `#7C5CBF` →
green → light-sky `#8AD0F1` → slate `#767586`. Lives in `theme.ts` so the palette has one home
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
