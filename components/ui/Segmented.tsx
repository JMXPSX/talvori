/**
 * Segmented control (§3.7) — N equal pills, exactly one active. Active = `primary`
 * fill + white; inactive = `surface` + 1px `border` + ink. Used for the
 * transaction-form date mode (Today · Yesterday · Custom), Shop's List | Start
 * shopping, appearance (System · Light · Dark), etc.
 *
 * Generic over the option value so callers keep their own union type. Selection is
 * announced per-segment via `accessibilityState.selected`.
 */

import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, webFocusRing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { direction } from '@/lib/rtl';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: ViewStyle;
}

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.group, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={(state) => {
              const { pressed, hovered, focused } = state as WebPressableState;
              return [
                styles.seg,
                active ? styles.segActive : styles.segInactive,
                hovered && !active ? styles.hovered : null,
                pressed ? styles.pressed : null,
                focused ? webFocusRing : null,
              ];
            }}
          >
            <Text variant="button" style={active ? styles.labelActive : styles.labelInactive}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  group: { flexDirection: direction.flexRow, gap: spacing.sm },
  seg: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
  },
  segActive: { backgroundColor: c.primary },
  segInactive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  hovered: { backgroundColor: c.fill },
  pressed: { opacity: 0.85 },
  labelActive: { color: c.white },
  labelInactive: { color: c.ink },
});
