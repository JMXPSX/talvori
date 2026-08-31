/**
 * Design tokens — the "Talvori" direction (from the "Budget app analysis" design
 * workspace; see context/ui-tokens.md).
 *
 * Talvori ("One plan. Everyone. Together.") is a global household budget app for
 * families managing shared money across currencies and borders. The identity pairs
 * a purple primary with a navy ink on a near-white canvas; teal marks income and
 * positive balances, warm orange marks shopping and goals, and blue is reserved for
 * informational accents. Cards are borderless white tiles that float via soft
 * ambient shadow rather than hairline rules.
 *
 * Token NAMES are the public API that every screen calls; only their values moved
 * when the palette changed. Screens and primitives consume these, so the whole app
 * reskins from here without touching call sites.
 */

import { Platform, type ViewStyle } from 'react-native';

/**
 * The Talvori LIGHT palette. Token NAMES are the public API; light and dark share
 * the same keys so screens reskin by swapping the object (via `useTheme()` — see
 * `components/ThemeProvider`). `palette` below aliases this so any module still
 * importing the static token set keeps rendering the light theme until migrated.
 *
 * `white` is intentionally fixed in BOTH themes — it means "white", used for text
 * and glyphs on the always-purple brand surfaces (hero, primary buttons), which
 * stay readable in dark mode.
 */
export const lightPalette = {
  // ─────────────────────────────────────────────────────────────────────────
  // CANONICAL tokens — the §2.2 spec palette (TALVORI_MOBILE_UI_SPEC.md).
  // These are the names new/reworked screens should consume. The LEGACY block
  // below aliases the older names (brand/success/accent/…) to the same values
  // so every existing screen keeps compiling; migrate call sites over time.
  // Contrast rule: use *Strong tones for text under ~14px on a tint; the base
  // tones are for fills, bars and large numbers.
  // ─────────────────────────────────────────────────────────────────────────
  ink: '#0F172A', // primary text, dark surfaces, app-icon ground
  primary: '#6D4CFF', // primary buttons, active nav, hero cards, links, accent type
  primaryPressed: '#5A38E8', // pressed / hover of primary
  primaryTint: '#EDE7FF', // selected chips, icon tiles, soft fills
  primaryTintSoft: '#F4F0FF', // lowest-emphasis purple fill
  info: '#3B82F6', // informational bars, insight accent stripe
  infoStrong: '#1D4ED8', // info text on tint (AA)
  infoTint: '#EAF2FE', // info strip / transfer-row backgrounds
  positive: '#14B8A6', // income, positive balances, on-track meters, goal reached
  positiveStrong: '#0E9384', // positive text at small sizes (AA)
  positiveTint: '#D6F5F0', // income-row tiles
  warn: '#F59E0B', // shopping accents, goal progress, meters at ≥80%
  warnStrong: '#B45309', // warn text at small sizes (AA)
  warnTint: '#FDE6C8', // soft warn fill
  danger: '#DC2626', // validation errors, overdue, over-budget, destructive text
  dangerTint: '#FEE2E2', // error banner background
  dangerBar: '#FFB4AB', // over-budget meter fill
  textSecondary: '#475569', // labels, meta, helper text
  textTertiary: '#94A3B8', // chevrons, disabled
  border: '#E2E8F0', // input + card borders
  divider: '#EDF1F7', // row dividers
  fill: '#F1F5F9', // neutral tiles, inactive chips
  fillSoft: '#F8FAFF', // inline editor panels
  surface: '#FFFFFF', // cards
  background: '#F6F7FB', // app background
  white: '#FFFFFF', // fixed in both themes — glyphs on always-purple brand surfaces
  successSurface: '#EDF3F0', // success toast / confirmation-strip fill (pairs with positiveStrong text)
  brandNavy: '#0F172A', // FIXED in both themes — the splash / app-icon navy ground
  toggleTrackOff: '#C7C4D7', // FIXED — the §3.6 off-track grey

  // ── LEGACY aliases (older names → canonical values) ──
  brand: '#6D4CFF', // → primary
  brandDeep: '#5A38E8', // → primaryPressed
  brandMuted: '#EDE7FF', // → primaryTint
  accent: '#F59E0B', // → warn
  accentMuted: '#FEF3C7', // amber tint (pre-spec; warnTint is the spec value)
  text: '#0F172A', // → ink
  textMuted: '#475569', // → textSecondary
  field: '#F1F5F9', // → fill
  tertiary: '#3B82F6', // → info
  surfaceMuted: '#EDF1F7', // → divider
  dangerMuted: '#FEE2E2', // → dangerTint
  successMuted: '#CCFBF1', // teal tint (pre-spec; positiveTint is the spec value)
  success: '#14B8A6', // → positive
} as const;

/** The public shape every screen consumes. Dark must supply the same keys. */
export type Palette = { [K in keyof typeof lightPalette]: string };

/**
 * The Talvori DARK palette — same purple brand on a deep-navy canvas. Muted fills
 * become dark tints of their hue; ink inverts to near-white; `white` stays white.
 * Accent/brand/semantic hues are nudged brighter where needed for contrast on dark.
 */
export const darkPalette: Palette = {
  // Canonical §2.2 tokens, tuned for the deep-navy canvas. Hues lift toward the
  // brighter end where they sit as text/glyphs; *Strong tones lift further still
  // (they front text on a dark tint, so they must out-contrast the base tone).
  ink: '#E6EAF2', // near-white primary text on dark
  primary: '#8B72FF', // lifted for contrast on dark
  primaryPressed: '#7358F0',
  primaryTint: '#241C46', // dark purple tint
  primaryTintSoft: '#1A1533', // lowest-emphasis purple fill on dark
  info: '#60A5FA',
  infoStrong: '#93C5FD', // brighter — info text on dark tint
  infoTint: '#16233A',
  positive: '#2DD4BF',
  positiveStrong: '#5EEAD4', // brighter — positive text on dark tint
  positiveTint: '#123A34',
  warn: '#FBBF24',
  warnStrong: '#FCD34D', // brighter — warn text on dark tint
  warnTint: '#3A2E12',
  danger: '#F87171',
  dangerTint: '#3A1E1E',
  dangerBar: '#F87171',
  textSecondary: '#9AA6BC',
  textTertiary: '#64748B',
  border: '#2A3350',
  divider: '#222B42',
  fill: '#1C2436', // neutral tiles / inactive chips on dark
  fillSoft: '#131A2A', // inline editor panels on dark
  surface: '#161C2B', // tiles sit brighter than the canvas
  background: '#0B0F1A', // deep navy canvas
  white: '#FFFFFF', // fixed — glyphs on the brand surfaces
  successSurface: '#16241F', // dark green strip fill
  brandNavy: '#0F172A', // fixed brand navy (same both themes)
  toggleTrackOff: '#3A3550', // off-track on dark

  // ── LEGACY aliases ──
  brand: '#8B72FF',
  brandDeep: '#7358F0',
  brandMuted: '#241C46',
  accent: '#FBBF24',
  accentMuted: '#3A2E12',
  text: '#E6EAF2',
  textMuted: '#9AA6BC',
  field: '#1C2436',
  tertiary: '#60A5FA',
  surfaceMuted: '#1C2436',
  dangerMuted: '#3A1E1E',
  successMuted: '#123A34',
  success: '#2DD4BF',
};

/** Static alias = light. Unmigrated modules import this and stay light-themed. */
export const palette = lightPalette;

/**
 * Category/series colours for charts. Lives here (not in the chart module) so the
 * palette has a single home — features/finance/donut.ts imports it.
 */
export const chartSeries = [
  palette.brand, // purple
  palette.accent, // warm orange
  palette.tertiary, // blue
  palette.danger, // red
  '#7C5CBF', // violet
  palette.success, // teal
  '#93C5FD', // light blue
  '#94A3B8', // slate (outline)
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16, // mobile margin
  lg: 24, // gutter
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  control: 8, // buttons + chips stay tactile
  md: 12,
  lg: 16, // the standard bento container
  xl: 24, // hero / feature tiles
  pill: 999,
} as const;

/**
 * Line heights are absolute pixels (RN has no unitless ratios); letterSpacing is
 * in px.
 */
export const typography = {
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 24, fontWeight: '600', lineHeight: 31 },
  // List-row / card titles. Sits between `heading` (24, too loud in a row) and
  // `button` (16). Added for the UX overhaul (F20/F32) — rows misused `heading`.
  subheading: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 26 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 14 },
  // Section label. Sentence-case: the Talvori system has no uppercase label style.
  eyebrow: { fontSize: 14, fontWeight: '600', lineHeight: 17, letterSpacing: 0.14 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 19 },
  // The floor for any rendered amount (F32): nothing below 14px, tabular figures
  // so digits align in columns. Consume via <Text variant="moneyMin">.
  moneyMin: { fontSize: 14, fontWeight: '600', lineHeight: 18, fontVariant: ['tabular-nums'] },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Ambient elevation for bento tiles. boxShadow — the shadow* props are deprecated. */
export const elevation = {
  tile: '0px 4px 20px rgba(0, 0, 0, 0.04)',
  raised: '0px 8px 28px rgba(0, 0, 0, 0.08)',
} as const;

/**
 * Web-only keyboard focus ring (F22). A 2px brand outline offset from the box so
 * it never shifts layout; `outline*` is a react-native-web style, so gate it to
 * web (native ignores/​warns on unknown style keys). Spread into a Pressable's
 * `focused` state style. Empty object on native, so it composes harmlessly.
 */
export const webFocusRing: ViewStyle =
  Platform.OS === 'web'
    ? ({
        outlineWidth: 2,
        outlineColor: palette.brand,
        outlineStyle: 'solid',
        outlineOffset: 2,
      } as ViewStyle)
    : {};

export const theme = { palette, spacing, radius, typography, elevation, chartSeries } as const;
export type Theme = typeof theme;
