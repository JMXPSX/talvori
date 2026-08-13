/** Budgets: pick a budget, see per-category limits as progress meters, and add
 *  allocations. Budget creation lives in the /finance/budget-new modal. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Card, ProgressBar, Text, TextField } from '@/components/ui';
import { listCategories } from '@/features/finance/api';
import { addAllocation, listBudgetStatus, listBudgets } from '@/features/finance/planningApi';
import { addAllocationSchema } from '@/features/finance/planningSchemas';
import { budgetRemainingMinor } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { BudgetRow, BudgetStatusRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function BudgetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<BudgetRow | null>(null);
  const [statusRows, setStatusRows] = useState<BudgetStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // allocation form (contextual to the selected budget)
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
                const over = remaining < 0;
                const state = over ? 'over' : remaining === 0 ? 'full' : 'normal';
                const fraction =
                  row.limit_minor > 0 ? row.spent_minor / row.limit_minor : row.spent_minor > 0 ? 1 : 0;
                return (
                  <Card key={row.allocation_id} style={styles.allocCard}>
                    <View style={styles.allocHeader}>
                      <Text numberOfLines={1} style={styles.allocName}>
                        {categoryName(row.category_id)}
                      </Text>
                      <Text variant="caption" muted>
                        {formatAmount(row.spent_minor, row.currency_code)} /{' '}
                        {formatAmount(row.limit_minor, row.currency_code)}
                      </Text>
                    </View>
                    <ProgressBar fraction={fraction} state={state} />
                    {over ? (
                      <Text variant="caption" style={styles.overCaption}>
                        {t('planning.budgets.overBy', {
                          amount: formatAmount(-remaining, row.currency_code),
                        })}
                      </Text>
                    ) : (
                      <Text variant="caption" style={styles.leftCaption}>
                        {t('planning.budgets.left', {
                          amount: formatAmount(remaining, row.currency_code),
                        })}
                      </Text>
                    )}
                  </Card>
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

        <Button
          label={t('planning.budgets.newCta')}
          variant="secondary"
          onPress={() => router.push('/finance/budget-new')}
        />
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
  allocCard: { gap: spacing.sm },
  allocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  allocName: { flexShrink: 1 },
  leftCaption: { color: palette.success },
  overCaption: { color: palette.danger, fontWeight: '600' },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
});
