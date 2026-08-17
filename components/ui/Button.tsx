/**
 * Themed pressable button. Label is passed already-localized by the caller
 * (screens resolve copy via `t('...')`). No business logic here.
 *
 * Variants: primary (indigo fill), secondary (ghost — soft hairline on the tile),
 * accent (burnt orange — reserve for the single most valuable action on a
 * screen, e.g. upgrade).
 */

import {
  ActivityIndicator,
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { focus, palette, radius, spacing, typography } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'accent';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: palette.white, // canvas-colour label on the vermilion fill
  secondary: palette.text, // ghost: ink label on a hairline-ruled button
  accent: palette.white,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={(state) => {
        // RNW adds `focused` to the interaction state (RN's own types omit it);
        // it drives the web keyboard-focus ring and stays undefined on native.
        const { pressed, focused } = state as PressableStateCallbackType & {
          focused?: boolean;
        };
        return [
          styles.base,
          styles[variant],
          pressed && !isDisabled ? styles.pressed : null,
          focused && !isDisabled ? styles.focused : null,
          isDisabled ? styles.disabled : null,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={LABEL_COLOR[variant]} />
      ) : (
        <Text variant="button" style={[styles.label, { color: LABEL_COLOR[variant] }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: palette.brand,
  },
  // Ghost: a soft hairline rather than a brand-coloured outline, so it recedes
  // against the white tile it usually sits on.
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
  },
  accent: {
    backgroundColor: palette.accent,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  focused: {
    boxShadow: focus.ring,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
  },
});
