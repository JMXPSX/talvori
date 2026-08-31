/**
 * Pure presentation meter. Fill is built with flex fractions (RTL-safe — the
 * row reverses under RTL so the bar grows from the start edge either way).
 */

import { StyleSheet, View } from 'react-native';

import { radius } from '@/components/theme';
import { useTheme } from '@/components/ThemeProvider';

export type ProgressState = 'normal' | 'full' | 'over';

export interface ProgressBarProps {
  fraction: number; // 0..1 (clamped)
  state?: ProgressState;
  height?: number;
}

export function ProgressBar({ fraction, state = 'normal', height = 8 }: ProgressBarProps) {
  const { palette } = useTheme();
  const f = Math.max(0, Math.min(1, fraction));
  // §3.9 meter: neutral track; fill by state — positive <80%, warn ≥80%,
  // over-budget uses the softer `dangerBar` fill (not full-strength danger).
  const track = palette.fill;
  const fill =
    state === 'over' ? palette.dangerBar : state === 'full' ? palette.warn : palette.positive;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 1, now: f }}
      style={[styles.track, { height, backgroundColor: track }]}
    >
      <View style={{ flex: f, backgroundColor: fill }} />
      <View style={{ flex: 1 - f }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
