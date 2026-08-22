/**
 * Labeled text input with optional hint + error text. Direction-aware so it
 * works in RTL. Copy (label/hint/error) is passed already-localized.
 *
 * Pass `secureToggle` on a password field to render a trailing show/hide eye
 * (F: password visibility). The field chrome (fill + focus/error border) lives
 * on the wrapper so the eye button can sit inside the box.
 */

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';
import { fontFamilyFor, isArabicLanguage } from '@/lib/fonts';
import { direction } from '@/lib/rtl';

// The wrapper draws its own brand focus border, so suppress the browser's default
// focus outline on the underlying web <input> (native ignores `outline*`).
const webNoOutline: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null;

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  editable?: boolean;
  /** Render a trailing show/hide eye for password fields. */
  secureToggle?: boolean;
  /** a11y labels for the eye toggle (pass localized). */
  toggleShowLabel?: string;
  toggleHideLabel?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  editable = true,
  secureToggle = false,
  toggleShowLabel,
  toggleHideLabel,
}: TextFieldProps) {
  const [hidden, setHidden] = useState(true);
  const { i18n } = useTranslation();
  const fontFamily = fontFamilyFor('body', isArabicLanguage(i18n.language));

  return (
    <View style={styles.wrapper}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <View style={[styles.fieldBox, error ? styles.inputError : null]}>
        <TextInput
          style={[styles.input, webNoOutline, { textAlign: direction.textAlign, fontFamily }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          editable={editable}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? toggleShowLabel : toggleHideLabel}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" style={styles.errorText}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  // Filled, not outlined: fields must stay visible inside a white bento tile.
  // The border is always 2px transparent (turning red only on error), so it never
  // reflows the layout and focus draws no ring. Chrome lives here so a trailing eye
  // can sit inside.
  fieldBox: {
    flexDirection: direction.flexRow,
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.field,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    color: palette.text,
  },
  inputError: {
    borderColor: palette.danger,
  },
  eye: {
    paddingStart: spacing.sm,
  },
  errorText: {
    color: palette.danger,
  },
});
