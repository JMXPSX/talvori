/** Reports — range cash-flow + spending breakdown, and budget-vs-actual variance.
 *  Range picks a preset window (this month / last month / last 3 months / YTD);
 *  budget-vs-actual compares a budget period's per-category limits against actual
 *  spend. FX-correct via the shared reporting-currency rule. Core (not gated). */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chartSeries, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { BentoPage, BentoRow, Card, ErrorNotice, Select, Text } from '@/components/ui';
import { listTransactions, listCategories, type TransactionWithRefs } from '@/features/finance/api';
import { listBudgetStatus, listBudgets } from '@/features/finance/planningApi';
import { pickCurrentBudget } from '@/features/finance/plan';
import { budgetRemainingMinor } from '@/features/finance/progress';
import { presetRange, reportForRange, type RangePreset } from '@/features/finance/reports';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { BudgetRow, BudgetStatusRow, CategoryRow, LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

const RANGE_KEYS: Record<RangePreset, string> = {
  'this-month': 'reports.rangeThisMonth',
  'last-month': 'reports.rangeLastMonth',
  'last-3-months': 'reports.range3Months',
  ytd: 'reports.rangeYtd',
};

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [txns, setTxns] = useState<TransactionWithRefs[]>([]);
  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [status, setStatus] = useState<BudgetStatusRow[]>([]);
  const [preset, setPreset] = useState<RangePreset>('this-month');
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      // ponytail: 1000 covers ~a year for a normal household; widen if ranges grow.
      const [tx, fx, cats, budgetRows] = await Promise.all([
        listTransactions(active.id, 1000),
        listLatestRates(active.id),
        listCategories(active.id, 'expense'),
        listBudgets(active.id),
      ]);
      setTxns(tx);
      setRates(fx);
      setCategories(cats);
      setBudgets(budgetRows);
      const current = pickCurrentBudget(budgetRows, new Date().toISOString());
      setBudgetId((prev) => (prev && budgetRows.some((b) => b.id === prev) ? prev : current?.id ?? null));
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

  // Per-category limit vs spend for the selected budget period.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!budgetId) {
        setStatus([]);
        return;
      }
      try {
        const rows = await listBudgetStatus(budgetId);
        if (!cancelled) setStatus(rows);
      } catch (err) {
        if (!cancelled) setErrorKey(toAppError(err).messageKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [budgetId]);

  const reporting = active?.reporting_currency_code ?? 'USD';
  const range = presetRange(preset, new Date().toISOString());
  const report = reportForRange(txns, range, reporting, makeRateLookup(rates));

  const categoryName = (id: string | null): string =>
    id ? (categories.find((c) => c.id === id)?.name ?? t('planning.budgets.uncategorized')) : t('finance.categories.none');

  const rangeOptions = (Object.keys(RANGE_KEYS) as RangePreset[]).map((k) => ({ value: k, label: t(RANGE_KEYS[k]) }));
  const budgetFmt = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' });
  const budgetOptions = [...budgets]
    .sort((a, b) => b.period_start.localeCompare(a.period_start))
    .map((b) => ({ value: b.id, label: budgetFmt.format(new Date(b.period_start)) }));

  // Budget-vs-actual totals (sum of limits and spend across the period's categories).
  const budgetLimit = status.reduce((s, r) => s + r.limit_minor, 0);
  const budgetSpent = status.reduce((s, r) => s + r.spent_minor, 0);
  const bccy = status[0]?.currency_code ?? reporting;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView>
        <BentoPage>
          <Text variant="title">{t('reports.title')}</Text>

          {!active ? (
            <Text muted>{t('finance.noHousehold')}</Text>
          ) : loading ? (
            <ActivityIndicator color={palette.brand} />
          ) : errorKey ? (
            <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
          ) : (
            <>
              <View style={styles.controlRow}>
                <Text variant="subheading">{t('reports.cashFlow')}</Text>
                <Select
                  accessibilityLabel={t('reports.rangeLabel')}
                  options={rangeOptions}
                  value={preset}
                  onChange={(v) => setPreset(v as RangePreset)}
                  style={styles.rangeSelect}
                />
              </View>

              {report.count === 0 ? (
                <Text muted>{t('reports.empty')}</Text>
              ) : (
                <>
                  <BentoRow>
                    <Card style={styles.tile}>
                      <Text variant="caption" muted>{t('reports.income')}</Text>
                      <Text variant="title" style={styles.income}>{formatAmount(report.inMinor, reporting)}</Text>
                    </Card>
                    <Card style={styles.tile}>
                      <Text variant="caption" muted>{t('reports.expenses')}</Text>
                      <Text variant="title">{formatAmount(report.outMinor, reporting)}</Text>
                    </Card>
                    <Card style={styles.tile}>
                      <Text variant="caption" muted>{t('reports.net')}</Text>
                      <Text variant="title" style={report.netMinor >= 0 ? styles.income : styles.over}>
                        {report.netMinor >= 0 ? '+' : '−'}{formatAmount(Math.abs(report.netMinor), reporting)}
                      </Text>
                    </Card>
                  </BentoRow>

                  {report.byCategory.length > 0 ? (
                    <Card>
                      <Text variant="subheading">{t('reports.spendingByCategory')}</Text>
                      {report.byCategory.slice(0, 10).map((c, i) => {
                        const frac = report.outMinor > 0 ? c.amountMinor / report.outMinor : 0;
                        const color = chartSeries[i % chartSeries.length];
                        return (
                          <View key={c.categoryId ?? 'none'} style={styles.catRow}>
                            <View style={styles.catHead}>
                              <Text variant="caption" numberOfLines={1} style={styles.catLabel}>
                                {categoryName(c.categoryId)}
                              </Text>
                              <Text variant="moneyMin" muted>
                                {formatAmount(c.amountMinor, reporting)} · {Math.round(frac * 100)}%
                              </Text>
                            </View>
                            <View style={styles.barTrack}>
                              <View style={{ flex: frac, backgroundColor: color }} />
                              <View style={{ flex: 1 - frac }} />
                            </View>
                          </View>
                        );
                      })}
                    </Card>
                  ) : null}

                  {report.missing.length > 0 ? (
                    <Text variant="caption" muted>
                      {t('fx.missingRates', { currencies: report.missing.join(', ') })}
                    </Text>
                  ) : null}
                </>
              )}

              {/* Budget vs actual — variance per category for the selected budget period. */}
              <View style={styles.controlRow}>
                <Text variant="subheading">{t('reports.budgetVsActual')}</Text>
                {budgetOptions.length > 0 && budgetId ? (
                  <Select
                    accessibilityLabel={t('reports.selectBudget')}
                    options={budgetOptions}
                    value={budgetId}
                    onChange={setBudgetId}
                    style={styles.rangeSelect}
                  />
                ) : null}
              </View>

              {status.length === 0 ? (
                <Text muted>{t('reports.noBudget')}</Text>
              ) : (
                <Card>
                  <View style={styles.vaHead}>
                    <Text variant="caption" muted style={styles.vaName}>{t('reports.category')}</Text>
                    <Text variant="caption" muted style={styles.vaNum}>{t('reports.budgeted')}</Text>
                    <Text variant="caption" muted style={styles.vaNum}>{t('reports.actual')}</Text>
                    <Text variant="caption" muted style={styles.vaNum}>{t('reports.variance')}</Text>
                  </View>
                  {status.map((row) => {
                    const rem = budgetRemainingMinor(row.limit_minor, row.spent_minor);
                    return (
                      <View key={row.allocation_id} style={styles.vaRow}>
                        <Text variant="caption" numberOfLines={1} style={styles.vaName}>{categoryName(row.category_id)}</Text>
                        <Text variant="moneyMin" style={styles.vaNum}>{formatAmount(row.limit_minor, row.currency_code)}</Text>
                        <Text variant="moneyMin" style={styles.vaNum}>{formatAmount(row.spent_minor, row.currency_code)}</Text>
                        <Text variant="moneyMin" style={[styles.vaNum, rem < 0 ? styles.over : styles.income]}>
                          {rem < 0 ? '−' : '+'}{formatAmount(Math.abs(rem), row.currency_code)}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={[styles.vaRow, styles.vaTotal]}>
                    <Text variant="button" style={styles.vaName}>{t('reports.total')}</Text>
                    <Text variant="moneyMin" style={styles.vaNum}>{formatAmount(budgetLimit, bccy)}</Text>
                    <Text variant="moneyMin" style={styles.vaNum}>{formatAmount(budgetSpent, bccy)}</Text>
                    <Text variant="moneyMin" style={[styles.vaNum, budgetLimit - budgetSpent < 0 ? styles.over : styles.income]}>
                      {budgetLimit - budgetSpent < 0 ? '−' : '+'}{formatAmount(Math.abs(budgetLimit - budgetSpent), bccy)}
                    </Text>
                  </View>
                </Card>
              )}
            </>
          )}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  rangeSelect: { minWidth: 160 },
  tile: { flex: 1 },
  income: { color: c.positiveStrong },
  over: { color: c.danger },
  catRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catLabel: { flex: 1 },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.field,
    overflow: 'hidden',
  },
  vaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  vaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  vaTotal: { borderTopWidth: 1, borderTopColor: c.divider, marginTop: spacing.xs, paddingTop: spacing.sm },
  vaName: { flex: 2 },
  vaNum: { flex: 1, textAlign: 'right' },
});
