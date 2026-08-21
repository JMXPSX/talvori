/** Insights (2d — fixes F24; premium). Month-scoped, FX-correct spending: total
 *  spent, avg/day, transaction count, and a category breakdown. Gated on the
 *  multi_currency_dashboard capability. The cumulative trend line and cross-border
 *  card are deferred (they need the FX-history + remittance work). */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chartSeries, palette, radius, spacing } from '@/components/theme';
import { BentoPage, BentoRow, Button, Card, ErrorNotice, Text } from '@/components/ui';
import { listTransactions, listCategories, type TransactionWithRefs } from '@/features/finance/api';
import { insightsForMonth, monthKeyOf } from '@/features/finance/insights';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { CategoryRow, LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function InsightsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const { has } = usePlan();

  const [txns, setTxns] = useState<TransactionWithRefs[]>([]);
  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const premium = has('multi_currency_dashboard');

  const load = useCallback(async () => {
    if (!active || !premium) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [tx, fx, cats] = await Promise.all([
        listTransactions(active.id, 500),
        listLatestRates(active.id),
        listCategories(active.id, 'expense'),
      ]);
      setTxns(tx);
      setRates(fx);
      setCategories(cats);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, premium]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!premium) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.padded}>
          <Card>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const reporting = active?.reporting_currency_code ?? 'USD';
  const monthKey = monthKeyOf(new Date().toISOString());
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date());
  const insights = insightsForMonth(txns, monthKey, reporting, makeRateLookup(rates));
  const dayOfMonth = new Date().getDate();
  const avgMinor = dayOfMonth > 0 ? Math.round(insights.totalSpentMinor / dayOfMonth) : 0;

  const categoryName = (id: string | null): string =>
    id ? (categories.find((c) => c.id === id)?.name ?? t('planning.budgets.uncategorized')) : t('finance.categories.none');

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView>
        <BentoPage>
          <View style={styles.header}>
            <Text variant="title">{t('insights.title')}</Text>
            <View style={styles.premiumPill}>
              <Text variant="caption" style={styles.premiumText}>{t('billing.planPremium')}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={palette.brand} />
          ) : errorKey ? (
            <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
          ) : insights.count === 0 ? (
            <Text muted>{t('insights.empty')}</Text>
          ) : (
            <>
              <BentoRow>
                <Card style={styles.tile}>
                  <Text variant="caption" muted>{t('insights.totalSpent')}</Text>
                  <Text variant="title">{formatAmount(insights.totalSpentMinor, reporting)}</Text>
                </Card>
                <Card style={styles.tile}>
                  <Text variant="caption" muted>{t('insights.avgPerDay')}</Text>
                  <Text variant="title">{formatAmount(avgMinor, reporting)}</Text>
                </Card>
                <Card style={styles.tile}>
                  <Text variant="caption" muted>{t('insights.transactions')}</Text>
                  <Text variant="title">{insights.count}</Text>
                </Card>
              </BentoRow>

              <Card>
                <Text variant="subheading">{t('insights.whereItWent', { month: monthLabel })}</Text>
                {insights.byCategory.slice(0, 8).map((c, i) => {
                  const frac = insights.totalSpentMinor > 0 ? c.amountMinor / insights.totalSpentMinor : 0;
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

              {insights.missing.length > 0 ? (
                <Text variant="caption" muted>
                  {t('fx.missingRates', { currencies: insights.missing.join(', ') })}
                </Text>
              ) : null}
            </>
          )}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  padded: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  premiumPill: {
    backgroundColor: palette.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  premiumText: { color: palette.accent },
  tile: { flex: 1 },
  catRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catLabel: { flex: 1 },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
    overflow: 'hidden',
  },
});
