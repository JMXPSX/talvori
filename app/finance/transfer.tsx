/** Move money between two accounts. Same-currency transfers mirror the amount;
 *  cross-currency transfers take an amount in each account's own currency. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createTransfer, listAccounts } from '@/features/finance/api';
import { createTransferSchema } from '@/features/finance/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    try {
      const accs = await listAccounts(active.id);
      setAccounts(accs);
      setFromId((prev) => prev ?? accs[0]?.id ?? null);
      setToId((prev) => prev ?? accs[1]?.id ?? null);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const from = useMemo(() => accounts.find((a) => a.id === fromId) ?? null, [accounts, fromId]);
  const to = useMemo(() => accounts.find((a) => a.id === toId) ?? null, [accounts, toId]);
  const sameCurrency = Boolean(from && to && from.currency_code === to.currency_code);

  async function onSave() {
    if (!from || !to) return;
    setFormError(null);
    const receivedAmount = sameCurrency ? fromAmount : toAmount;
    const result = validate(createTransferSchema, {
      fromAccountId: from.id,
      toAccountId: to.id,
      fromAmountMajor: fromAmount,
      toAmountMajor: receivedAmount,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createTransfer({
        fromAccountId: from.id,
        toAccountId: to.id,
        fromAmountMinor: toMinorUnits(result.data.fromAmountMajor, from.currency_code),
        toAmountMinor: toMinorUnits(result.data.toAmountMajor, to.currency_code),
      });
      router.back();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (accounts.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Text muted>{t('finance.transfer.needTwo')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render helper (not a nested component — those remount on every render).
  function renderAccountPicker({
    selected,
    onSelect,
    exclude,
  }: {
    selected: string | null;
    onSelect: (id: string) => void;
    exclude: string | null;
  }) {
    return (
      <View style={styles.chips}>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => {
            const activeChip = a.id === selected;
            return (
              <Pressable
                key={a.id}
                onPress={() => onSelect(a.id)}
                style={[styles.chip, activeChip ? styles.chipActive : null]}
              >
                <Text variant="caption" style={{ color: activeChip ? palette.white : palette.text }}>
                  {a.name} ({a.currency_code})
                </Text>
              </Pressable>
            );
          })}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" muted>
          {t('finance.transfer.fromLabel')}
        </Text>
        {renderAccountPicker({ selected: fromId, onSelect: setFromId, exclude: toId })}

        <Text variant="caption" muted>
          {t('finance.transfer.toLabel')}
        </Text>
        {renderAccountPicker({ selected: toId, onSelect: setToId, exclude: fromId })}

        <TextField
          label={`${t('finance.transfer.fromAmountLabel')}${from ? ` (${from.currency_code})` : ''}`}
          value={fromAmount}
          onChangeText={setFromAmount}
          keyboardType="numeric"
          error={fieldErrors.fromAmountMajor ? t('errors.validation') : undefined}
        />

        {!sameCurrency ? (
          <TextField
            label={`${t('finance.transfer.toAmountLabel')}${to ? ` (${to.currency_code})` : ''}`}
            value={toAmount}
            onChangeText={setToAmount}
            keyboardType="numeric"
            hint={t('finance.transfer.crossCurrencyHint')}
            error={fieldErrors.toAmountMajor ? t('errors.validation') : undefined}
          />
        ) : null}

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        <Button
          label={submitting ? t('auth.processing') : t('finance.transfer.saveCta')}
          onPress={onSave}
          loading={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
  },
  chipActive: { backgroundColor: palette.brand },
});
