/**
 * Surface card: the repeated "bordered white panel on warm paper" used across
 * finance / grocery / retail / billing screens. Cards sit brighter than the
 * canvas for quiet depth. Pass `accented` to add the gold ledger-margin rule.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radius, spacing } from '@/components/theme';

export interface CardProps {
  children: ReactNode;
  /** Adds a gold left rule — reserve for the highlighted item (e.g. cheapest). */
  accented?: boolean;
  style?: ViewStyle;
}

export function Card({ children, accented = false, style }: CardProps) {
  return <View style={[styles.card, accented ? styles.accented : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
    // Quiet elevation so white cards lift off the warm-paper canvas.
    shadowColor: '#0A4E42',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  accented: {
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
});
