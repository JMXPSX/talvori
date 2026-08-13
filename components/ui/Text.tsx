/**
 * Themed text primitive. Direction-aware alignment so RTL works by default, and
 * script-aware font family (Space Grotesk / Inter for Latin, Readex Pro for
 * Arabic) resolved from the active UI language. Prefer this over raw <Text> so
 * typography stays centralized.
 */

import { useTranslation } from 'react-i18next';
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { palette, typography, type TypographyVariant } from '@/components/theme';
import { fontFamilyFor, isArabicLanguage } from '@/lib/fonts';
import { direction } from '@/lib/rtl';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted = false, style, ...rest }: TextProps) {
  const { i18n } = useTranslation();
  const fontFamily = fontFamilyFor(variant, isArabicLanguage(i18n.language));
  return (
    <RNText
      style={[
        styles.base,
        typography[variant],
        { fontFamily, color: muted ? palette.textMuted : palette.text, textAlign: direction.textAlign },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
