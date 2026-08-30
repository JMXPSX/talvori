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

> **Heads-up:** a vermilion "Broadsheet Ledger" redesign is proposed in the
> [Appendix](#appendix--proposed-redesign-vermilion-broadsheet-ledger-not-shipped) at the end of
> this file. It is **not shipped** — the tokens below (indigo ibilly, matching
> `components/theme.ts`) remain current truth until the reskin is executed.

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

---

# Appendix — Proposed redesign: vermilion "Broadsheet Ledger" (NOT shipped)

> ⚠️ **Status: proposed, NOT shipped.** This is the vermilion "Broadsheet Ledger" direction
> produced by the `impeccable` skill (formerly `context/design-proposal.md`, now in git
> history). **The app in code today is still the indigo "ibilly" system** described in the
> body of this file above — that is current truth. Adopt anything below only when a reskin is
> scheduled and executed. The "ibilly is the anti-reference" framing in the text below is
> aspirational — the reverse of current reality — so do not act on it yet.

The `impeccable` machine-readable token block (from the former `DESIGN.md` frontmatter;
the skill may regenerate a root `DESIGN.md` on its next run):

```yaml
name: Household
description: Modernist household finance — warm paper, near-black ink, one vermilion accent, Archivo ExtraBold, zero radius, 2px rules.
colors:
  vermilion: "#EC3013"
  vermilion-deep: "#AE1800"
  vermilion-100: "#FFF2EF"
  vermilion-200: "#FFE0D9"
  ink: "#201E1D"
  ink-muted: "#7D7979"
  paper: "#F3F2F2"
  surface: "#EAE9E9"
  divider: "rgba(32, 30, 29, 0.4)"
  frame: "#201E1D"
typography:
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  heading:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "24px"
    letterSpacing: "-0.3px"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "23px"
  caption:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  eyebrow:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: "14px"
    letterSpacing: "1.3px"
  button:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: "17px"
rounded:
  sm: "0px"
  control: "0px"
  md: "0px"
  lg: "0px"
  xl: "0px"
  pill: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.paper}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  chip-unselected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  card-frame:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
---
```

### Overview

**Creative North Star: "The Broadsheet Ledger"**

The system reads like a well-set financial broadsheet: ink on warm paper, a strict
grid held by rules rather than boxes, and one loud vermilion used the way a printer
uses a second ink — sparingly, and only where it must be seen. Money is the
headline. The **consolidated balance is a solid black block** with a huge Archivo
ExtraBold figure; everything else is quieter type and thin rules around it.

Structure is drawn, not shaded. Panels are **2px rules** on the paper canvas — no
fill, no shadow, no rounded corners anywhere. Depth and hierarchy come from weight
(ExtraBold vs regular), from the black balance block, and from the density of the
rules. The single **vermilion** accent is reserved: primary actions, alerts and
over-budget, remittance, and the cheapest basket. Data-viz and structure are pure
ink — bars and meters fill **black**, turning vermilion only when a meter is full
or over.

The tone is **confident, editorial, and exact**. Nothing is soft. The system's
warmth is in the paper and the letterforms, not in colour or curvature.

**Key Characteristics:**
- Warm off-white paper, near-black ink, ONE vermilion accent used with restraint.
- Zero corner radius; 2px rules do all the structural work — no shadows, no filled tiles.
- Archivo ExtraBold headings/labels/buttons; regular body; UPPERCASE open-tracked eyebrows.
- The consolidated balance is a solid black block — the page's headline.
- Ink-first data-viz; vermilion enters only for actions, alerts, and "cheapest/over".
- Global-first: direction-aware (LTR/RTL) and script-aware (Archivo Latin / Readex Pro Arabic).

### Colors

An ink-on-paper base with one printer's-second-ink accent, plus a neutral ramp.

#### Primary
- **Vermilion** (#EC3013): The one accent. Primary buttons, active nav, alerts, over-budget,
  remittance and "sent home", the cheapest basket. Its scarcity is the point.
- **Vermilion Deep** (#AE1800): Pressed/emphasis, and positive amounts (income reads in deep
  vermilion — this world has no green).
- **Vermilion 100 / 200** (#FFF2EF / #FFE0D9): Tinted fills — remittance/upgrade card grounds,
  over-budget meter tracks.

#### Neutral
- **Ink** (#201E1D): Primary text, the balance block fill, and every data-viz/meter fill.
- **Ink Muted** (#7D7979): Secondary text, captions, meta, inactive icons.
- **Paper** (#F3F2F2): The canvas, and the "on-dark" foreground colour (labels on ink/vermilion).
- **Surface** (#EAE9E9): Input fills, segmented tracks, neutral meter tracks.
- **Divider** (rgba(32,30,29,0.4)): The standard 2px rule / card border.
- **Frame** (#201E1D): The heavy black rule for outer frames and key section edges.

#### Named Rules
**The Second-Ink Rule.** Vermilion is the second ink on a one-colour press: at most one
vermilion action per view, and never on structure or ordinary data. If two things are
vermilion, neither is urgent.

**The Ink-Data Rule.** Bars, meters, and shares fill **ink**. Vermilion appears in a meter
only when it is full or over — the colour *is* the alert.

### Typography

**Display / Body Font:** Archivo (with system-ui, sans-serif) — one grotesque family across
every Latin role. The system runs on two weights only: **ExtraBold (800)** for headings,
labels, and buttons; **Regular (400)** for body and captions.
**Arabic Font:** Readex Pro — the Arabic face for all roles (Archivo has no Arabic coverage);
it caps at 700, which stands in for the 800 display weight. RN selects weight by family name.

**Character:** Tight, confident grotesque with strong figures — a money app where numerals
carry the headline. Numbers use tabular lining figures so columns align.

#### Hierarchy
- **Title** (800, 28px / 30px, -0.4px): Screen titles. The balance figure overrides larger
  (44–52px) as the page headline.
- **Heading** (800, 20px / 24px, -0.3px): Section headers inside a ruled panel.
- **Body** (400, 15px / 23px): Reading text and input values.
- **Button** (800, 14px / 17px): Buttons and the emphasized label in list rows.
- **Eyebrow** (800, 11px / 14px, +1.3px, **UPPERCASE**): Section labels — the signature label
  treatment.
- **Caption** (400, 12px / 16px): Metadata, meta rows, secondary detail.

#### Named Rules
**The Uppercase-Eyebrow Rule.** Eyebrows are UPPERCASE with open tracking — the one place the
system shouts, and only in small type. Headings and body stay sentence case.

**The Tabular-Figure Rule.** Money and any columnar data use tabular figures (the `tabular`
prop on Text) so digits are equal-width and never jitter.

### Layout

A ruled grid. Content centers and caps at **1440px** with a **40px** desktop margin (24px on
narrow). The single breakpoint is viewport width at **1024px**: below it, navigation is a
floating-free bottom tab bar and content stacks to one column; at/above it, a sidebar frames
the page and panels sit side by side (flex-weighted — a weight-2 panel beside a weight-1 takes
two thirds). Spacing rhythm is 4-based (4 · 8 · 16 · 24 · 32 · 48); panel padding is 24.

#### Named Rules
**The Rule-Not-Box Rule.** Sections are separated by 2px rules and generous space, never by a
filled card or a shadow. A regular panel is a divider-weight frame; a structural edge is the
heavier ink frame.

### Elevation & Depth

Essentially flat. Depth comes from the **black balance block**, from type weight, and from the
density of 2px rules — not from shadow. Two soft shadow tokens exist only for genuinely
floating chrome (dialogs); they are the exception, not the vocabulary.

#### Shadow Vocabulary
- **Tile** (`0px 3px 10px rgba(45,43,43,0.16)`) / **Raised** (`0px 12px 32px rgba(45,43,43,0.22)`):
  Reserved for overlays/dialogs. Everyday panels use rules, not these.

#### Named Rules
**The No-Shadow Rule.** Panels never float. If something needs to separate, add a rule or
space; reach for a shadow only when an element genuinely overlays the page (a modal).

### Shapes

**Zero radius everywhere.** Buttons, inputs, chips, cards, meters, avatars, badges — all
square. Borders are the form language: **2px** rules in divider tint for panels, the heavier
ink **frame** for outer edges and key section boundaries; **1px** hairlines separate rows
inside a panel.

### Components

#### Buttons
- **Shape:** Square (0 radius), 48px min height, 24px horizontal padding.
- **Primary:** Vermilion fill, paper label. The one loud action.
- **Secondary (ghost):** Paper ground with a 1px divider border, ink label — recedes beside a
  primary.
- **Accent:** Vermilion (same as primary) — the single most valuable action (e.g. upgrade).
- **States:** Press = opacity 0.9 + scale 0.99; disabled = opacity 0.5; keyboard focus = a 3px
  vermilion ring (web).

#### Chips
- **Style:** Square, borderless. Selected = vermilion fill + paper label; unselected = surface
  fill + ink label. A `tint` may recolour the unselected fill; the label stays ink.

#### Cards / Panels
- **Frame:** A 2px divider-tint border on paper, 0 radius, 24px padding, no shadow. The
  accented variant switches the frame to vermilion and tints the fill vermilion-100 (remittance,
  cheapest, upgrade).
- **Rows inside:** separated by 1px divider hairlines, not sub-cards.

#### Inputs / Fields
- **Style:** Filled with surface so the field reads inside a frame; square; 48px min height. A
  2px border that starts transparent so focus never reflows.
- **Focus:** Border → vermilion. **Error:** border + helper text → vermilion.

#### Navigation
- **Sidebar (wide):** Paper column with a 2px ink edge rule. Active row = solid ink block with
  paper icon + label; inactive = ink label on paper.
- **Bottom tabs (narrow):** Paper bar with a 2px ink top rule (no float). Active tab = solid
  ink block, paper icon + UPPERCASE label; inactive = muted.

#### Signature — Balance Block
The consolidated balance is a solid **ink block** (paper text): an UPPERCASE eyebrow, a huge
Archivo ExtraBold tabular figure (44–52px), and a 2px rule separating supporting stats.

#### Signature — Share & Category Bars
Flat ink bars on a surface track (0 radius), built with flex fractions (RTL-safe). Account
"share of total" and spending-by-category both use them; meters turn vermilion only when full
or over.

### Do's and Don'ts

#### Do:
- **Do** separate with 2px rules and space; let the paper and the rule grid carry structure.
- **Do** keep vermilion to one action per view; make ink the workhorse for structure and data.
- **Do** fill bars/meters with ink; let vermilion mean "full / over / cheapest / act".
- **Do** set headings/labels/buttons in Archivo ExtraBold; keep eyebrows UPPERCASE.
- **Do** use tabular figures for all money.
- **Do** keep every corner square and every layout direction- and script-aware.

#### Don't:
- **Don't** round corners or add drop shadows to panels — this world is square and flat.
- **Don't** spend the vermilion on structure, ordinary data, or a second action.
- **Don't** reintroduce a soft/pastel or indigo treatment — the prior "ibilly" world is the
  anti-reference now.
- **Don't** use filled tiles as the section container; a ruled frame is the container.
- **Don't** render money in a proportional figure or in green — positive reads in deep vermilion.
