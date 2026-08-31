/**
 * Two-tap destructive confirm (§3.4). The label reads `🗑 Delete` (or whatever the
 * caller passes); the first tap changes it to `Tap again to confirm`; the second
 * tap performs the action. It resets itself on a timeout and exposes `reset()` via
 * ref so a parent can clear it on cancel/navigation. No alert dialogs.
 *
 * Text-only, `danger`-toned — it lives at the trailing edge of an inline editor
 * (§3.3) or below a form's Save.
 */

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, type PressableStateCallbackType, StyleSheet } from 'react-native';

import { spacing, webFocusRing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';

export interface DestructiveActionHandle {
  /** Clear the armed state — call on cancel or when the panel/screen closes. */
  reset: () => void;
}

export interface DestructiveActionProps {
  /** Resting label, e.g. `🗑 Delete` or `Delete account`. */
  label: string;
  /** Armed label; defaults to the shared `Tap again to confirm` copy. */
  confirmLabel: string;
  onConfirm: () => void;
}

type WebPressableState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export const DestructiveAction = forwardRef<DestructiveActionHandle, DestructiveActionProps>(
  function DestructiveAction({ label, confirmLabel, onConfirm }, ref) {
    const styles = useThemedStyles(makeStyles);
    const [armed, setArmed] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reset = useCallback(() => {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
    }, []);
    useImperativeHandle(ref, () => ({ reset }), [reset]);

    const onPress = useCallback(() => {
      if (armed) {
        reset();
        onConfirm();
      } else {
        setArmed(true);
        // Auto-disarm so a stray first tap doesn't stay hot forever.
        timer.current = setTimeout(() => setArmed(false), 4000);
      }
    }, [armed, onConfirm, reset]);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={armed ? confirmLabel : label}
        onPress={onPress}
        style={(state) => {
          const { pressed, focused } = state as WebPressableState;
          return [styles.action, pressed ? styles.pressed : null, focused ? webFocusRing : null];
        }}
      >
        <Text variant="button" style={styles.label}>
          {armed ? confirmLabel : label}
        </Text>
      </Pressable>
    );
  },
);

const makeStyles = (c: Palette) => StyleSheet.create({
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  label: { color: c.danger },
});
