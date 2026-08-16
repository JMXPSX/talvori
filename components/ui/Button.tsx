/**
 * Themed pressable button. Label is passed already-localized by the caller
 * (screens resolve copy via `t('...')`). No business logic here.
 *
 * Variants: primary (indigo fill), secondary (ghost — soft hairline on the tile),
 * accent (burnt orange — reserve for the single most valuable action on a
 * screen, e.g. upgrade).
 */

import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { palette, radius, spacing, typography } from '@/components/theme';
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
  primary: palette.white,
  secondary: palette.brand,
  accent: palette.white, // white on burnt orange clears 4.5:1
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
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
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
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
  },
});
