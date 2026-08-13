/**
 * Themed pressable button. Label is passed already-localized by the caller
 * (screens resolve copy via `t('...')`). No business logic here.
 *
 * Variants: primary (teal fill), secondary (outline), accent (remittance gold —
 * reserve for the single most valuable action on a screen, e.g. upgrade).
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
  accent: palette.text, // dark ink on gold for legible contrast
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
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: palette.brand,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.brand,
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
