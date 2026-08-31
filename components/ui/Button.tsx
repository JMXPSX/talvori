/**
 * Themed pressable button. Label is passed already-localized by the caller
 * (screens resolve copy via `t('...')`). No business logic here.
 *
 * Variants: primary (indigo fill), secondary (ghost — soft hairline on the tile),
 * accent (burnt orange — reserve for the single most valuable action on a
 * screen, e.g. upgrade), danger (filled red — LEGAL ONLY inside a confirm flow),
 * dangerQuiet (text-only red — the entry point to a destructive confirm).
 */

import {
  ActivityIndicator,
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, typography, webFocusRing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'dangerQuiet';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** react-native-web adds `hovered`/`focused` to the Pressable state callback. */
type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const labelColor: Record<ButtonVariant, string> = {
    primary: palette.white,
    secondary: palette.brand,
    accent: palette.white, // white on burnt orange clears 4.5:1
    danger: palette.white, // white on red clears 4.5:1
    dangerQuiet: palette.danger,
  };
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered, focused } = state as WebPressableState;
        return [
          styles.base,
          styles[variant],
          hovered && !isDisabled ? styles.hovered : null,
          pressed && !isDisabled ? styles.pressed : null,
          focused ? webFocusRing : null,
          isDisabled ? styles.disabled : null,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <Text variant="button" style={[styles.label, { color: labelColor[variant] }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: c.brand,
  },
  // Ghost: a soft hairline rather than a brand-coloured outline, so it recedes
  // against the white tile it usually sits on.
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.border,
  },
  accent: {
    backgroundColor: c.accent,
  },
  danger: {
    backgroundColor: c.danger,
  },
  // Text-only: no fill, so it reads as a link-weight destructive affordance.
  dangerQuiet: {
    backgroundColor: 'transparent',
  },
  hovered: {
    opacity: 0.92,
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
