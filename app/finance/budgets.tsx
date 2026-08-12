/** Budgets: create a budget for a period, then set per-category limits and see
 *  limit / spent / remaining (from the budget_status view). */

import { getLocales } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { listCategories } from '@/features/finance/api';
import { addAllocation, createBudget, listBudgetStatus, listBudgets } from '@/features/finance/planningApi';
import { addAllocationSchema, createBudgetSchema } from '@/features/finance/planningSchemas';
import { budgetRemainingMinor } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { BudgetRow, BudgetStatusRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export default function BudgetsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const bounds = monthBounds();

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<BudgetRow | null>(null);
  const [statusRows, setStatusRows] = useState<BudgetStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // create-budget form
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [start, setStart] = useState(bounds.start);
  const [end, setEnd] = useState(bounds.end);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // allocation form
  const [allocCategory, setAllocCategory] = useState<string | null>(null);
  const [allocLimit, setAllocLimit] = useState('');
  const [allocError, setAllocError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [b, cats] = await Promise.all([listBudgets(active.id), listCategories(active.id, 'expense')]);
      setBudgets(b);
      setCategories(cats);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const selectBudget = useCallback(async (b: BudgetRow) => {
    setSelected(b);
    setAllocCategory(null);
    setAllocLimit('');
    try {
      setStatusRows(await listBudgetStatus(b.id));
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }, []);

  async function onCreateBudget() {
    if (!active) return;
    setFormError(null);
    const result = validate(createBudgetSchema, {
      name,
      currencyCode: currency,
      periodStart: start,
      periodEnd: end,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await createBudget(active.id, result.data);
      setName('');
      await load();
      await selectBudget(created);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onAddAllocation() {
    if (!active || !selected) return;
    setAllocError(null);
    const result = validate(addAllocationSchema, {
      categoryId: allocCategory ?? undefined,
      limitMajor: allocLimit === '' ? 0 : allocLimit,
    });
    if (!result.success) {
      setAllocError('errors.validation');
      return;
    }
    try {
      await addAllocation({
        budgetId: selected.id,
        householdId: active.id,
        categoryId: result.data.categoryId,
        limitMinor: toMinorUnits(result.data.limitMajor, selected.currency_code),
      });
      setAllocLimit('');
      setStatusRows(await listBudgetStatus(selected.id));
    } catch (err) {
      setAllocError(toAppError(err).messageKey);
    }
  }

  function categoryName(id: string | null): string {
    if (!id) return t('planning.budgets.uncategorized');
    return categories.find((c) => c.id === id)?.name ?? t('planning.budgets.uncategorized');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : budgets.length === 0 ? (
          <Text muted>{t('planning.budgets.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {budgets.map((b) => {
              const isSel = selected?.id === b.id;
              return (
                <Pressable
                  key={b.id}
                  style={[styles.card, isSel ? styles.cardSelected : null]}
                  onPress={() => selectBudget(b)}
                >
                  <Text variant="heading">{b.name}</Text>
                  <Text variant="caption" muted>
                    {b.currency_code} · {b.period_start} → {b.period_end}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected ? (
          <View style={styles.section}>
            <Text variant="heading">{t('planning.budgets.allocationsTitle')}</Text>
            {statusRows.length === 0 ? (
              <Text variant="caption" muted>
                —
              </Text>
            ) : (
              statusRows.map((row) => {
                const remaining = budgetRemainingMinor(row.limit_minor, row.spent_minor);
                return (
                  <View key={row.allocation_id} style={styles.allocRow}>
                    <Text>{categoryName(row.category_id)}</Text>
                    <Text variant="caption" muted>
                      {t('planning.budgets.spent')} {formatAmount(row.spent_minor, row.currency_code)} /{' '}
                      {formatAmount(row.limit_minor, row.currency_code)} ·{' '}
                      <Text
                        variant="caption"
                        style={{ color: remaining < 0 ? palette.danger : palette.success }}
                      >
                        {formatAmount(remaining, row.currency_code)}
                      </Text>
                    </Text>
                  </View>
                );
              })
            )}

            <View style={styles.form}>
              <Text variant="caption" muted>
                {t('planning.budgets.categoryLabel')}
              </Text>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => setAllocCategory(null)}
                  style={[styles.chip, allocCategory === null ? styles.chipActive : null]}
                >
                  <Text variant="caption" style={{ color: allocCategory === null ? palette.white : palette.text }}>
                    {t('planning.budgets.uncategorized')}
                  </Text>
                </Pressable>
                {categories.map((c) => {
                  const on = c.id === allocCategory;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setAllocCategory(c.id)}
                      style={[styles.chip, on ? styles.chipActive : null]}
                    >
                      <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label={`${t('planning.budgets.limitLabel')} (${selected.currency_code})`}
                value={allocLimit}
                onChangeText={setAllocLimit}
                keyboardType="numeric"
              />
              {allocError ? (
                <Text variant="caption" style={{ color: palette.danger }}>
                  {t(allocError)}
                </Text>
              ) : null}
              <Button label={t('planning.budgets.addAllocationCta')} onPress={onAddAllocation} />
            </View>
          </View>
        ) : null}

        <View style={styles.divider} />

        <Text variant="heading">{t('planning.budgets.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('planning.budgets.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.budgets.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.budgets.startLabel')}
            value={start}
            onChangeText={setStart}
            error={fieldErrors.periodStart ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.budgets.endLabel')}
            value={end}
            onChangeText={setEnd}
            error={fieldErrors.periodEnd ? t('errors.validation') : undefined}
          />
          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}
          <Button
            label={submitting ? t('auth.processing') : t('planning.budgets.createCta')}
            onPress={onCreateBudget}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  cardSelected: { borderColor: palette.brand },
  section: { gap: spacing.sm },
  allocRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
});
