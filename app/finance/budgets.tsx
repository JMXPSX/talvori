/** Budgets: pick a budget, see per-category limits as progress meters, and add
 *  allocations. Budget creation lives in the /finance/budget-new modal. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import { palette, spacing } from '@/components/theme';
import {
  BentoPage,
  Button,
  Card,
  Chip,
  CONTENT_MAX_WIDTH,
  ErrorNotice,
  ProgressRing,
  Text,
  TextField,
  useActionSheet,
} from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
import {
  addAllocation,
  deleteAllocation,
  deleteBudget,
  listBudgetStatus,
  listBudgets,
} from '@/features/finance/planningApi';
import { addAllocationSchema } from '@/features/finance/planningSchemas';
import { budgetRemainingMinor } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, BudgetRow, BudgetStatusRow, CategoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount, formatDateRange, localeTag } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function BudgetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const sheet = useActionSheet();

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selected, setSelected] = useState<BudgetRow | null>(null);
  const [statusRows, setStatusRows] = useState<BudgetStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  // allocation form (contextual to the selected budget)
  const [allocCategory, setAllocCategory] = useState<string | null>(null);
  const [allocLimit, setAllocLimit] = useState('');
  const [allocAccount, setAllocAccount] = useState<string | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [b, cats, accs] = await Promise.all([
        listBudgets(active.id),
        listCategories(active.id, 'expense'),
        listAccounts(active.id),
      ]);
      setBudgets(b);
      setCategories(cats);
      setAccounts(accs);
      setAllocAccount((prev) => prev ?? accs[0]?.id ?? null);
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

  function onDeleteBudget(budget: BudgetRow) {
    sheet.show({
      title: t('planning.budgets.confirmDeleteTitle'),
      message: t('planning.budgets.confirmDeleteBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteBudget(budget.id);
                if (selected?.id === budget.id) {
                  setSelected(null);
                  setStatusRows([]);
                }
                await load();
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  function onDeleteAllocation(row: BudgetStatusRow) {
    if (!selected) return;
    sheet.show({
      title: t('planning.budgets.confirmDeleteAllocationTitle'),
      message: t('planning.budgets.confirmDeleteAllocationBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteAllocation(row.allocation_id);
                setStatusRows(await listBudgetStatus(selected.id));
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  async function onAddAllocation() {
    if (!active || !selected) return;
    setAllocError(null);
    const result = validate(addAllocationSchema, {
      categoryId: allocCategory ?? undefined,
      limitMajor: allocLimit === '' ? 0 : allocLimit,
      accountId: allocAccount ?? undefined,
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
        accountId: result.data.accountId,
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

  function accountName(id: string | null): string {
    if (!id) return t('planning.budgets.unassigned');
    return accounts.find((a) => a.id === id)?.name ?? t('planning.budgets.unassigned');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView>
        <BentoPage>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : budgets.length === 0 ? (
          <Text muted>{t('planning.budgets.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {budgets.map((b) => {
              const isSel = selected?.id === b.id;
              return (
                <Pressable key={b.id} onPress={() => selectBudget(b)}>
                  <Card style={isSel ? styles.cardSelected : undefined}>
                  <View style={styles.cardHeader}>
                    <Text variant="subheading">{b.name}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('finance.delete')}
                      hitSlop={12}
                      onPress={() => onDeleteBudget(b)}
                    >
                      <Feather name="trash-2" size={18} color={palette.textMuted} />
                    </Pressable>
                  </View>
                  <Text variant="caption" muted>
                    {b.currency_code} · {formatDateRange(b.period_start, b.period_end, localeTag())}
                  </Text>
                  </Card>
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
                  <Card key={row.allocation_id}>
                    {/* Ring + label + spend, per the Talvori budget mock. */}
                    <View style={styles.allocRow}>
                      <ProgressRing fraction={fraction} state={state}>
                        <Text variant="caption" style={over ? styles.overCaption : undefined}>
                          {Math.round(fraction * 100)}%
                        </Text>
                      </ProgressRing>

                      <View style={styles.allocMain}>
                        <Text variant="button" numberOfLines={1}>
                          {categoryName(row.category_id)}
                        </Text>
                        {over ? (
                          <Text variant="moneyMin" style={styles.overCaption}>
                            {t('planning.budgets.overBy', {
                              amount: formatAmount(-remaining, row.currency_code),
                            })}
                          </Text>
                        ) : (
                          <Text variant="moneyMin" style={styles.leftCaption}>
                            {t('planning.budgets.left', {
                              amount: formatAmount(remaining, row.currency_code),
                            })}
                          </Text>
                        )}
                        <Text variant="moneyMin" muted>
                          {formatAmount(row.spent_minor, row.currency_code)} /{' '}
                          {formatAmount(row.limit_minor, row.currency_code)}
                        </Text>
                        <Text variant="caption" muted>
                          {t('planning.budgets.paidFrom', { account: accountName(row.account_id) })}
                        </Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('finance.delete')}
                        hitSlop={12}
                        onPress={() => onDeleteAllocation(row)}
                      >
                        <Feather name="trash-2" size={16} color={palette.textMuted} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}

            <View style={styles.form}>
              <Text variant="caption" muted>
                {t('planning.budgets.categoryLabel')}
              </Text>
              <View style={styles.chips}>
                <Chip
                  label={t('planning.budgets.uncategorized')}
                  selected={allocCategory === null}
                  role="radio"
                  onPress={() => setAllocCategory(null)}
                />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={c.id === allocCategory}
                    role="radio"
                    onPress={() => setAllocCategory(c.id)}
                  />
                ))}
              </View>
              <Text variant="caption" muted>
                {t('planning.budgets.accountLabel')}
              </Text>
              <View style={styles.chips}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    selected={a.id === allocAccount}
                    role="radio"
                    onPress={() => setAllocAccount(a.id)}
                  />
                ))}
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
        </BentoPage>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  // Selection reads as a tinted tile — cards no longer draw borders.
  cardSelected: { backgroundColor: palette.brandMuted },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  section: { gap: spacing.sm },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  allocMain: { flex: 1, gap: 2 },
  leftCaption: { color: palette.success },
  overCaption: { color: palette.danger },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
