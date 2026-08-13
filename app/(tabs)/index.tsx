/**
 * Home dashboard. Hero shows the household's total balance consolidated into the
 * reporting currency (premium; free sees an upgrade hero). Below: an icon
 * quick-action grid and the accounts list with live balances. All money is
 * formatted per the device locale and each account's own currency.
 */

import { Feather } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Card, Donut, EmptyState, ErrorNotice, Text } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listAccountBalances, listAccounts, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { categoryBreakdown, donutArcs } from '@/features/finance/donut';
import { sumInReporting } from '@/features/finance/fx';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import type { AccountBalanceRow, AccountRow, LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

type FeatherName = keyof typeof Feather.glyphMap;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();
  const { has } = usePlan();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [balances, setBalances] = useState<Record<string, AccountBalanceRow>>({});
  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [txns, setTxns] = useState<TransactionWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    setLoading(true);
    try {
      const [accs, bals, fx, tx] = await Promise.all([
        listAccounts(active.id),
        listAccountBalances(active.id),
        listLatestRates(active.id),
        listTransactions(active.id),
      ]);
      setAccounts(accs);
      setBalances(Object.fromEntries(bals.map((b) => [b.account_id, b])));
      setRates(fx);
      setTxns(tx);
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

  if (hLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.padded}>
          <Text variant="title">{t('screens.homeTitle')}</Text>
          <EmptyState
            icon="home"
            message={t('finance.noHousehold')}
            ctaLabel={t('finance.goToHouseholds')}
            onCta={() => router.push('/household')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const reporting = active.reporting_currency_code;
  const items = accounts.map((a) => ({
    balanceMinor: balances[a.id]?.balance_minor ?? a.opening_balance_minor,
    currency: a.currency_code,
  }));
  const consolidated = has('multi_currency_dashboard')
    ? sumInReporting(items, reporting, makeRateLookup(rates))
    : null;
  const breakdown = categoryBreakdown(txns, reporting, makeRateLookup(rates), t('finance.categories.none'));
  const segments = donutArcs(breakdown.slices.map((s) => s.amountMinor)).map((a, i) => ({
    ...a,
    color: breakdown.slices[i]?.color ?? palette.border,
  }));

  const actions: { icon: FeatherName; label: string; href: string }[] = [
    { icon: 'arrow-down-left', label: t('finance.addIncome'), href: '/finance/entry?type=income' },
    { icon: 'arrow-up-right', label: t('finance.addExpense'), href: '/finance/entry?type=expense' },
    { icon: 'repeat', label: t('finance.addTransfer'), href: '/finance/transfer' },
    { icon: 'credit-card', label: t('finance.manageAccounts'), href: '/finance/accounts' },
    { icon: 'trending-up', label: t('fx.manageRates'), href: '/finance/rates' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="eyebrow" muted>{active.name}</Text>

        {/* Hero: consolidated total (premium) or an upgrade prompt (free). */}
        {has('multi_currency_dashboard') ? (
          <View style={styles.hero}>
            <Text variant="eyebrow" style={styles.heroLabel}>
              {t('fx.reportingTotal', { currency: reporting })}
            </Text>
            <Text variant="title" style={styles.heroAmount}>
              {formatAmount(consolidated?.totalMinor ?? 0, reporting)}
            </Text>
            {consolidated && consolidated.missing.length > 0 ? (
              <Link href="/finance/rates">
                <Text variant="caption" style={styles.heroHint}>
                  {t('fx.missingRates', { currencies: consolidated.missing.join(', ') })}
                </Text>
              </Link>
            ) : null}
          </View>
        ) : (
          <Pressable style={styles.hero} onPress={() => router.push('/subscription')}>
            <Text variant="eyebrow" style={styles.heroLabel}>{t('billing.capMultiCurrency')}</Text>
            <Text variant="heading" style={styles.heroAmount}>{t('billing.lockedTitle')}</Text>
            <Text variant="caption" style={styles.heroHint}>{t('billing.manageCta')}</Text>
          </Pressable>
        )}

        {/* Quick actions grid */}
        <View style={styles.tiles}>
          {actions.map((a) => (
            <Pressable key={a.href} style={styles.tile} onPress={() => router.push(a.href as never)}>
              <View style={styles.tileIcon}>
                <Feather name={a.icon} size={20} color={palette.brand} />
              </View>
              <Text variant="caption" style={styles.tileLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Spending by category */}
        {breakdown.slices.length > 0 ? (
          <Card>
            <Text variant="eyebrow" muted>{t('finance.spendingByCategory')}</Text>
            <View style={styles.donutRow}>
              <Donut segments={segments} size={140} stroke={20} />
              <View style={styles.legend}>
                {breakdown.slices.slice(0, 6).map((s) => (
                  <View key={s.label} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: s.color }]} />
                    <Text variant="caption" style={styles.legendLabel} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text variant="caption" muted>{formatAmount(s.amountMinor, reporting)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        ) : null}

        {/* Accounts */}
        <Text variant="eyebrow" muted>{t('finance.accounts.title')}</Text>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon="credit-card"
            message={t('finance.noAccounts')}
            ctaLabel={t('finance.manageAccounts')}
            onCta={() => router.push('/finance/accounts')}
          />
        ) : (
          <View style={styles.list}>
            {accounts.map((a) => {
              const bal = balances[a.id];
              return (
                <Pressable key={a.id} onPress={() => router.push('/finance/accounts')}>
                  <Card>
                    <View style={styles.cardRow}>
                      <Text variant="heading">{a.name}</Text>
                      <Text variant="heading">
                        {bal
                          ? formatAmount(bal.balance_minor, bal.currency_code)
                          : formatAmount(a.opening_balance_minor, a.currency_code)}
                      </Text>
                    </View>
                    <Text variant="caption" muted>
                      {t(`finance.accounts.types.${a.type}`)} · {a.currency_code}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  padded: { padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.md },
  hero: {
    backgroundColor: palette.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: palette.brandDeep,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroLabel: { color: palette.white, opacity: 0.85 },
  heroAmount: { color: palette.white, fontSize: 36 },
  heroHint: { color: palette.white, opacity: 0.9 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { textAlign: 'center' },
  list: { gap: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendLabel: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
});
