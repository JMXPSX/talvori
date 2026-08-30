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

export const palette = {
  brand: '#6D4CFF', // purple — primary actions, active nav, hero
  brandDeep: '#5A38E8', // pressed / emphasis
  brandMuted: '#EDE7FF', // meters, chips, muted fills (purple tint)
  accent: '#F59E0B', // warm orange — shopping + goal accents
  accentMuted: '#FEF3C7', // tinted accent fills (amber)
  text: '#0F172A', // navy ink / dark surfaces
  textMuted: '#475569', // secondary text
  background: '#F6F7FB', // near-white app canvas
  surface: '#FFFFFF', // tiles sit brighter than the canvas
  border: '#E2E8F0', // soft hairline — used sparingly; depth comes from shadow
  danger: '#DC2626',
  success: '#14B8A6', // teal — income, positive balances, on-track meters
  white: '#FFFFFF',
  // — supporting fills / semantics —
  field: '#F1F5F9', // input fills, so fields stay visible inside white tiles
  tertiary: '#3B82F6', // blue — informational + secondary data series
  surfaceMuted: '#EDF1F7', // inset panels, segmented-control tracks
  dangerMuted: '#FEE2E2', // error container fill
  successMuted: '#CCFBF1', // teal container fill (income tiles)
} as const;

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
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: -0.5 },
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
