/**
 * Home dashboard. Hero shows the household's total balance consolidated into the
 * reporting currency (premium; free sees an upgrade hero). Below: an icon
 * quick-action grid and the accounts list with live balances. All money is
 * formatted per the device locale and each account's own currency.
 *
 * Account-scope pills (money-model #4) filter the hero, the spending donut, and
 * recent activity to one account or all — Checking and Savings are never silently
 * combined; a caption states what is in view.
 */

import { Feather } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { BentoPage, BentoRow, Card, Chip, Donut, EmptyState, ErrorNotice, Text } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listAccountBalances, listAccounts, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { categoryBreakdown, donutArcs } from '@/features/finance/donut';
import { sumByCurrency, sumInReporting } from '@/features/finance/fx';
import { monthKeyOf } from '@/features/finance/insights';
import { accountLedger } from '@/features/finance/ledger';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import type { AccountBalanceRow, AccountRow, LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

type FeatherName = keyof typeof Feather.glyphMap;

/** Icon + tint for a transaction type (recent-activity rows). */
function txIcon(type: 'income' | 'expense' | 'transfer'): { name: FeatherName; color: string; bg: string } {
  if (type === 'income') return { name: 'arrow-down-left', color: palette.success, bg: palette.successMuted };
  if (type === 'transfer') return { name: 'repeat', color: palette.brand, bg: palette.brandMuted };
  return { name: 'arrow-up-right', color: palette.brand, bg: palette.brandMuted };
}

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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

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
  // Money-model decision #4: account-scoped dashboard. `scope` = null → all accounts;
  // Checking and Savings are never silently combined. Filtering the source arrays
  // re-derives the hero, the spending donut, and recent activity for the chosen scope.
  const scope =
    selectedAccountId && accounts.some((a) => a.id === selectedAccountId) ? selectedAccountId : null;
  const visibleAccounts = scope ? accounts.filter((a) => a.id === scope) : accounts;
  const visibleTxns = scope ? txns.filter((tx) => tx.account_id === scope) : txns;
  const items = visibleAccounts.map((a) => ({
    balanceMinor: balances[a.id]?.balance_minor ?? a.opening_balance_minor,
    currency: a.currency_code,
  }));
  const consolidated = has('multi_currency_dashboard')
    ? sumInReporting(items, reporting, makeRateLookup(rates))
    : null;
  // Free tier: honest per-currency subtotals (no locked hero — F05).
  const perCurrency = sumByCurrency(items);
  const multiCurrency = perCurrency.length > 1;
  // Money-model decision #5: the "By account" ledger — In/Out/Net for the month,
  // per account, each in its own currency (transfers count both legs). Always over
  // the full account list, not the current scope (the surface lists every account).
  const ledger = accountLedger(accounts, txns, monthKeyOf(new Date().toISOString()));
  const ledgerByAccount = Object.fromEntries(ledger.map((r) => [r.accountId, r]));
  // Two-way sync with the hero scope: tapping a row scopes the dashboard; tapping
  // the account already in scope clears back to All.
  const toggleScope = (id: string) => setSelectedAccountId((cur) => (cur === id ? null : id));

  const breakdown = categoryBreakdown(visibleTxns, reporting, makeRateLookup(rates), t('finance.categories.none'));
  const segments = donutArcs(breakdown.slices.map((s) => s.amountMinor)).map((a, i) => ({
    ...a,
    color: breakdown.slices[i]?.color ?? palette.border,
  }));

  // Money-model decision #7: three quick actions — Income · Expense · Compare.
  // Transfer stays a transaction kind (created from Activity's "+"), not a quick action;
  // Accounts are reached from the accounts section below and rates from the hero caption.
  const actions: { icon: FeatherName; label: string; href: string }[] = [
    { icon: 'arrow-down-left', label: t('finance.addIncome'), href: '/finance/entry?type=income' },
    { icon: 'arrow-up-right', label: t('finance.addExpense'), href: '/finance/entry?type=expense' },
    { icon: 'shopping-bag', label: t('finance.compare'), href: '/retail' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
          <Text variant="eyebrow" muted>{active.name}</Text>

          {/* Account-scope pills (#4) — only when there's more than one account to scope. */}
          {accounts.length > 1 ? (
            <View style={styles.scope}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scopePills}
              >
                <Chip
                  label={t('finance.allAccounts')}
                  selected={scope === null}
                  role="radio"
                  onPress={() => setSelectedAccountId(null)}
                />
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    selected={scope === a.id}
                    role="radio"
                    onPress={() => setSelectedAccountId(a.id)}
                  />
                ))}
              </ScrollView>
              <Text variant="caption" muted>
                {scope
                  ? t('finance.showing', { name: accounts.find((a) => a.id === scope)?.name ?? '' })
                  : t('finance.showingAll')}
              </Text>
            </View>
          ) : null}

          {/* Row 1 — the balance hero leads; quick actions ride beside it on wide. */}
          <BentoRow>
            <View style={styles.heroSlot}>
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
                <View style={styles.hero}>
                  <Text variant="eyebrow" style={styles.heroLabel}>{t('finance.balancesTitle')}</Text>
                  {perCurrency.map((row) => (
                    <View key={row.currency} style={styles.heroRow}>
                      <Text style={styles.heroRowLabel} numberOfLines={1}>
                        {t('finance.accountsInCurrency', { currency: row.currency })}
                      </Text>
                      <Text variant="moneyMin" style={styles.heroRowValue}>
                        {formatAmount(row.totalMinor, row.currency, { disambiguate: multiCurrency })}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.heroRule} />
                  {/* One quiet upsell — never a locked hero (F05). */}
                  <Pressable
                    accessibilityRole="button"
                    style={styles.upsell}
                    onPress={() => router.push('/subscription')}
                  >
                    <Text style={styles.upsellText} numberOfLines={1}>
                      {t('finance.seeOneTotal', { currency: reporting })}
                    </Text>
                    <View style={styles.premiumPill}>
                      <Text variant="caption" style={styles.premiumText}>
                        {t('billing.planPremium')}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )}
            </View>

            <Card style={styles.actionsSlot}>
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
            </Card>
          </BentoRow>

          {/* Row 2 — spending breakdown beside the accounts ledger. */}
          <BentoRow>
            {breakdown.slices.length > 0 ? (
              <Card style={styles.donutSlot}>
                <Text variant="heading">{t('finance.spendingByCategory')}</Text>
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

            {/* One tile holding the by-account ledger (#5), not one tile per account. */}
            <Card style={styles.accountsSlot}>
              <Text variant="heading">{t('finance.byAccount.title')}</Text>
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
                    const led = ledgerByAccount[a.id];
                    const selected = scope === a.id;
                    return (
                      <View
                        key={a.id}
                        style={[styles.accountRow, selected ? styles.accountRowSelected : null]}
                      >
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={a.name}
                          style={({ pressed }) => [styles.accountMain, pressed ? styles.rowPressed : null]}
                          onPress={() => toggleScope(a.id)}
                        >
                          <Text variant="button" numberOfLines={1}>{a.name}</Text>
                          {led ? (
                            <View style={styles.ledgerRow}>
                              <Text variant="caption" muted>
                                {t('finance.ledger.in')} +{formatAmount(led.inMinor, a.currency_code)}
                              </Text>
                              <Text variant="caption" muted>
                                {t('finance.ledger.out')} −{formatAmount(led.outMinor, a.currency_code)}
                              </Text>
                              <Text
                                variant="caption"
                                style={led.netMinor >= 0 ? styles.netUp : styles.netDown}
                              >
                                {t('finance.ledger.net')} {led.netMinor >= 0 ? '+' : '−'}
                                {formatAmount(Math.abs(led.netMinor), a.currency_code)}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                        <View style={styles.accountTrailing}>
                          <Text variant="button">
                            {bal
                              ? formatAmount(bal.balance_minor, bal.currency_code)
                              : formatAmount(a.opening_balance_minor, a.currency_code)}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('finance.manageAccounts')}
                            hitSlop={12}
                            onPress={() => router.push('/finance/accounts')}
                          >
                            <Feather name="edit-2" size={16} color={palette.textMuted} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </BentoRow>

          {/* Row 3 — recent activity (scoped to the selected account, #4). */}
          {visibleTxns.length > 0 ? (
            <BentoRow>
              <Card style={styles.recentSlot}>
                <View style={styles.recentHeader}>
                  <Text variant="heading">{t('finance.recentTitle')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/transactions')}>
                    <Text variant="caption" style={styles.recentAll}>
                      {t('finance.recentAll')}
                    </Text>
                  </Pressable>
                </View>
                {visibleTxns.slice(0, 5).map((tx) => {
                  const positive = tx.direction === 'in';
                  const ic = txIcon(tx.type);
                  const caption = [tx.category?.name, tx.account?.name].filter(Boolean).join(' · ');
                  return (
                    <Pressable
                      key={tx.id}
                      accessibilityRole="button"
                      accessibilityLabel={t('finance.edit.title')}
                      onPress={() => router.push(`/finance/edit/${tx.id}`)}
                      style={({ pressed }) => [styles.recentRow, pressed ? styles.rowPressed : null]}
                    >
                      <View style={[styles.recentIcon, { backgroundColor: ic.bg }]}>
                        <Feather name={ic.name} size={16} color={ic.color} />
                      </View>
                      <View style={styles.recentMid}>
                        <Text numberOfLines={1}>
                          {tx.description ||
                            (tx.type === 'income'
                              ? t('finance.categories.income')
                              : tx.type === 'transfer'
                                ? t('finance.transfer.title')
                                : t('finance.categories.expense'))}
                        </Text>
                        {caption ? (
                          <Text variant="caption" muted numberOfLines={1}>
                            {caption}
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="moneyMin" style={positive ? styles.recentIn : null}>
                        {positive ? '+' : '−'}
                        {formatAmount(tx.amount_minor, tx.currency_code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </Card>
            </BentoRow>
          ) : null}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  padded: { padding: spacing.lg, gap: spacing.md },
  scope: { gap: spacing.xs },
  scopePills: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  // Flex weights: on wide viewports the hero takes two thirds beside the
  // actions; BentoRow collapses both to full width on narrow.
  heroSlot: { flex: 2 },
  actionsSlot: { flex: 1 },
  donutSlot: { flex: 1 },
  accountsSlot: { flex: 1 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  // In-scope row echoes the selected pill (two-way sync, #5).
  accountRowSelected: { backgroundColor: palette.brandMuted },
  accountMain: { flex: 1, gap: 4 },
  accountTrailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ledgerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  netUp: { color: palette.success },
  netDown: { color: palette.danger },
  rowPressed: { opacity: 0.6 },
  hero: {
    flex: 1,
    backgroundColor: palette.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    boxShadow: elevation.raised,
  },
  heroLabel: { color: palette.white, opacity: 0.85 },
  heroAmount: { color: palette.white, fontSize: 36 },
  heroHint: { color: palette.white, opacity: 0.9 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heroRowLabel: { color: palette.white, opacity: 0.9, flex: 1 },
  heroRowValue: { color: palette.white },
  heroRule: { height: 1, backgroundColor: palette.white, opacity: 0.2, marginVertical: spacing.xs },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  upsellText: { color: palette.white, opacity: 0.95, flex: 1 },
  premiumPill: {
    backgroundColor: palette.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  premiumText: { color: palette.accent },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    // Inset tile inside the actions card: tone, not a rule.
    backgroundColor: palette.field,
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
  recentSlot: { flex: 1 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  recentAll: { color: palette.brand },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMid: { flex: 1, gap: 2 },
  recentIn: { color: palette.success },
});
