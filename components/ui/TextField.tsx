/**
 * Labeled text input with optional hint + error text. Direction-aware so it
 * works in RTL. Copy (label/hint/error) is passed already-localized.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { palette, radius, spacing } from '@/components/theme';
import { Text } from '@/components/ui/Text';
import { fontFamilyFor, isArabicLanguage } from '@/lib/fonts';
import { direction } from '@/lib/rtl';

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
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { i18n } = useTranslation();
  const fontFamily = fontFamilyFor('body', isArabicLanguage(i18n.language));

  return (
    <View style={styles.wrapper}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          { textAlign: direction.textAlign, fontFamily },
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        editable={editable}
      />
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
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.background,
    color: palette.text,
  },
  inputFocused: {
    borderColor: palette.brand,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 1,
  },
  inputError: {
    borderColor: palette.danger,
  },
  errorText: {
    color: palette.danger,
  },
});
