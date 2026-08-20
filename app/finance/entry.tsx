/** Add a single income or expense. `type` comes from the ?type= query param.
 *  Amount is entered in major units and converted using the selected account's
 *  currency before saving. */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Chip, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createEntry, listAccounts, listCategories } from '@/features/finance/api';
import { createEntrySchema } from '@/features/finance/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const params = useLocalSearchParams<{ type?: string }>();
  const kind: 'income' | 'expense' = params.type === 'income' ? 'income' : 'expense';

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
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
    const result = validate(createEntrySchema, {
      accountId: selectedAccount.id,
      type: kind,
      amountMajor: amount,
      categoryId: categoryId ?? undefined,
      description: description.trim() || undefined,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createEntry({
        householdId: active.id,
        accountId: selectedAccount.id,
        type: kind,
        amountMinor: toMinorUnits(result.data.amountMajor, selectedAccount.currency_code),
        currencyCode: selectedAccount.currency_code,
        categoryId: result.data.categoryId,
        description: result.data.description,
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
              error={fieldErrors.amountMajor ? t('errors.validation') : undefined}
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
              label={t('finance.entry.descriptionLabel')}
              value={description}
              onChangeText={setDescription}
              autoCapitalize="sentences"
            />

            {formError ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(formError)}
              </Text>
            ) : null}

            <Button
              label={submitting ? t('auth.processing') : t('finance.entry.saveCta')}
              onPress={onSave}
              loading={submitting}
            />
          </View>
        )}
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
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
