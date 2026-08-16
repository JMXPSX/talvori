/**
 * Design tokens — the "ibilly" direction (adopted from the Google Stitch export,
 * see docs/superpowers/specs/2026-08-15-stitch-design-adoption-design.md).
 *
 * A global household budget app for families managing shared money across
 * currencies and borders. The identity is "Expertly Approachable": an indigo
 * primary for technological reliability on a cool blue-white canvas, warmed by a
 * burnt-orange secondary and a sky tertiary reserved for data. Cards are
 * borderless white bento tiles that float on the canvas via soft ambient shadow
 * rather than hairline rules.
 *
 * Token NAMES are the public API that every screen calls; only their values moved
 * when the palette changed. Screens and primitives consume these, so the whole app
 * reskins from here without touching call sites.
 */

export const palette = {
  brand: '#4343D5', // indigo — primary actions
  brandDeep: '#2E2BC2', // pressed / emphasis
  brandMuted: '#E1E0FF', // meters, chips, muted fills
  accent: '#944A1C', // burnt orange — "growth"/warmth, legible as ink on light
  accentMuted: '#FFDBCA', // tinted accent fills
  text: '#161D1F', // deep slate ink
  textMuted: '#464555',
  background: '#F4FAFD', // cool blue-white canvas
  surface: '#FFFFFF', // bento tiles sit brighter than the canvas
  border: '#C7C4D7', // soft hairline — used sparingly; depth comes from shadow
  danger: '#BA1A1A',
  success: '#1E7B45', // no Stitch equivalent; retained
  white: '#FFFFFF',
  // — additions the bento spec requires —
  field: '#F1F3F9', // input fills, so fields stay visible inside white tiles
  tertiary: '#00617E', // sky — informational + secondary data series
  surfaceMuted: '#E8EFF1', // inset panels, segmented-control tracks
  dangerMuted: '#FFDAD6', // error container fill
} as const;

/**
 * Category/series colours for charts. Lives here (not in the chart module) so the
 * palette has a single home — features/finance/donut.ts imports it.
 */
export const chartSeries = [
  palette.brand, // indigo
  palette.accent, // burnt orange
  palette.tertiary, // sky
  palette.danger, // red
  '#7C5CBF', // violet
  palette.success, // green
  '#8AD0F1', // light sky (tertiary-fixed-dim)
  '#767586', // slate (outline)
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16, // Stitch margin-mobile
  lg: 24, // Stitch gutter
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  control: 8, // buttons + chips stay tactile (Stitch rounded.DEFAULT)
  md: 12,
  lg: 16, // the standard bento container
  xl: 24, // hero / feature tiles
  pill: 999,
} as const;

/**
 * Line heights are absolute pixels (RN has no unitless ratios); letterSpacing is
 * px converted from Stitch's em values.
 */
export const typography = {
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 24, fontWeight: '600', lineHeight: 31 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 26 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 14 },
  // Section label. Sentence-case: the ibilly system has no uppercase label style.
  eyebrow: { fontSize: 14, fontWeight: '600', lineHeight: 17, letterSpacing: 0.14 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 19 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Ambient elevation for bento tiles. boxShadow — the shadow* props are deprecated. */
export const elevation = {
  tile: '0px 4px 20px rgba(0, 0, 0, 0.04)',
  raised: '0px 8px 28px rgba(0, 0, 0, 0.08)',
} as const;

export const theme = { palette, spacing, radius, typography, elevation, chartSeries } as const;
export type Theme = typeof theme;
