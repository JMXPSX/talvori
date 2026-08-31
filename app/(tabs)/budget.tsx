/** Plan tab (1b): the month budget ring + per-category meters (with each
 *  category's spent/limit + funding account), plus inline Savings goals and
 *  Debts — matching the Flow Prototype. Contribute / Record payment open the
 *  dedicated management screens where the funding-account flow lives. */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  BentoPage,
  BentoRow,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  ProgressBar,
  ProgressRing,
  Text,
} from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
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
  listDebts,
  listGoalStatus,
  listGoals,
} from '@/features/finance/planningApi';
import { budgetRemainingMinor, progressRatio } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type {
  AccountRow,
  BudgetRow,
  BudgetStatusRow,
  CategoryRow,
  DebtRow,
  DebtStatusRow,
  SavingsGoalRow,
  SavingsGoalStatusRow,
} from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function PlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [status, setStatus] = useState<BudgetStatusRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [goalRows, setGoalRows] = useState<SavingsGoalRow[]>([]);
  const [goalStatus, setGoalStatus] = useState<Record<string, SavingsGoalStatusRow>>({});
  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [debtStatus, setDebtStatus] = useState<Record<string, DebtStatusRow>>({});
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [budgets, cats, accs, gRows, gStat, dRows, dStat] = await Promise.all([
        listBudgets(active.id),
        listCategories(active.id, 'expense'),
        listAccounts(active.id),
        listGoals(active.id),
        listGoalStatus(active.id),
        listDebts(active.id),
        listDebtStatus(active.id),
      ]);
      setCategories(cats);
      setAccounts(accs);
      setGoalRows(gRows);
      setGoalStatus(Object.fromEntries(gStat.map((r) => [r.goal_id, r])));
      setDebtRows(dRows);
      setDebtStatus(Object.fromEntries(dStat.map((r) => [r.debt_id, r])));
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

  function accountName(id: string | null): string {
    if (!id) return t('planning.budgets.unassignedAccount');
    return accounts.find((a) => a.id === id)?.name ?? t('planning.budgets.unassignedAccount');
  }

  const debtsOwedByCurrency = debtRows.reduce<Record<string, number>>((acc, d) => {
    const bal = debtStatus[d.id]?.balance_minor ?? d.principal_minor;
    acc[d.currency_code] = (acc[d.currency_code] ?? 0) + Math.max(0, bal);
    return acc;
  }, {});
  const totalOwedLabel = Object.entries(debtsOwedByCurrency)
    .map(([cur, amt]) => formatAmount(amt, cur))
    .join(' · ');
  const todayDay = new Date().getDate();

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
                            accessibilityLabel={categoryName(row.category_id)}
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
                              <Feather name="edit-2" size={14} color={palette.textMuted} />
                            </View>
                            <ProgressBar
                              fraction={spentFraction(row.limit_minor, row.spent_minor)}
                              state={meterState(row.limit_minor, row.spent_minor)}
                            />
                            <Text variant="caption" muted>
                              {t('planning.budgets.spentOf', {
                                spent: formatAmount(row.spent_minor, row.currency_code),
                                limit: formatAmount(row.limit_minor, row.currency_code),
                              })}{' · '}
                              {t('planning.budgets.paidFrom', { account: accountName(row.account_id) })}
                            </Text>
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
                {/* Savings goals — inline progress + Contribute (opens the Goals screen). */}
                <Card style={styles.tile}>
                  <View style={styles.cardHeader}>
                    <Text variant="subheading">{t('planning.goals.title')}</Text>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/finance/goals')}>
                      <Text variant="caption" style={styles.manage}>{t('planning.plan.manage')}</Text>
                    </Pressable>
                  </View>
                  {goalRows.length === 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => router.push('/finance/goals')}>
                      <Text variant="caption" style={styles.addLink}>{t('planning.goals.addTitle')}</Text>
                    </Pressable>
                  ) : (
                    goalRows.map((g) => {
                      const saved = goalStatus[g.id]?.saved_minor ?? 0;
                      const ratio = progressRatio(saved, g.target_minor);
                      return (
                        <View key={g.id} style={styles.planItem}>
                          <View style={styles.allocHeader}>
                            <Text variant="button" numberOfLines={1} style={styles.allocName}>{g.name}</Text>
                            <Text variant="caption" style={styles.pct}>
                              {t('planning.plan.usedPct', { pct: Math.round(ratio * 100) })}
                            </Text>
                          </View>
                          <ProgressBar fraction={ratio} />
                          <View style={styles.allocHeader}>
                            <Text variant="caption" muted>
                              {formatAmount(saved, g.currency_code)} / {formatAmount(g.target_minor, g.currency_code)}
                            </Text>
                            <Button
                              label={t('planning.goals.contributeCta')}
                              variant="accent"
                              style={styles.smallBtn}
                              onPress={() => router.push('/finance/goals')}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                </Card>

                {/* Debts — inline balance + Record payment (opens the Debts screen). */}
                <Card style={styles.tile}>
                  <View style={styles.cardHeader}>
                    <Text variant="subheading">{t('planning.debts.title')}</Text>
                    {debtRows.length > 0 ? (
                      <Text variant="caption" muted>
                        {t('planning.debts.totalOwed', { amount: totalOwedLabel })}
                      </Text>
                    ) : null}
                  </View>
                  {debtRows.length === 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => router.push('/finance/debts')}>
                      <Text variant="caption" style={styles.addLink}>{t('planning.debts.addTitle')}</Text>
                    </Pressable>
                  ) : (
                    debtRows.map((d) => {
                      const bal = debtStatus[d.id]?.balance_minor ?? d.principal_minor;
                      const overdue = d.due_day != null && bal > 0 && todayDay > d.due_day;
                      return (
                        <View key={d.id} style={styles.planItem}>
                          <View style={styles.allocHeader}>
                            <Text variant="button" numberOfLines={1} style={styles.allocName}>{d.name}</Text>
                            <Text variant="moneyMin" style={bal > 0 ? styles.over : styles.left}>
                              {formatAmount(bal, d.currency_code)}
                            </Text>
                          </View>
                          <View style={styles.allocHeader}>
                            <Text variant="caption" style={overdue ? styles.over : undefined} muted={!overdue}>
                              {overdue
                                ? t('planning.debts.overdueOn', { day: d.due_day })
                                : d.due_day != null
                                  ? t('planning.debts.dueDay', { day: d.due_day })
                                  : ''}
                            </Text>
                            <Pressable accessibilityRole="button" onPress={() => router.push('/finance/debts')}>
                              <Text variant="caption" style={styles.recordLink}>{t('planning.debts.payCta')}</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}
                </Card>
              </BentoRow>
            </>
          )}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringCenter: { textAlign: 'center' },
  ringMain: { flex: 1, gap: 2 },
  left: { color: c.success },
  over: { color: c.danger },
  safeSpend: { color: c.brand },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  manage: { color: c.brand },
  allocRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  allocHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  allocName: { flex: 1 },
  pressed: { opacity: 0.7 },
  tile: { flex: 1 },
  planItem: { gap: spacing.xs, paddingVertical: spacing.sm },
  pct: { color: c.accent },
  addLink: { color: c.brand },
  recordLink: { color: c.tertiary },
  smallBtn: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  // 2a desktop: ring beside the budget meters (weights collapse to a stack on mobile).
  ringTile: { flex: 1 },
  budgetsTile: { flex: 2 },
});
