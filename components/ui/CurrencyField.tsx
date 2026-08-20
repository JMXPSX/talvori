/**
 * Currency picker field (3b — fixes F25/F15). Replaces the free-typed ISO-code
 * TextField: a pressable field that opens a searchable sheet (SUGGESTED from the
 * device + household, then ALL currencies). Selection reports a leading ✓ (never
 * colour-only) and closes. Reused by account/household create and FX rates.
 */

import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing, webFocusRing } from '@/components/theme';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { filterCurrencies, listCurrencies, currencyName } from '@/lib/currencies';
import { localeTag } from '@/lib/format';

export interface CurrencyFieldProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  /** Codes to surface first (e.g. device + household currency). */
  suggested?: string[];
  error?: string;
}

export function CurrencyField({ label, value, onChange, suggested = [], error }: CurrencyFieldProps) {
  const { t } = useTranslation();
  const locale = localeTag();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const all = useMemo(() => listCurrencies(locale), [locale]);
  const results = useMemo(() => filterCurrencies(all, query), [all, query]);
  const suggestedInfos = useMemo(() => {
    const seen = new Set<string>();
    return suggested
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c && !seen.has(c) && (seen.add(c), true))
      .map((code) => all.find((c) => c.code === code))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [suggested, all]);

  const selectedName = value ? currencyName(value, locale) : '';

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  function row(code: string, name: string, symbol: string) {
    const selected = code === value;
    return (
      <Pressable
        key={code}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => pick(code)}
        style={(s) => {
          const st = s as { pressed?: boolean; hovered?: boolean; focused?: boolean };
          return [
            styles.row,
            selected ? styles.rowSelected : null,
            st.hovered ? styles.rowHovered : null,
            st.pressed ? styles.rowPressed : null,
            st.focused ? webFocusRing : null,
          ];
        }}
      >
        <View style={styles.symbolTile}>
          <Text variant="button">{symbol}</Text>
        </View>
        <View style={styles.rowMid}>
          <Text variant="subheading">{code}</Text>
          <Text variant="caption" muted numberOfLines={1}>
            {name}
          </Text>
        </View>
        {selected ? <Feather name="check" size={18} color={palette.brand} /> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.field}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={(s) => {
          const st = s as { pressed?: boolean; focused?: boolean };
          return [styles.trigger, st.pressed ? styles.rowPressed : null, st.focused ? webFocusRing : null];
        }}
      >
        <Text style={value ? undefined : styles.placeholder}>
          {value ? `${value} — ${selectedName}` : t('currency.placeholder')}
        </Text>
        <Feather name="chevron-down" size={18} color={palette.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.sheetHeader}>
            <Text variant="heading">{t('currency.title')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              hitSlop={12}
              onPress={() => setOpen(false)}
            >
              <Feather name="x" size={24} color={palette.text} />
            </Pressable>
          </View>
          <Text variant="caption" muted style={styles.explainer}>
            {t('currency.explainer')}
          </Text>
          <TextField
            label={t('currency.search')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
          />
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {query === '' && suggestedInfos.length > 0 ? (
              <>
                <Text variant="eyebrow" muted>
                  {t('currency.suggested')}
                </Text>
                {suggestedInfos.map((c) => row(c.code, c.name, c.symbol))}
                <Text variant="eyebrow" muted style={styles.allLabel}>
                  {t('currency.all')}
                </Text>
              </>
            ) : null}
            {results.map((c) => row(c.code, c.name, c.symbol))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  trigger: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.field,
  },
  placeholder: { color: palette.textMuted },
  error: { color: palette.danger },
  sheet: { flex: 1, backgroundColor: palette.background, padding: spacing.lg, gap: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  explainer: {},
  list: { gap: spacing.xs, paddingBottom: spacing.xl },
  allLabel: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  rowSelected: { backgroundColor: palette.brandMuted },
  rowHovered: { backgroundColor: palette.field },
  rowPressed: { opacity: 0.85 },
  symbolTile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: palette.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1, gap: 2 },
});
