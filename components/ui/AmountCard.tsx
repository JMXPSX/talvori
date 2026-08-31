/**
 * Amount input card (§6.5) — the transaction form's hero field. A `fillSoft` card
 * with an "Amount · <CUR>" caption, the currency symbol (22/800, secondary) and a
 * borderless numeric input (30/800). The placeholder is the currency's own zero
 * form (e.g. `0.00`, or `0` for zero-decimal currencies like JPY).
 */

import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { radius, spacing } from '@/components/theme';
import { useTheme, useThemedStyles, type Palette } from '@/components/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { currencySymbol } from '@/lib/currencies';
import { fontFamilyFor, isArabicLanguage } from '@/lib/fonts';
import { minorExponent } from '@/lib/money';
import { direction } from '@/lib/rtl';

// The card draws its own chrome, so suppress the web <input> focus outline.
const webNoOutline: TextStyle | null =
  Platform.OS === 'web' ? ({ outlineWidth: 0 } as TextStyle) : null;

export interface AmountCardProps {
  currencyCode: string;
  value: string;
  onChangeValue: (next: string) => void;
  /** Caption prefix; defaults to "Amount". */
  label?: string;
}

/** The currency's zero form, e.g. "0.00" (2dp) or "0" (0dp). */
function zeroForm(currencyCode: string): string {
  const dp = minorExponent(currencyCode);
  return dp > 0 ? `0.${'0'.repeat(dp)}` : '0';
}

export function AmountCard({ currencyCode, value, onChangeValue, label }: AmountCardProps) {
  const { t, i18n } = useTranslation();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const symbol = currencySymbol(currencyCode, i18n.language);
  const font = fontFamilyFor('title', isArabicLanguage(i18n.language));

  return (
    <View style={styles.card}>
      <Text variant="caption" muted>
        {`${label ?? t('finance.entry.amountLabel')} · ${currencyCode}`}
      </Text>
      <View style={styles.row}>
        <Text style={styles.symbol}>{symbol}</Text>
        <TextInput
          style={[styles.input, webNoOutline, { fontFamily: font, textAlign: direction.textAlign }]}
          value={value}
          onChangeText={onChangeValue}
          placeholder={zeroForm(currencyCode)}
          placeholderTextColor={palette.textTertiary}
          keyboardType="decimal-pad"
          accessibilityLabel={`${label ?? t('finance.entry.amountLabel')} ${currencyCode}`}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.fillSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: direction.flexRow, alignItems: 'center', gap: spacing.sm },
  symbol: { fontSize: 22, fontWeight: '800', color: c.textSecondary },
  input: {
    flex: 1,
    fontSize: 30,
    fontWeight: '800',
    color: c.ink,
    paddingVertical: spacing.xs,
  },
});
