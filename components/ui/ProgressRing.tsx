/**
 * Circular progress meter — the per-category ring from the ibilly budget mock.
 *
 * Pure presentation: pass a fraction and a state, exactly like ProgressBar, so
 * the two meters stay interchangeable and share the caller's colour semantics.
 * Rounded stroke caps per the "soft stroke" data-viz rule.
 *
 * `children` renders inside the ring (the mock puts a category icon there).
 * Over-budget rings deliberately do not wrap past a full turn: the arc caps at
 * 100% and the colour carries the overspend, which the caption states exactly.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { palette } from '@/components/theme';
import type { ProgressState } from '@/components/ui/ProgressBar';

export interface ProgressRingProps {
  fraction: number; // 0..1 (clamped)
  state?: ProgressState;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

export function ProgressRing({
  fraction,
  state = 'normal',
  size = 56,
  stroke = 5,
  children,
}: ProgressRingProps) {
  const f = Math.max(0, Math.min(1, fraction));
  // Modernist: ink arc on a neutral track by default; vermilion only when full/over.
  const track = state === 'over' ? palette.brandMuted : palette.surfaceMuted;
  const fill = state === 'normal' ? palette.text : palette.brand;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 1, now: f }}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {f > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={fill}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${f * c} ${c - f * c}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
