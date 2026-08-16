/**
 * Bento tile: the repeated white panel used across finance / grocery / retail /
 * billing screens. Borderless by design — depth comes from the contrast of white
 * against the tinted canvas plus a soft ambient shadow, never from a rule.
 * Pass `accented` to tint the surface for the highlighted item (e.g. cheapest).
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { elevation, palette, radius, spacing } from '@/components/theme';

export interface CardProps {
  children: ReactNode;
  /** Tints the tile — reserve for the highlighted item (e.g. cheapest). */
  accented?: boolean;
  style?: ViewStyle;
}

export function Card({ children, accented = false, style }: CardProps) {
  return <View style={[styles.card, accented ? styles.accented : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    gap: spacing.sm,
    boxShadow: elevation.tile,
  },
  accented: {
    backgroundColor: palette.accentMuted,
  },
});
