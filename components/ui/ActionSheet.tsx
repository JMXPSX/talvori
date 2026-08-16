/**
 * Cross-platform action chooser / destructive confirm.
 *
 * `Alert.alert` is a no-op in react-native-web, so screens use `useActionSheet`
 * instead: on iOS/Android it forwards to the native Alert (platform-familiar
 * dialogs); on web it mounts `ActionSheetDialog`, a token-styled modal. Screens
 * must render `sheet.element` somewhere in their JSX for the web dialog to show.
 */

import { useCallback, useState, type ReactElement } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';

export interface ActionSheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionSheetOptions {
  title: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel: string;
}

export interface ActionSheetDialogProps extends ActionSheetOptions {
  onClose: () => void;
}

const BACKDROP = 'rgba(22, 29, 31, 0.45)'; // ink-tinted scrim

export function ActionSheetDialog({
  title,
  message,
  actions,
  cancelLabel,
  onClose,
}: ActionSheetDialogProps) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop presses from closing when tapping the card itself. */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="heading">{title}</Text>
            {message ? (
              <Text variant="caption" muted>
                {message}
              </Text>
            ) : null}
          </View>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <Text
                variant="button"
                style={{ color: action.destructive ? palette.danger : palette.brand }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            onPress={onClose}
          >
            <Text variant="button" muted>
              {cancelLabel}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * `show(options)` opens the platform-appropriate chooser; render `element` in
 * the screen's JSX (null on native, the web dialog when open).
 */
export function useActionSheet(): {
  show: (options: ActionSheetOptions) => void;
  element: ReactElement | null;
} {
  const [options, setOptions] = useState<ActionSheetOptions | null>(null);

  const show = useCallback((o: ActionSheetOptions) => {
    if (Platform.OS !== 'web') {
      Alert.alert(o.title, o.message, [
        ...o.actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.onPress,
        })),
        { text: o.cancelLabel, style: 'cancel' as const },
      ]);
      return;
    }
    setOptions(o);
  }, []);

  const element = options ? (
    <ActionSheetDialog {...options} onClose={() => setOptions(null)} />
  ) : null;

  return { show, element };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: BACKDROP,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    paddingVertical: spacing.sm,
    boxShadow: elevation.raised,
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Hairline separators are the one place a rule still earns its keep: the rows
  // are tap targets stacked edge to edge, and spacing alone would not divide them.
  row: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  pressed: { opacity: 0.9, backgroundColor: palette.field },
});
