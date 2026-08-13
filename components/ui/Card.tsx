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
  },
  accented: {
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
});
