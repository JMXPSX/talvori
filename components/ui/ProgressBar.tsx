/**
 * Pure presentation meter. Fill is built with flex fractions (RTL-safe — the
 * row reverses under RTL so the bar grows from the start edge either way).
 */

import { StyleSheet, View } from 'react-native';

import { palette, radius } from '@/components/theme';

export type ProgressState = 'normal' | 'full' | 'over';

export interface ProgressBarProps {
  fraction: number; // 0..1 (clamped)
  state?: ProgressState;
  height?: number;
}

export function ProgressBar({ fraction, state = 'normal', height = 8 }: ProgressBarProps) {
  const f = Math.max(0, Math.min(1, fraction));
  const track = state === 'over' ? palette.dangerMuted : palette.brandMuted;
  const fill = state === 'over' ? palette.danger : state === 'full' ? palette.accent : palette.brand;
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
