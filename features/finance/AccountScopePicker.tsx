/**
 * Account scope filter shared by Home and Activity. Threshold-hybrid (§6.4):
 * up to `threshold` accounts render as one-tap Chips; beyond that they collapse
 * into the Select dropdown so the control never overflows as accounts grow.
 * `value` is an account id, or null for "all accounts". Renders nothing when
 * there is 0–1 account (no filtering to do).
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@/components/theme';
import { Chip, Select } from '@/components/ui';
import type { AccountRow } from '@/lib/database.types';

const ALL = 'all';

interface AccountScopePickerProps {
  accounts: AccountRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Chips at/below this count, dropdown above it. */
  threshold?: number;
}

export function AccountScopePicker({
  accounts,
  value,
  onChange,
  threshold = 5,
}: AccountScopePickerProps) {
  const { t } = useTranslation();
  if (accounts.length <= 1) return null;

  if (accounts.length > threshold) {
    const options = [
      { value: ALL, label: t('finance.allAccounts') },
      ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ];
    return (
      <View style={styles.selectRow}>
        <Select
          accessibilityLabel={t('finance.filterByAccount')}
          options={options}
          value={value ?? ALL}
          onChange={(v) => onChange(v === ALL ? null : v)}
        />
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
      <Chip
        label={t('finance.allAccounts')}
        selected={value === null}
        role="radio"
        onPress={() => onChange(null)}
      />
      {accounts.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          selected={value === a.id}
          role="radio"
          onPress={() => onChange(a.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pills: { gap: spacing.sm, paddingVertical: spacing.xs },
  selectRow: { paddingVertical: spacing.xs, alignItems: 'flex-start' },
});
