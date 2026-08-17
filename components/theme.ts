/**
 * Design tokens — the "Modernist" direction (imported from the Claude Design
 * project "Household Redesign", _ds/modernist-*). A Swiss/editorial system:
 * warm off-white paper, near-black ink, ONE vermilion accent, Archivo ExtraBold
 * headings, zero corner radius, and heavy 2px rules doing the structural work
 * instead of shadow. Data-viz and structure are black; the vermilion is reserved
 * for the primary action, alerts/over-budget, remittance, and the "cheapest".
 *
 * Token NAMES are the public API that every screen calls; only their values moved
 * when the world changed. Screens and primitives consume these, so the whole app
 * reskins from here without touching call sites.
 */

export const palette = {
  brand: '#EC3013', // vermilion — the one accent: primary actions, active, alerts
  brandDeep: '#AE1800', // pressed / emphasis (accent-700)
  brandMuted: '#FFE0D9', // muted accent fill / over-budget track (accent-200)
  accent: '#EC3013', // single-accent world — same vermilion
  accentMuted: '#FFF2EF', // accent-100 — remittance / upgrade / highlight fills
  text: '#201E1D', // near-black ink — also the data-viz + hero-block fill
  textMuted: '#7D7979', // neutral-600
  background: '#F3F2F2', // warm off-white canvas
  surface: '#EAE9E9', // filled surfaces: inputs, segmented tracks, filled cards
  border: 'rgba(32, 30, 29, 0.4)', // divider — the standard 2px rule / card border
  borderStrong: '#201E1D', // heavy black frame — outer frames, key section rules
  danger: '#EC3013', // the accent carries alerts / over-budget in this world
  success: '#AE1800', // positive amounts render in deep accent (no green here)
  white: '#F3F2F2', // "on-dark" foreground = the canvas colour
  // — additions the primitives require —
  field: '#EAE9E9', // input fills (surface), so fields read inside a frame
  tertiary: '#7D7979', // no sky in this world; a neutral secondary data series
  surfaceMuted: '#EAE9E9', // inset panels, segmented-control tracks
  dangerMuted: '#FFE0D9', // error / over container fill (accent-200)
  successMuted: '#FFE0D9', // positive container fill
} as const;

/**
 * Category/series colours for charts. Modernist reads as ink-first with the
 * vermilion accent and neutral steps; lives here so the palette has one home.
 */
export const chartSeries = [
  palette.text, // ink
  palette.brand, // vermilion
  '#7D7979', // neutral-600
  '#E15B47', // accent-2
  '#BAB6B6', // neutral-400
  palette.brandDeep, // deep accent
  '#444141', // neutral-800
  '#D7D3D3', // neutral-300
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Zero radius everywhere — the Modernist system is entirely square. */
export const radius = {
  sm: 0,
  control: 0,
  md: 0,
  lg: 0,
  xl: 0,
  pill: 0,
} as const;

/**
 * Line heights are absolute pixels (RN has no unitless ratios); letterSpacing is
 * px. Headings/labels/buttons are Archivo ExtraBold; eyebrows are UPPERCASE with
 * open tracking (the system's signature label treatment).
 */
export const typography = {
  title: { fontSize: 28, fontWeight: '800', lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontSize: 20, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 23 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  // Uppercase section label — the Modernist eyebrow, open-tracked.
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  button: { fontSize: 14, fontWeight: '800', lineHeight: 17 },
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Elevation is used sparingly (dialogs, the floating tab bar) — the system
 * conveys depth with 2px rules, not shadow. boxShadow strings; shadow* props are
 * deprecated.
 */
export const elevation = {
  tile: '0px 3px 10px rgba(45, 43, 43, 0.16)',
  raised: '0px 12px 32px rgba(45, 43, 43, 0.22)',
} as const;

/**
 * Web keyboard-focus ring. The app ships as a Web-PWA, so Pressable primitives
 * need a visible focus indicator for keyboard users. Rendered as a boxShadow
 * ring (RN 0.76+); react-native-web surfaces `focused` on the Pressable state,
 * which stays undefined on native (which uses its own focus model).
 */
export const focus = {
  ring: `0px 0px 0px 3px rgba(236, 48, 19, 0.55)`,
} as const;

export const theme = { palette, spacing, radius, typography, elevation, focus, chartSeries } as const;
export type Theme = typeof theme;
