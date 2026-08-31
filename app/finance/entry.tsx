/** Add a single income or expense (§6.5). One screen, spec layout: amount card,
 *  To/From account chips, category chips, date (Today/Yesterday/Custom), note.
 *  Amount is entered in major units and converted using the selected account's
 *  currency before saving; the save posts one transaction and toasts back. */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  AmountCard,
  Button,
  Chip,
  DateField,
  FORM_MAX_WIDTH,
  resolveDate,
  Text,
  TextField,
  useToast,
  type DateMode,
} from '@/components/ui';
import { createEntry, listAccounts, listCategories } from '@/features/finance/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { active } = useActiveHousehold();
  const params = useLocalSearchParams<{ type?: string }>();
  const kind: 'income' | 'expense' = params.type === 'income' ? 'income' : 'expense';
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    try {
      const [accs, cats] = await Promise.all([
        listAccounts(active.id),
        listCategories(active.id, kind),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setAccountId((prev) => prev ?? accs[0]?.id ?? null);
      setCategoryId((prev) => prev ?? cats[0]?.id ?? null);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, kind]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  async function onSave() {
    if (!active || !selectedAccount) return;
    setFormError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAmountError('finance.form.amountPositive');
      return;
    }
    setAmountError(null);
    setSubmitting(true);
    try {
      const amountMinor = toMinorUnits(parsed, selectedAccount.currency_code);
      await createEntry({
        householdId: active.id,
        accountId: selectedAccount.id,
        type: kind,
        amountMinor,
        currencyCode: selectedAccount.currency_code,
        categoryId: categoryId ?? undefined,
        description: description.trim() || undefined,
        occurredAt: new Date(`${resolveDate(dateMode, customDate)}T12:00:00`).toISOString(),
      });
      const money = formatAmount(amountMinor, selectedAccount.currency_code);
      toast.show(
        kind === 'income'
          ? t('finance.toast.incomeSaved', { amount: money, account: selectedAccount.name })
          : t('finance.toast.expenseSaved', { amount: money, account: selectedAccount.name }),
        { tone: 'success', money: true },
      );
      router.back();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !active) {
    return (
      <SafeAreaView style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">
          {kind === 'income' ? t('finance.entry.incomeTitle') : t('finance.entry.expenseTitle')}
        </Text>

        {accounts.length === 0 ? (
          <Text muted>{t('finance.entry.noAccounts')}</Text>
        ) : (
          <View style={styles.form}>
            <AmountCard
              currencyCode={selectedAccount?.currency_code ?? active.reporting_currency_code}
              value={amount}
              onChangeValue={setAmount}
            />
            {amountError ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(amountError)}
              </Text>
            ) : null}

            <Text variant="caption" muted>
              {kind === 'income' ? t('finance.form.toAccount') : t('finance.form.fromAccount')}
            </Text>
            <View style={styles.chips}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={a.id === accountId}
                  role="radio"
                  onPress={() => setAccountId(a.id)}
                />
              ))}
            </View>

            {categories.length > 0 ? (
              <>
                <Text variant="caption" muted>
                  {t('finance.form.category')}
                </Text>
                <View style={styles.chips}>
                  {categories.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={c.id === categoryId}
                      role="radio"
                      onPress={() => setCategoryId(c.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <DateField
              mode={dateMode}
              customDate={customDate}
              onModeChange={setDateMode}
              onCustomChange={setCustomDate}
            />

            <TextField
              label={t('finance.form.noteLabel')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('finance.form.notePlaceholder')}
              autoCapitalize="sentences"
            />

            {formError ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(formError)}
              </Text>
            ) : null}

            <Button
              label={kind === 'income' ? t('finance.entry.saveIncome') : t('finance.entry.saveExpense')}
              variant={kind === 'income' ? 'success' : 'primary'}
              onPress={onSave}
              loading={submitting}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  form: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
