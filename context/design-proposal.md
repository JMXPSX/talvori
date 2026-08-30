---
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

# Design System: Household — PROPOSED (not yet shipped)

> ⚠️ **Status: proposed redesign, NOT the current shipped system.** This is the vermilion
> "Broadsheet Ledger" direction produced by the `impeccable` skill (the frontmatter above is its
> machine-readable token block). **The app in code today is still the indigo "ibilly" system** —
> `components/theme.ts` and [`ui-tokens.md`](ui-tokens.md) / [`ui-rules.md`](ui-rules.md) /
> [`ui-registry.md`](ui-registry.md) are the source of truth for what actually renders. Treat
> everything below as design intent; adopt it only when the reskin is scheduled and executed.
> Note the "ibilly is the anti-reference" framing further down is aspirational — it is the
> reverse of current reality, so do not act on it yet.

## Overview

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

## Colors

An ink-on-paper base with one printer's-second-ink accent, plus a neutral ramp.

### Primary
- **Vermilion** (#EC3013): The one accent. Primary buttons, active nav, alerts, over-budget,
  remittance and "sent home", the cheapest basket. Its scarcity is the point.
- **Vermilion Deep** (#AE1800): Pressed/emphasis, and positive amounts (income reads in deep
  vermilion — this world has no green).
- **Vermilion 100 / 200** (#FFF2EF / #FFE0D9): Tinted fills — remittance/upgrade card grounds,
  over-budget meter tracks.

### Neutral
- **Ink** (#201E1D): Primary text, the balance block fill, and every data-viz/meter fill.
- **Ink Muted** (#7D7979): Secondary text, captions, meta, inactive icons.
- **Paper** (#F3F2F2): The canvas, and the "on-dark" foreground colour (labels on ink/vermilion).
- **Surface** (#EAE9E9): Input fills, segmented tracks, neutral meter tracks.
- **Divider** (rgba(32,30,29,0.4)): The standard 2px rule / card border.
- **Frame** (#201E1D): The heavy black rule for outer frames and key section edges.

### Named Rules
**The Second-Ink Rule.** Vermilion is the second ink on a one-colour press: at most one
vermilion action per view, and never on structure or ordinary data. If two things are
vermilion, neither is urgent.

**The Ink-Data Rule.** Bars, meters, and shares fill **ink**. Vermilion appears in a meter
only when it is full or over — the colour *is* the alert.

## Typography

**Display / Body Font:** Archivo (with system-ui, sans-serif) — one grotesque family across
every Latin role. The system runs on two weights only: **ExtraBold (800)** for headings,
labels, and buttons; **Regular (400)** for body and captions.
**Arabic Font:** Readex Pro — the Arabic face for all roles (Archivo has no Arabic coverage);
it caps at 700, which stands in for the 800 display weight. RN selects weight by family name.

**Character:** Tight, confident grotesque with strong figures — a money app where numerals
carry the headline. Numbers use tabular lining figures so columns align.

### Hierarchy
- **Title** (800, 28px / 30px, -0.4px): Screen titles. The balance figure overrides larger
  (44–52px) as the page headline.
- **Heading** (800, 20px / 24px, -0.3px): Section headers inside a ruled panel.
- **Body** (400, 15px / 23px): Reading text and input values.
- **Button** (800, 14px / 17px): Buttons and the emphasized label in list rows.
- **Eyebrow** (800, 11px / 14px, +1.3px, **UPPERCASE**): Section labels — the signature label
  treatment.
- **Caption** (400, 12px / 16px): Metadata, meta rows, secondary detail.

### Named Rules
**The Uppercase-Eyebrow Rule.** Eyebrows are UPPERCASE with open tracking — the one place the
system shouts, and only in small type. Headings and body stay sentence case.

**The Tabular-Figure Rule.** Money and any columnar data use tabular figures (the `tabular`
prop on Text) so digits are equal-width and never jitter.

## Layout

A ruled grid. Content centers and caps at **1440px** with a **40px** desktop margin (24px on
narrow). The single breakpoint is viewport width at **1024px**: below it, navigation is a
floating-free bottom tab bar and content stacks to one column; at/above it, a sidebar frames
the page and panels sit side by side (flex-weighted — a weight-2 panel beside a weight-1 takes
two thirds). Spacing rhythm is 4-based (4 · 8 · 16 · 24 · 32 · 48); panel padding is 24.

### Named Rules
**The Rule-Not-Box Rule.** Sections are separated by 2px rules and generous space, never by a
filled card or a shadow. A regular panel is a divider-weight frame; a structural edge is the
heavier ink frame.

## Elevation & Depth

Essentially flat. Depth comes from the **black balance block**, from type weight, and from the
density of 2px rules — not from shadow. Two soft shadow tokens exist only for genuinely
floating chrome (dialogs); they are the exception, not the vocabulary.

### Shadow Vocabulary
- **Tile** (`0px 3px 10px rgba(45,43,43,0.16)`) / **Raised** (`0px 12px 32px rgba(45,43,43,0.22)`):
  Reserved for overlays/dialogs. Everyday panels use rules, not these.

### Named Rules
**The No-Shadow Rule.** Panels never float. If something needs to separate, add a rule or
space; reach for a shadow only when an element genuinely overlays the page (a modal).

## Shapes

**Zero radius everywhere.** Buttons, inputs, chips, cards, meters, avatars, badges — all
square. Borders are the form language: **2px** rules in divider tint for panels, the heavier
ink **frame** for outer edges and key section boundaries; **1px** hairlines separate rows
inside a panel.

## Components

### Buttons
- **Shape:** Square (0 radius), 48px min height, 24px horizontal padding.
- **Primary:** Vermilion fill, paper label. The one loud action.
- **Secondary (ghost):** Paper ground with a 1px divider border, ink label — recedes beside a
  primary.
- **Accent:** Vermilion (same as primary) — the single most valuable action (e.g. upgrade).
- **States:** Press = opacity 0.9 + scale 0.99; disabled = opacity 0.5; keyboard focus = a 3px
  vermilion ring (web).

### Chips
- **Style:** Square, borderless. Selected = vermilion fill + paper label; unselected = surface
  fill + ink label. A `tint` may recolour the unselected fill; the label stays ink.

### Cards / Panels
- **Frame:** A 2px divider-tint border on paper, 0 radius, 24px padding, no shadow. The
  accented variant switches the frame to vermilion and tints the fill vermilion-100 (remittance,
  cheapest, upgrade).
- **Rows inside:** separated by 1px divider hairlines, not sub-cards.

### Inputs / Fields
- **Style:** Filled with surface so the field reads inside a frame; square; 48px min height. A
  2px border that starts transparent so focus never reflows.
- **Focus:** Border → vermilion. **Error:** border + helper text → vermilion.

### Navigation
- **Sidebar (wide):** Paper column with a 2px ink edge rule. Active row = solid ink block with
  paper icon + label; inactive = ink label on paper.
- **Bottom tabs (narrow):** Paper bar with a 2px ink top rule (no float). Active tab = solid
  ink block, paper icon + UPPERCASE label; inactive = muted.

### Signature — Balance Block
The consolidated balance is a solid **ink block** (paper text): an UPPERCASE eyebrow, a huge
Archivo ExtraBold tabular figure (44–52px), and a 2px rule separating supporting stats.

### Signature — Share & Category Bars
Flat ink bars on a surface track (0 radius), built with flex fractions (RTL-safe). Account
"share of total" and spending-by-category both use them; meters turn vermilion only when full
or over.

## Do's and Don'ts

### Do:
- **Do** separate with 2px rules and space; let the paper and the rule grid carry structure.
- **Do** keep vermilion to one action per view; make ink the workhorse for structure and data.
- **Do** fill bars/meters with ink; let vermilion mean "full / over / cheapest / act".
- **Do** set headings/labels/buttons in Archivo ExtraBold; keep eyebrows UPPERCASE.
- **Do** use tabular figures for all money.
- **Do** keep every corner square and every layout direction- and script-aware.

### Don't:
- **Don't** round corners or add drop shadows to panels — this world is square and flat.
- **Don't** spend the vermilion on structure, ordinary data, or a second action.
- **Don't** reintroduce a soft/pastel or indigo treatment — the prior "ibilly" world is the
  anti-reference now.
- **Don't** use filled tiles as the section container; a ruled frame is the container.
- **Don't** render money in a proportional figure or in green — positive reads in deep vermilion.
