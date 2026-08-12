/**
 * Themed pressable button. Label is passed already-localized by the caller
 * (screens resolve copy via `t('...')`). No business logic here.
 */

import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { palette, radius, spacing, typography } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? palette.white : palette.brand} />
      ) : (
        <Text
          variant="button"
          style={[styles.label, { color: isPrimary ? palette.white : palette.brand }]}
        >
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
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.brand,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.button,
  },
});
