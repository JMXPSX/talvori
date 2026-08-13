/**
 * Design tokens — "Ledger & Remittance" direction.
 *
 * A global household budget app for families managing shared money across
 * currencies and borders. The identity is a warm paper ledger (trust, tactility)
 * warmed by a remittance gold accent (value, "sending home"): deep money-teal
 * primary on warm paper, white cards for quiet depth, gold used with restraint.
 *
 * Screens and primitives consume these tokens, so the whole app reskins from
 * here without touching call sites.
 */

export const palette = {
  brand: '#0E6E5C', // deep money-teal — primary actions
  brandDeep: '#0A4E42', // pressed / emphasis
  brandMuted: '#D5E7E1', // meters, chips, muted fills
  accent: '#E0A72E', // remittance gold — the signature, used with restraint
  accentMuted: '#F6E7C4',
  text: '#12211C', // green-tinted ink
  textMuted: '#4F5C54', // green-gray (darkened for 4.5:1 caption contrast on white)
  background: '#F3F5F2', // warm paper canvas
  surface: '#FFFFFF', // cards sit brighter than the canvas
  border: '#E1E7E2', // soft hairline
  danger: '#B23A2E',
  success: '#1E7B45',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  // Ledger column-label: uppercase + tracked. Opt-in via <Text variant="eyebrow">.
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const theme = { palette, spacing, radius, typography } as const;
export type Theme = typeof theme;
