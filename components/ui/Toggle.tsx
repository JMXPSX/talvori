/**
 * On/off toggle (§3.6) — 42×24 track, radius 999, 20px white knob. On = `primary`,
 * off = a neutral grey track. The knob slides start→end; under RTL the row is
 * mirrored so "on" still sits at the trailing edge.
 *
 * Colour is never the only signal (a11y): the control reports `switch` role and
 * `accessibilityState.checked`, and callers pass an `accessibilityLabel`.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { radius } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Required — the control has no visible label of its own. */
  accessibilityLabel: string;
}

const TRACK_W = 42;
const TRACK_H = 24;
const KNOB = 20;
const INSET = (TRACK_H - KNOB) / 2;

export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }: ToggleProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled ? styles.disabled : null]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: c.primary },
  // §3.6 off-track grey (tokenized; the spec's fixed value on light).
  trackOff: { backgroundColor: c.toggleTrackOff },
  disabled: { opacity: 0.5 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radius.pill,
    backgroundColor: c.white,
    position: 'absolute',
  },
  // Logical insets so the knob rests at the trailing edge under RTL too.
  knobOn: { insetInlineEnd: INSET },
  knobOff: { insetInlineStart: INSET },
});
