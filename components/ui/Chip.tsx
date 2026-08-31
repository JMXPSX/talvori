/**
 * Pill chip for filters and category tags — the ONE chip in the system (F30).
 *
 * Follows the segmented control in the Talvori mocks: an unselected chip is a
 * tinted fill with dark ink, a selected one is a solid brand fill with white.
 * Borderless — the system gets separation from tone, not rules.
 *
 * Selection is never colour-only (F16/a11y): a selected chip also carries a
 * leading ✓ glyph and reports `accessibilityState.selected`. Pass `role` so the
 * chip announces its group semantics — `radio` for single-select, `checkbox`
 * for multi-select.
 *
 * `tint` overrides the unselected fill for category tags that carry their own
 * colour. It must be a light fill: chip labels are always dark ink when
 * unselected.
 */

import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, webFocusRing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { direction } from '@/lib/rtl';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Group semantics: single-select → 'radio', multi-select → 'checkbox'. */
  role?: 'radio' | 'checkbox';
  /** Light fill for the unselected state (e.g. a category colour). */
  tint?: string;
  /** Selected-fill hue. Default 'primary'; 'warn' marks the transfer To-account (§6.5). */
  tone?: 'primary' | 'warn';
  style?: ViewStyle;
}

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export function Chip({ label, selected = false, onPress, role, tint, tone = 'primary', style }: ChipProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const selectedFill = tone === 'warn' ? palette.warnStrong : palette.brand;
  return (
    <Pressable
      accessibilityRole={role ?? 'button'}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          styles.chip,
          { backgroundColor: selected ? selectedFill : (tint ?? palette.field) },
          hovered ? styles.hovered : null,
          pressed ? styles.pressed : null,
          focused ? webFocusRing : null,
          style,
        ];
      }}
    >
      <View style={styles.inner}>
        {selected ? (
          <Feather name="check" size={14} color={palette.white} style={styles.check} />
        ) : null}
        <Text variant="caption" style={selected ? styles.labelOn : styles.labelOff}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  inner: {
    flexDirection: direction.flexRow,
    alignItems: 'center',
    gap: spacing.xs,
  },
  check: { marginTop: 1 },
  hovered: { opacity: 0.92 },
  pressed: { opacity: 0.8 },
  labelOn: { color: c.white },
  labelOff: { color: c.text },
});
