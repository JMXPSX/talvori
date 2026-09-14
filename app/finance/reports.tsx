/** Reports — range cash-flow + spending breakdown, and budget-vs-actual variance.
 *  Range picks a preset window (this month / last month / last 3 months / YTD);
 *  budget-vs-actual compares a budget period's per-category limits against actual
 *  spend. FX-correct via the shared reporting-currency rule. Core (not gated). */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chartSeries, elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { BentoPage, BentoRow, Card, ErrorNotice, Select, Text } from '@/components/ui';
import { listTransactions, listCategories, type TransactionWithRefs } from '@/features/finance/api';
import { monthFlow } from '@/features/finance/flow';
import { monthKeyOf } from '@/features/finance/insights';
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

/** Inclusive whole days between two 'YYYY-MM-DD' dates (>= 1). */
function daysInRange(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** The last `n` month keys (oldest first) ending at `todayISO`'s month. */
function lastMonthKeys(todayISO: string, n: number): string[] {
  const y = +todayISO.slice(0, 4);
  const m = +todayISO.slice(5, 7); // 1-based
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

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
  const todayISO = new Date().toISOString();
  const range = presetRange(preset, todayISO);
  const rateFor = makeRateLookup(rates);
  const report = reportForRange(txns, range, reporting, rateFor);

  // Range-derived stat tiles: average expense per elapsed day, transaction count.
  const days = daysInRange(range.from, range.to);
  const avgPerDayMinor = Math.round(report.outMinor / days);

  // Last-6-months In / Out series (transfers excluded, reporting currency), for the
  // bar chart. Heights scale to the largest single In-or-Out value across the window.
  const monthFmt = new Intl.DateTimeFormat(i18n.language, { month: 'short' });
  const bars = lastMonthKeys(todayISO, 6).map((key) => {
    const f = monthFlow(txns, key, reporting, rateFor);
    return { key, label: monthFmt.format(new Date(`${key}-01T00:00:00Z`)), inMinor: f.inMinor, outMinor: f.outMinor };
  });
  const barMax = Math.max(1, ...bars.map((b) => Math.max(b.inMinor, b.outMinor)));

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

  // Net hero copy: what share of income was kept this range (guard divide-by-zero).
  const keptPct = report.inMinor > 0 ? Math.round((report.netMinor / report.inMinor) * 100) : 0;
  const catMax = Math.max(1, ...report.byCategory.map((c) => c.amountMinor));

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
                  {/* Row 1 — purple net-flow hero + a grid of range stat tiles. */}
                  <BentoRow>
                    <View style={styles.heroSlot}>
                      <View style={styles.hero}>
                        <Text variant="caption" style={styles.heroLabel}>
                          {t('reports.netCashFlow')}
                        </Text>
                        <Text style={styles.heroAmount}>
                          {report.netMinor >= 0 ? '+' : '−'}
                          {formatAmount(Math.abs(report.netMinor), reporting)}
                        </Text>
                        <Text variant="caption" style={styles.heroHint}>
                          {report.inMinor > 0
                            ? t('reports.keptOfIncome', { pct: keptPct })
                            : t('reports.noIncome')}
                        </Text>
                      </View>
                    </View>

                    <Card style={styles.statsSlot}>
                      <View style={styles.statGrid}>
                        <View style={styles.statTile}>
                          <Text variant="caption" muted>{t('reports.income')}</Text>
                          <Text style={[styles.statValue, styles.income]}>{formatAmount(report.inMinor, reporting)}</Text>
                        </View>
                        <View style={styles.statTile}>
                          <Text variant="caption" muted>{t('reports.expenses')}</Text>
                          <Text style={styles.statValue}>{formatAmount(report.outMinor, reporting)}</Text>
                        </View>
                        <View style={styles.statTile}>
                          <Text variant="caption" muted>{t('reports.avgPerDay')}</Text>
                          <Text style={styles.statValue}>{formatAmount(avgPerDayMinor, reporting)}</Text>
                        </View>
                        <View style={styles.statTile}>
                          <Text variant="caption" muted>{t('reports.transactions')}</Text>
                          <Text style={styles.statValue}>{report.count}</Text>
                        </View>
                      </View>
                    </Card>
                  </BentoRow>

                  {/* Row 2 — In vs out bars + Where it went category list. */}
                  <BentoRow>
                    <Card style={styles.chartSlot}>
                      <View style={styles.chartHead}>
                        <View style={styles.chartHeadText}>
                          <Text variant="subheading">{t('reports.inVsOut')}</Text>
                          <Text variant="caption" muted>
                            {t('reports.lastMonthsCcy', { count: 6, currency: reporting })}
                          </Text>
                        </View>
                        <View style={styles.legend}>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: palette.positive }]} />
                            <Text variant="caption" muted>{t('finance.ledger.in')}</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: palette.primary }]} />
                            <Text variant="caption" muted>{t('finance.ledger.out')}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.chart}>
                        {bars.map((b) => (
                          <View key={b.key} style={styles.barGroupCol}>
                            <View style={styles.barPair}>
                              <View
                                style={[
                                  styles.bar,
                                  { height: `${(b.inMinor / barMax) * 100}%`, backgroundColor: palette.positive },
                                ]}
                              />
                              <View
                                style={[
                                  styles.bar,
                                  { height: `${(b.outMinor / barMax) * 100}%`, backgroundColor: palette.primary },
                                ]}
                              />
                            </View>
                            <Text variant="caption" muted style={styles.barLabel}>{b.label}</Text>
                          </View>
                        ))}
                      </View>

                      <Text variant="caption" muted style={styles.chartNote}>
                        {t('reports.transfersExcluded')}
                      </Text>
                    </Card>

                    <Card style={styles.catSlot}>
                      <Text variant="subheading">{t('reports.whereItWent')}</Text>
                      <Text variant="caption" muted>
                        {t('reports.categoriesCount', { count: report.byCategory.length })}
                      </Text>
                      {report.byCategory.length === 0 ? (
                        <Text muted style={styles.catEmpty}>{t('reports.empty')}</Text>
                      ) : (
                        <View style={styles.catList}>
                          {report.byCategory.slice(0, 6).map((c, i) => {
                            const color = chartSeries[i % chartSeries.length];
                            return (
                              <View key={c.categoryId ?? 'none'}>
                                <View style={styles.catHead}>
                                  <Text variant="caption" numberOfLines={1} style={styles.catLabel}>
                                    {categoryName(c.categoryId)}
                                  </Text>
                                  <Text variant="moneyMin" muted>{formatAmount(c.amountMinor, reporting)}</Text>
                                </View>
                                <View style={styles.barTrack}>
                                  <View
                                    style={{
                                      height: '100%',
                                      borderRadius: radius.pill,
                                      width: `${(c.amountMinor / catMax) * 100}%`,
                                      backgroundColor: color,
                                    }}
                                  />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </Card>
                  </BentoRow>

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
  income: { color: c.positiveStrong },
  over: { color: c.danger },

  // Row 1 — net hero + stat grid.
  heroSlot: { flex: 1, minWidth: 0 },
  hero: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    boxShadow: elevation.raised,
  },
  heroLabel: { color: c.white, opacity: 0.82 },
  heroAmount: { color: c.white, fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroHint: { color: c.white, opacity: 0.9 },
  statsSlot: { flex: 1.35, minWidth: 0 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statTile: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 0,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.fillSoft,
  },
  statValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Row 2 — In vs out chart.
  chartSlot: { flex: 1.35, minWidth: 0 },
  chartHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  chartHeadText: { flex: 1, minWidth: 0, gap: 2 },
  legend: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    height: 180,
    marginTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  barGroupCol: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.xs },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.xs, width: '100%', flex: 1 },
  bar: { width: 22, minHeight: 2, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  barLabel: { flexShrink: 0 },
  chartNote: { marginTop: spacing.md, lineHeight: 17 },

  // Row 2 — Where it went category list.
  catSlot: { flex: 1, minWidth: 0, gap: 2 },
  catEmpty: { marginTop: spacing.md },
  catList: { gap: spacing.md, marginTop: spacing.md },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  catLabel: { flex: 1 },
  barTrack: { height: 8, borderRadius: radius.pill, backgroundColor: c.fill, overflow: 'hidden' },

  // Budget vs actual table.
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
