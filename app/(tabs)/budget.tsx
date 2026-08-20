/** Plan tab (1b — fixes F01/F04): the month budget ring + per-category meters,
 *  with Goals and Debts summary tiles. Replaces the old link-only hub. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import {
  BentoPage,
  BentoRow,
  Card,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  ProgressRing,
  Text,
} from '@/components/ui';
import { listCategories } from '@/features/finance/api';
import {
  aggregateBudget,
  daysRemaining,
  meterState,
  safeToSpendPerDayMinor,
  spentFraction,
  pickCurrentBudget,
} from '@/features/finance/plan';
import {
  listBudgetStatus,
  listBudgets,
  listDebtStatus,
  listGoalStatus,
} from '@/features/finance/planningApi';
import { budgetRemainingMinor } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type {
  BudgetRow,
  BudgetStatusRow,
  CategoryRow,
  DebtStatusRow,
  SavingsGoalStatusRow,
} from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [status, setStatus] = useState<BudgetStatusRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [goals, setGoals] = useState<SavingsGoalStatusRow[]>([]);
  const [debts, setDebts] = useState<DebtStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [budgets, cats, g, d] = await Promise.all([
        listBudgets(active.id),
        listCategories(active.id, 'expense'),
        listGoalStatus(active.id),
        listDebtStatus(active.id),
      ]);
      setCategories(cats);
      setGoals(g);
      setDebts(d);
      const current = pickCurrentBudget(budgets, new Date().toISOString());
      setBudget(current);
      setStatus(current ? await listBudgetStatus(current.id) : []);
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

  function categoryName(id: string | null): string {
    if (!id) return t('planning.budgets.uncategorized');
    return categories.find((c) => c.id === id)?.name ?? t('planning.budgets.uncategorized');
  }

  const ccy = budget?.currency_code ?? active?.reporting_currency_code ?? 'USD';
  const agg = aggregateBudget(status);
  const days = budget ? daysRemaining(budget.period_end, new Date().toISOString()) : 0;
  const safePerDay = safeToSpendPerDayMinor(agg.remainingMinor, days);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
          <Text variant="title">{t('planning.hubTitle')}</Text>

          {!active ? (
            <Text muted>{t('finance.noHousehold')}</Text>
          ) : loading ? (
            <ActivityIndicator color={palette.brand} />
          ) : errorKey ? (
            <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
          ) : (
            <>
              {budget ? (
                <BentoRow>
                  <Card style={styles.ringTile}>
                  <View style={styles.ringRow}>
                    <ProgressRing fraction={agg.fraction} state={agg.state} size={92} stroke={10}>
                      <Text variant="caption" style={styles.ringCenter}>
                        {t('planning.plan.usedPct', { pct: Math.round(agg.fraction * 100) })}
                      </Text>
                    </ProgressRing>
                    <View style={styles.ringMain}>
                      <Text variant="title">{formatAmount(Math.abs(agg.remainingMinor), ccy)}</Text>
                      {agg.remainingMinor < 0 ? (
                        <Text variant="moneyMin" style={styles.over}>
                          {t('planning.budgets.overBy', { amount: formatAmount(-agg.remainingMinor, ccy) })}
                        </Text>
                      ) : (
                        <Text variant="moneyMin" style={styles.left}>
                          {t('planning.budgets.left', { amount: formatAmount(agg.remainingMinor, ccy) })}
                        </Text>
                      )}
                      <Text variant="caption" muted>
                        {formatAmount(agg.spentMinor, ccy)} / {formatAmount(agg.limitMinor, ccy)}
                      </Text>
                      {safePerDay != null ? (
                        <Text variant="moneyMin" style={styles.safeSpend}>
                          {t('planning.plan.safePerDay', { amount: formatAmount(safePerDay, ccy) })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
                  {status.length > 0 ? (
                    <Card style={styles.budgetsTile}>
                      <View style={styles.cardHeader}>
                        <Text variant="subheading">{t('planning.budgets.title')}</Text>
                        <Pressable accessibilityRole="button" onPress={() => router.push('/finance/budgets')}>
                          <Text variant="caption" style={styles.manage}>
                            {t('planning.plan.manage')}
                          </Text>
                        </Pressable>
                      </View>
                      {status.map((row) => {
                        const remaining = budgetRemainingMinor(row.limit_minor, row.spent_minor);
                        return (
                          <Pressable
                            key={row.allocation_id}
                            accessibilityRole="button"
                            onPress={() => router.push('/finance/budgets')}
                            style={({ pressed }) => [styles.allocRow, pressed ? styles.pressed : null]}
                          >
                            <View style={styles.allocHeader}>
                              <Text variant="button" numberOfLines={1} style={styles.allocName}>
                                {categoryName(row.category_id)}
                              </Text>
                              <Text variant="moneyMin" style={remaining < 0 ? styles.over : styles.left}>
                                {remaining < 0
                                  ? t('planning.budgets.overBy', { amount: formatAmount(-remaining, row.currency_code) })
                                  : t('planning.budgets.left', { amount: formatAmount(remaining, row.currency_code) })}
                              </Text>
                            </View>
                            <ProgressBar
                              fraction={spentFraction(row.limit_minor, row.spent_minor)}
                              state={meterState(row.limit_minor, row.spent_minor)}
                            />
                          </Pressable>
                        );
                      })}
                    </Card>
                  ) : null}
                </BentoRow>
              ) : (
                <EmptyState
                  icon="pie-chart"
                  message={t('planning.budgets.empty')}
                  ctaLabel={t('planning.budgets.newCta')}
                  onCta={() => router.push('/finance/budget-new')}
                />
              )}

              <BentoRow>
                <Card style={styles.tile}>
                  <View style={styles.cardHeader}>
                    <Text variant="subheading">{t('planning.goals.title')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/finance/goals')}>
                      <Text variant="caption" style={styles.manage}>
                        {t('planning.plan.manage')}
                      </Text>
                    </Pressable>
                  </View>
                  <Text variant="title">{goals.length}</Text>
                </Card>

                <Card style={styles.tile}>
                  <View style={styles.cardHeader}>
                    <Text variant="subheading">{t('planning.debts.title')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/finance/debts')}>
                      <Text variant="caption" style={styles.manage}>
                        {t('planning.plan.manage')}
                      </Text>
                    </Pressable>
                  </View>
                  <Text variant="title">{debts.length}</Text>
                </Card>
              </BentoRow>
            </>
          )}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringCenter: { textAlign: 'center' },
  ringMain: { flex: 1, gap: 2 },
  left: { color: palette.success },
  over: { color: palette.danger },
  safeSpend: { color: palette.brand },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  manage: { color: palette.brand },
  allocRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  allocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  allocName: { flex: 1 },
  pressed: { opacity: 0.7 },
  tile: { flex: 1 },
  // 2a desktop: ring beside the budget meters (weights collapse to a stack on mobile).
  ringTile: { flex: 1 },
  budgetsTile: { flex: 2 },
});
