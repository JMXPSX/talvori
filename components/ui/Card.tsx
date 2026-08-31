/**
 * Bento tile: the repeated white panel used across finance / grocery / retail /
 * billing screens. Borderless by design — depth comes from the contrast of white
 * against the tinted canvas plus a soft ambient shadow, never from a rule.
 * Pass `accented` to tint the surface for the highlighted item (e.g. cheapest).
 *
 * Pass `onPress` to make the whole tile a pressable row — it then gains the web
 * hover tint + keyboard focus ring (F22), so list screens stop hand-rolling
 * `<Pressable style={styles.card}>` copies (F16).
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { elevation, radius, spacing, webFocusRing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';

export interface CardProps {
  children: ReactNode;
  /** Tints the tile — reserve for the highlighted item (e.g. cheapest). */
  accented?: boolean;
  /** Makes the tile a pressable row (adds hover/focus/pressed states). */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export function Card({ children, accented = false, onPress, accessibilityLabel, style }: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const base = [styles.card, accented ? styles.accented : null, style];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          ...base,
          hovered ? styles.hovered : null,
          pressed ? styles.pressed : null,
          focused ? webFocusRing : null,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    gap: spacing.sm,
    boxShadow: elevation.tile,
  },
  accented: {
    backgroundColor: c.accentMuted,
  },
  hovered: { backgroundColor: c.field },
  pressed: { opacity: 0.9 },
});
