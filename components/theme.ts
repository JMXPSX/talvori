/**
 * Design tokens (see 09_PHASE_1_CLAUDE_BUILD_PROMPT.md §I).
 *
 * A neutral, un-branded token set — NOT final brand design (see 00 README:
 * no final branding/logos yet). Screens and primitives consume these tokens so
 * a real design system can replace the values without touching call sites.
 */

export const palette = {
  brand: '#1F6FEB',
  brandMuted: '#DCE7FB',
  text: '#0B1220',
  textMuted: '#5B6472',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  border: '#E2E6EC',
  danger: '#C1362B',
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
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  button: { fontSize: 16, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const theme = { palette, spacing, radius, typography } as const;
export type Theme = typeof theme;
