/** Transaction edit sheet (3a — fixes F08 F09 F14 F15). Opens over the Activity
 *  feed to edit an income/expense: amount, account, category, date (backdating)
 *  and note. Delete lives HERE (dangerQuiet + confirm), not as a row-level trash
 *  icon. Transfers are shown read-only with NO delete — they aren't editable or
 *  deletable from Activity (editing a leg would desync the paired account). */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Chip, FORM_MAX_WIDTH, Text, TextField, useActionSheet } from '@/components/ui';
import {
  deleteTransaction,
  getTransaction,
  listAccounts,
  listCategories,
  updateTransaction,
  type TransactionWithRefs,
} from '@/features/finance/api';
import { isoDatePart, occurredAtFrom } from '@/features/finance/editTx';
import type { AccountRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { parseAmount } from '@/lib/amountInput';
import { localeTag } from '@/lib/format';
import { money, toMajorUnits, toMinorUnits } from '@/lib/money';

export default function EditTransactionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = String(id);
  const sheet = useActionSheet();

  const [tx, setTx] = useState<TransactionWithRefs | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, true>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setFormError(null);
    try {
      const row = await getTransaction(txId);
      if (!row) {
        setMissing(true);
        return;
      }
      setTx(row);
      setAccountId(row.account_id);
      setCategoryId(row.category_id);
      setDescription(row.description ?? '');
      setDateStr(isoDatePart(row.occurred_at));
      setAmount(String(toMajorUnits(money(row.amount_minor, row.currency_code))));
      // Only plain income/expense are editable; transfers and the read-only
      // goal/debt ledger mirrors (#6) load no editable fields.
      if (row.type === 'income' || row.type === 'expense') {
        const [accs, cats] = await Promise.all([
          listAccounts(row.household_id),
          listCategories(row.household_id, row.type),
        ]);
        setAccounts(accs);
        setCategories(cats);
      }
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [txId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/transactions');
  }

  async function onSave() {
    if (!tx || !selectedAccount) return;
    setFormError(null);
    const errors: Record<string, true> = {};

    const major = parseAmount(amount, localeTag());
    if (major === null || major <= 0) errors.amount = true;

    const occurredAt = occurredAtFrom(dateStr, tx.occurred_at);
    if (!occurredAt) errors.date = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await updateTransaction(tx.id, {
        accountId: selectedAccount.id,
        currencyCode: selectedAccount.currency_code,
        amountMinor: toMinorUnits(major as number, selectedAccount.currency_code),
        categoryId: categoryId ?? null,
        description: description.trim() || null,
        occurredAt: occurredAt as string,
      });
      close();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
      setSubmitting(false);
    }
  }

  function onDelete() {
    sheet.show({
      title: t('finance.confirmDeleteTitle'),
      message: t('finance.confirmDeleteBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteTransaction(txId);
                close();
              } catch (err) {
                setFormError(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (missing) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Text muted>{t('finance.edit.notFound')}</Text>
          <Button label={t('common.cancel')} variant="secondary" onPress={close} />
        </View>
      </SafeAreaView>
    );
  }

  // Transfers and goal/debt ledger mirrors (#6) are read-only from Activity —
  // editing them would desync the paired account / goal / debt balance.
  const isReadOnly = tx ? tx.type !== 'income' && tx.type !== 'expense' : false;
  const readOnlyNote =
    tx?.type === 'goal_contribution'
      ? t('finance.edit.goalNote')
      : tx?.type === 'debt_payment'
        ? t('finance.edit.debtNote')
        : t('finance.edit.transferNote');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t('finance.edit.title')}</Text>

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        {isReadOnly ? (
          <View style={styles.form}>
            <Text variant="moneyMin">
              {tx ? formatAmountFor(tx) : ''}
            </Text>
            <Text variant="caption" muted>
              {tx?.account?.name ?? ''}
            </Text>
            <Text muted>{readOnlyNote}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text variant="caption" muted>
              {t('finance.entry.accountLabel')}
            </Text>
            <View style={styles.chips}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.name} (${a.currency_code})`}
                  selected={a.id === accountId}
                  role="radio"
                  onPress={() => setAccountId(a.id)}
                />
              ))}
            </View>

            <TextField
              label={`${t('finance.entry.amountLabel')}${
                selectedAccount ? ` (${selectedAccount.currency_code})` : ''
              }`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              error={fieldErrors.amount ? t('errors.validation') : undefined}
            />

            {categories.length > 0 ? (
              <>
                <Text variant="caption" muted>
                  {t('finance.entry.categoryLabel')}
                </Text>
                <View style={styles.chips}>
                  <Chip
                    label={t('finance.categories.none')}
                    selected={categoryId === null}
                    role="radio"
                    onPress={() => setCategoryId(null)}
                  />
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

            <TextField
              label={t('finance.edit.dateLabel')}
              value={dateStr}
              onChangeText={setDateStr}
              autoCapitalize="none"
              error={fieldErrors.date ? t('errors.validation') : undefined}
            />

            <TextField
              label={t('finance.entry.descriptionLabel')}
              value={description}
              onChangeText={setDescription}
              autoCapitalize="sentences"
            />

            <Button
              label={submitting ? t('auth.processing') : t('finance.edit.saveCta')}
              onPress={onSave}
              loading={submitting}
            />
          </View>
        )}

        {isReadOnly ? null : (
          <Button label={t('finance.edit.deleteCta')} variant="dangerQuiet" onPress={onDelete} />
        )}
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

/** Read-only amount string for a transfer row (uses its own stored currency). */
function formatAmountFor(tx: TransactionWithRefs): string {
  const major = toMajorUnits(money(tx.amount_minor, tx.currency_code));
  return `${tx.currency_code} ${major}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
