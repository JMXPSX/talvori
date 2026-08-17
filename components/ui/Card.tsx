/**
 * Card: the repeated panel across finance / grocery / retail / billing screens.
 * Modernist — a square frame drawn with a 2px rule on the paper canvas; depth
 * comes from the rule, never from shadow or a filled tile. Pass `accented` to
 * turn the frame vermilion and tint the fill (remittance / cheapest / upgrade).
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';

export interface CardProps {
  children: ReactNode;
  /** Vermilion frame + tinted fill — reserve for the highlighted item. */
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
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.background,
    gap: spacing.sm,
  },
  accented: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
});
