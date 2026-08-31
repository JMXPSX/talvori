/**
 * Select (§3.8) — a styled trigger that opens a sheet of options. White pill, 1px
 * `border`, radius ~10, 12.5/700 value. The shown value ALWAYS equals the stored
 * value: if `value` isn't in `options` we surface it anyway (§5.9 union rule), so
 * the picker never silently displays something the record doesn't hold.
 *
 * Cross-platform via RN's <Modal> (no native picker dependency). Generic over the
 * option value so callers keep their own union type.
 */

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import { elevation, radius, spacing, webFocusRing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { direction } from '@/lib/rtl';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (next: T) => void;
  placeholder?: string;
  accessibilityLabel: string;
  /** `inverse` = the white-on-brand pill used inside the hero card. */
  variant?: 'default' | 'inverse';
  style?: ViewStyle;
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  variant = 'default',
  style,
}: SelectProps<T>) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  // §5.9 union rule — guarantee the stored value is representable.
  const known = options.some((o) => o.value === value);
  const resolved: readonly SelectOption<T>[] = known ? options : [{ value, label: value }, ...options];
  const current = resolved.find((o) => o.value === value);
  const inverse = variant === 'inverse';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: current?.label ?? placeholder ?? '' }}
        onPress={() => setOpen(true)}
        style={(state) => [
          styles.trigger,
          inverse ? styles.triggerInverse : styles.triggerDefault,
          (state as { focused?: boolean }).focused ? webFocusRing : null,
          style,
        ]}
      >
        <Text variant="button" style={inverse ? styles.valueInverse : styles.value} numberOfLines={1}>
          {current?.label ?? placeholder ?? ''}
        </Text>
        <Feather name="chevron-down" size={16} color={inverse ? palette.white : palette.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              {resolved.map((opt) => {
                const selected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}
                  >
                    <Text variant="button" style={styles.optionLabel} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {selected ? <Feather name="check" size={18} color={palette.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  trigger: {
    flexDirection: direction.flexRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  triggerDefault: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  triggerInverse: { backgroundColor: 'rgba(255,255,255,0.2)' },
  value: { color: c.ink },
  valueInverse: { color: c.white },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    maxHeight: '70%',
    paddingVertical: spacing.xs,
    boxShadow: elevation.raised,
  },
  option: {
    flexDirection: direction.flexRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  optionPressed: { backgroundColor: c.fill },
  optionLabel: { color: c.ink, flex: 1 },
});
