/**
 * Themed text primitive. Direction-aware alignment so RTL works by default.
 * Prefer this over raw <Text> so typography stays centralized.
 */

import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { palette, typography, type TypographyVariant } from '@/components/theme';
import { direction } from '@/lib/rtl';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

export function Text({ variant = 'body', muted = false, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[
        styles.base,
        typography[variant],
        { color: muted ? palette.textMuted : palette.text, textAlign: direction.textAlign },
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
