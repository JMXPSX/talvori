/**
 * Pill chip for filters and category tags.
 *
 * Follows the segmented control in the ibilly mocks: an unselected chip is a
 * tinted fill with dark ink, a selected one is a solid brand fill with white.
 * Borderless — the system gets separation from tone, not rules.
 *
 * `tint` overrides the unselected fill for category tags that carry their own
 * colour. It must be a light fill: chip labels are always dark ink when
 * unselected.
 */

import { Pressable, type PressableStateCallbackType, StyleSheet, type ViewStyle } from 'react-native';

import { focus, palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Light fill for the unselected state (e.g. a category colour). */
  tint?: string;
  style?: ViewStyle;
}

export function Chip({ label, selected = false, onPress, tint, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(state) => {
        const { pressed, focused } = state as PressableStateCallbackType & {
          focused?: boolean;
        };
        return [
          styles.chip,
          { backgroundColor: selected ? palette.brand : (tint ?? palette.field) },
          pressed ? styles.pressed : null,
          focused ? styles.focused : null,
          style,
        ];
      }}
    >
      <Text variant="caption" style={selected ? styles.labelOn : styles.labelOff}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.8 },
  focused: { boxShadow: focus.ring },
  labelOn: { color: palette.white },
  labelOff: { color: palette.text },
});
