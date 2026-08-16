/**
 * Bento layout primitives.
 *
 * DESIGN.md's "Fluid Bento Grid": on desktop, tiles sit side by side and span
 * variable widths; on mobile they become a full-width vertical stack. Rather
 * than a 12-column percentage grid (awkward in RN, where `gap` and percentage
 * widths do not compose), a row distributes space by FLEX WEIGHT — a tile with
 * weight 2 beside one with weight 1 takes two thirds. Below the breakpoint the
 * row becomes a column and every tile is full width, so callers describe intent
 * once and get both layouts.
 *
 * `BentoPage` centres content at the max container width with the wider desktop
 * margin, so the dashboard does not stretch edge to edge on a large monitor.
 *
 * Weights are proportional, not exact: like any flexbox, a tile will not shrink
 * below its content's intrinsic width, so a weight-1 tile holding a long
 * unbreakable string can end up wider than its share. Pass `minWidth: 0` on a
 * tile if you need the ratio held strictly.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { spacing } from '@/components/theme';
import { useIsWideLayout } from '@/lib/breakpoints';

/** DESIGN.md container-max. */
export const CONTENT_MAX_WIDTH = 1440;
/** DESIGN.md margin-desktop; the narrow layout uses spacing.lg. */
const DESKTOP_MARGIN = 40;

export interface BentoRowProps {
  children: ReactNode;
  style?: ViewStyle;
}

/** A row of tiles on wide viewports; a stack on narrow ones. */
export function BentoRow({ children, style }: BentoRowProps) {
  const isWide = useIsWideLayout();
  return <View style={[isWide ? styles.row : styles.stack, style]}>{children}</View>;
}

export interface BentoPageProps {
  children: ReactNode;
  style?: ViewStyle;
}

/** Page content container: centred, capped, with a direction-agnostic margin. */
export function BentoPage({ children, style }: BentoPageProps) {
  const isWide = useIsWideLayout();
  return (
    <View style={[styles.page, { padding: isWide ? DESKTOP_MARGIN : spacing.lg }, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg, // DESIGN.md gutter
  },
  stack: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  page: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    gap: spacing.md,
  },
});
