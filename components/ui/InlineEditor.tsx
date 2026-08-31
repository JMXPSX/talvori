/**
 * Inline editor panel (§3.3) — the app's ONE editing surface for a row. Never a
 * modal: it opens *under* the row it edits, on a `fillSoft` ground with a 1px
 * `border` and radius 12. It holds its fields (as children), an inline error line
 * (§3.11), then a footer: `Save` (primary pill) · `Cancel` (outlined pill) · flex
 * spacer · an optional destructive action pinned to the trailing edge.
 *
 * Pair the `destructive` slot with <DestructiveAction> for the two-tap confirm.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { direction } from '@/lib/rtl';

export interface InlineEditorProps {
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
  /** Inline validation line; shown in `danger` inside the panel when set. */
  error?: string | null;
  saveVariant?: ButtonVariant;
  saveDisabled?: boolean;
  saving?: boolean;
  /** Trailing destructive action, e.g. a <DestructiveAction/>. */
  destructive?: ReactNode;
  style?: ViewStyle;
}

export function InlineEditor({
  children,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
  error,
  saveVariant = 'primary',
  saveDisabled = false,
  saving = false,
  destructive,
  style,
}: InlineEditorProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.fields}>{children}</View>
      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Button label={saveLabel} onPress={onSave} variant={saveVariant} disabled={saveDisabled} loading={saving} style={styles.pill} />
        <Button label={cancelLabel} onPress={onCancel} variant="secondary" style={styles.pill} />
        <View style={styles.spacer} />
        {destructive}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  panel: {
    backgroundColor: c.fillSoft,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  fields: { gap: spacing.sm },
  error: { color: c.danger },
  footer: {
    flexDirection: direction.flexRow,
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Pills hug their labels rather than stretching across the footer.
  pill: { alignSelf: 'flex-start', paddingHorizontal: spacing.md },
  spacer: { flex: 1 },
});
