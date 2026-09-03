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

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Avatar, BentoPage, BentoRow, Card, Donut, EmptyState, ErrorNotice, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { HouseholdSwitcher } from '@/features/household/HouseholdSwitcher';
import { useIsWideLayout } from '@/lib/breakpoints';
import { listBills } from '@/features/bills/api';
import { isOverdue } from '@/features/bills/recurrence';
import { AccountScopePicker } from '@/features/finance/AccountScopePicker';
import { listAccountBalances, listAccounts, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { categoryBreakdown, donutArcs } from '@/features/finance/donut';
import { monthFlow } from '@/features/finance/flow';
import { convertMinor, sumByCurrency, sumInReporting } from '@/features/finance/fx';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import { monthKeyOf } from '@/features/finance/insights';
import { aggregateBudget, pickCurrentBudget } from '@/features/finance/plan';
import { listBudgetStatus, listBudgets } from '@/features/finance/planningApi';
import type {
  AccountBalanceRow,
  AccountRow,
  BillRow,
  BudgetRow,
  BudgetStatusRow,
  LatestFxRateRow,
  TransactionType,
} from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount, formatDate } from '@/lib/format';

type FeatherName = keyof typeof Feather.glyphMap;

/** Icon + tint for a transaction type (recent-activity rows). */
function txIcon(c: Palette, type: TransactionType): { name: FeatherName; color: string; bg: string } {
  if (type === 'income') return { name: 'arrow-down-left', color: c.success, bg: c.successMuted };
  if (type === 'transfer') return { name: 'repeat', color: c.brand, bg: c.brandMuted };
  if (type === 'goal_contribution') return { name: 'target', color: c.brand, bg: c.brandMuted };
  if (type === 'debt_payment') return { name: 'file-text', color: c.accent, bg: c.accentMuted };
  return { name: 'arrow-up-right', color: c.brand, bg: c.brandMuted };
}

/** Fallback description for a transaction row that has no note. */
function txFallbackLabel(t: (k: string) => string, type: TransactionType): string {
  if (type === 'income') return t('finance.categories.income');
  if (type === 'transfer') return t('finance.transfer.title');
  if (type === 'goal_contribution') return t('finance.ledger.goalContribution');
  if (type === 'debt_payment') return t('finance.ledger.debtPayment');
  return t('finance.categories.expense');
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();
  const isWide = useIsWideLayout();
  const { user } = useAuth();
  const { has } = usePlan();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [balances, setBalances] = useState<Record<string, AccountBalanceRow>>({});
  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [txns, setTxns] = useState<TransactionWithRefs[]>([]);
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatusRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    setLoading(true);
    try {
      const [accs, bals, fx, tx, budgets, billRows] = await Promise.all([
        listAccounts(active.id),
        listAccountBalances(active.id),
        listLatestRates(active.id),
        listTransactions(active.id),
        listBudgets(active.id),
        listBills(active.id),
      ]);
      setAccounts(accs);
      setBalances(Object.fromEntries(bals.map((b) => [b.account_id, b])));
      setRates(fx);
      setTxns(tx);
      setBills(billRows);
      // Money-model decision #4: the hero is the current month's spend-vs-budget
      // ratio. Load the active budget + its per-allocation status (each allocation
      // names a funding account, so the pills can scope both halves of the ratio).
      const current = pickCurrentBudget(budgets, new Date().toISOString());
      setBudget(current);
      setBudgetStatus(current ? await listBudgetStatus(current.id) : []);
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
  const avatarName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    user?.email ||
    '';
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
  const rateFor = makeRateLookup(rates);
  const showConverted = has('multi_currency_dashboard');
  const consolidated = showConverted ? sumInReporting(items, reporting, rateFor) : null;
  // The "By account" list always shows every account (unlike the scoped hero), so
  // its footer total consolidates ALL accounts into the reporting currency — the
  // per-row converted values below sum to exactly this.
  const allItems = accounts.map((a) => ({
    balanceMinor: balances[a.id]?.balance_minor ?? a.opening_balance_minor,
    currency: a.currency_code,
  }));
  const allConsolidated = showConverted ? sumInReporting(allItems, reporting, rateFor) : null;
  const currencyKinds = new Set(allItems.map((i) => i.currency.toUpperCase())).size;
  // Spend-vs-budget hero (#4): scope both halves by the funding account. Each
  // allocation names its account, so filtering the status rows partitions the
  // ratio per account (spend follows the category, which maps to one account).
  const scopedStatus = scope ? budgetStatus.filter((r) => r.account_id === scope) : budgetStatus;
  const budgetAgg = aggregateBudget(scopedStatus);
  const budgetCcy = budget?.currency_code ?? reporting;
  const budgetPct = Math.round(budgetAgg.fraction * 100);
  const heroFillPct = `${Math.min(100, Math.max(0, budgetPct))}%` as const;
  // Free tier: honest per-currency subtotals (no locked hero — F05).
  const perCurrency = sumByCurrency(items);
  const multiCurrency = perCurrency.length > 1;
  // Two-way sync with the hero scope: tapping a row scopes the dashboard; tapping
  // the account already in scope clears back to All.
  const toggleScope = (id: string) => setSelectedAccountId((cur) => (cur === id ? null : id));

  const breakdown = categoryBreakdown(visibleTxns, reporting, rateFor, t('finance.categories.none'));
  const segments = donutArcs(breakdown.slices.map((s) => s.amountMinor)).map((a, i) => ({
    ...a,
    color: breakdown.slices[i]?.color ?? palette.border,
  }));

  // This month's In / Out / Net in the reporting currency (transfers excluded),
  // scoped with the dashboard — the mock's "This month" card.
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const flow = monthFlow(visibleTxns, monthKeyOf(now.toISOString()), reporting, rateFor);
  // "Coming up" — the soonest active bills (already due-sorted by the api).
  const upcomingBills = bills.filter((b) => b.is_active).slice(0, 4);

  // Quick actions — Income · Expense · Transfer (§6.4). Income gets the positive
  // (green) circle; Expense and Transfer use the purple tint.
  const actions: { icon: FeatherName; label: string; href: string; bg: string; fg: string }[] = [
    { icon: 'arrow-down-left', label: t('finance.addIncome'), href: '/finance/entry?type=income', bg: palette.positiveTint, fg: palette.positiveStrong },
    { icon: 'arrow-up-right', label: t('finance.addExpense'), href: '/finance/entry?type=expense', bg: palette.primaryTint, fg: palette.primary },
    { icon: 'repeat', label: t('finance.addTransfer'), href: '/finance/transfer', bg: palette.primaryTint, fg: palette.primary },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
          {/* §6.4 header — greeting + household·currency pill (opens the switcher)
              on the left, the user avatar (→ Profile) on the right. On wide the
              desktop top bar owns the pill/avatar/switcher, so this is hidden. */}
          {!isWide ? (
            <>
              <View style={styles.homeHeader}>
                <View style={styles.homeHeaderLeft}>
                  <Text variant="title" style={styles.greeting}>{t('home.greeting')}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={active.name}
                    onPress={() => setSwitcherOpen(true)}
                    style={styles.householdPill}
                  >
                    <Text variant="button">{`${active.name} · ${reporting}`}</Text>
                    <Feather name="chevron-down" size={16} color={palette.textSecondary} />
                  </Pressable>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={avatarName} onPress={() => router.push('/account')}>
                  <Avatar name={avatarName} size={44} variant="self" />
                </Pressable>
              </View>
              <HouseholdSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
            </>
          ) : null}

          {/* Account-scope filter (#4) — pills, collapsing to a dropdown as accounts grow. */}
          {accounts.length > 1 ? (
            <View style={styles.scope}>
              <AccountScopePicker accounts={accounts} value={scope} onChange={setSelectedAccountId} />
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
              {budget ? (
                <View style={styles.hero}>
                  <Text variant="eyebrow" style={styles.heroLabel}>{budget.name}</Text>
                  <Text variant="title" style={styles.heroAmount}>
                    {formatAmount(budgetAgg.spentMinor, budgetCcy)}
                  </Text>
                  <Text variant="caption" style={styles.heroHint}>
                    {t('finance.hero.ofBudget', { amount: formatAmount(budgetAgg.limitMinor, budgetCcy) })}
                    {' · '}
                    {t('planning.plan.usedPct', { pct: budgetPct })}
                  </Text>
                  <View style={styles.heroTrack}>
                    <View
                      style={[
                        styles.heroFill,
                        { width: heroFillPct },
                        budgetAgg.state === 'over' ? styles.heroFillOver : null,
                      ]}
                    />
                  </View>
                  <Text
                    variant="caption"
                    style={budgetAgg.remainingMinor < 0 ? styles.heroOver : styles.heroHint}
                  >
                    {budgetAgg.remainingMinor < 0
                      ? t('planning.budgets.overBy', {
                          amount: formatAmount(-budgetAgg.remainingMinor, budgetCcy),
                        })
                      : t('planning.budgets.left', {
                          amount: formatAmount(budgetAgg.remainingMinor, budgetCcy),
                        })}
                  </Text>
                  {/* Premium keeps its consolidated total, now a quiet caption. */}
                  {has('multi_currency_dashboard') && consolidated ? (
                    <Text variant="caption" style={styles.heroBalance}>
                      {t('finance.hero.balance', { amount: formatAmount(consolidated.totalMinor, reporting) })}
                    </Text>
                  ) : null}
                </View>
              ) : has('multi_currency_dashboard') ? (
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

            {/* Quick actions ride beside the hero on mobile; on wide the desktop
                top bar already carries Income / Expense / transfer. */}
            {!isWide ? (
              <Card style={styles.actionsSlot}>
                <View style={styles.tiles}>
                  {actions.map((a) => (
                    <Pressable key={a.href} style={styles.tile} onPress={() => router.push(a.href as never)}>
                      <View style={[styles.tileIcon, { backgroundColor: a.bg }]}>
                        <Feather name={a.icon} size={20} color={a.fg} />
                      </View>
                      <Text variant="caption" style={styles.tileLabel}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            ) : null}
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

            {/* One tile holding the account rows (balance per account, matching the
                Flow Prototype), not one tile per account. */}
            <Card style={styles.accountsSlot}>
              <View style={styles.byAcctHeader}>
                <View style={styles.byAcctHeadText}>
                  <Text variant="heading">{t('finance.byAccount.title')}</Text>
                  <Text variant="caption" muted>{t('finance.byAccount.caption')}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('finance.manageAccounts')}
                  hitSlop={12}
                  onPress={() => router.push('/finance/accounts')}
                  style={({ pressed }) => [styles.byAcctManage, pressed ? styles.rowPressed : null]}
                >
                  <Feather name="edit-2" size={18} color={palette.textMuted} />
                </Pressable>
              </View>
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
                    const selected = scope === a.id;
                    const nativeMinor = bal ? bal.balance_minor : a.opening_balance_minor;
                    const nativeCcy = bal ? bal.currency_code : a.currency_code;
                    const foreign = nativeCcy.toUpperCase() !== reporting.toUpperCase();
                    // Convert this account into the household reporting currency so the
                    // consolidated total (footer) is transparent. Null rate → prompt to add one.
                    const rate = showConverted && foreign ? rateFor(nativeCcy, reporting) : null;
                    const convertedMinor =
                      rate != null ? convertMinor(nativeMinor, nativeCcy, reporting, rate) : null;
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
                          <Text variant="caption" muted>
                            {t(`finance.accounts.types.${a.type}`)} · {a.currency_code}
                          </Text>
                        </Pressable>
                        <View style={styles.accountAmounts}>
                          <Text variant="button">{formatAmount(nativeMinor, nativeCcy)}</Text>
                          {showConverted && foreign ? (
                            convertedMinor != null ? (
                              <Text variant="caption" muted style={styles.accountConverted}>
                                {t('finance.byAccount.converted', {
                                  amount: formatAmount(convertedMinor, reporting),
                                })}
                              </Text>
                            ) : (
                              <Link href="/finance/rates">
                                <Text variant="caption" style={styles.accountNoRate}>
                                  {t('finance.byAccount.noRate', { currency: nativeCcy })}
                                </Text>
                              </Link>
                            )
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                  {/* Footer: the reporting-currency total the converted rows sum to. */}
                  {showConverted && allConsolidated && currencyKinds > 1 ? (
                    <View style={styles.acctTotalRow}>
                      <Text variant="caption" muted>
                        {t('finance.byAccount.total', { currency: reporting })}
                      </Text>
                      <Text variant="button">
                        {formatAmount(allConsolidated.totalMinor, reporting)}
                      </Text>
                    </View>
                  ) : null}
                  {showConverted && allConsolidated && allConsolidated.missing.length > 0 ? (
                    <Link href="/finance/rates">
                      <Text variant="caption" style={styles.accountNoRate}>
                        {t('fx.missingRates', { currencies: allConsolidated.missing.join(', ') })}
                      </Text>
                    </Link>
                  ) : null}
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
                  const ic = txIcon(palette, tx.type);
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
                          {tx.description || txFallbackLabel(t, tx.type)}
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

          {/* Row — this month (In/Out/Net) + coming-up bills, per the mock. */}
          <BentoRow>
            <Card style={styles.summaryTile}>
              <Text variant="heading">{t('finance.thisMonth')}</Text>
              <View style={styles.flowRow}>
                <Text variant="caption" muted>{t('finance.ledger.in')}</Text>
                <Text variant="moneyMin" style={styles.flowIn}>+{formatAmount(flow.inMinor, reporting)}</Text>
              </View>
              <View style={styles.flowRow}>
                <Text variant="caption" muted>{t('finance.ledger.out')}</Text>
                <Text variant="moneyMin">−{formatAmount(flow.outMinor, reporting)}</Text>
              </View>
              <View style={[styles.flowRow, styles.flowNet]}>
                <Text variant="caption" muted>{t('finance.ledger.net')}</Text>
                <Text variant="moneyMin" style={flow.netMinor >= 0 ? styles.flowIn : styles.flowNeg}>
                  {flow.netMinor >= 0 ? '+' : '−'}{formatAmount(Math.abs(flow.netMinor), reporting)}
                </Text>
              </View>
              {flow.missing.length > 0 ? (
                <Text variant="caption" muted>{t('fx.missingRates', { currencies: flow.missing.join(', ') })}</Text>
              ) : null}
            </Card>

            <Card style={styles.summaryTile}>
              <View style={styles.cardHeaderRow}>
                <Text variant="heading">{t('bills.comingUp')}</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/bills')}>
                  <Text variant="caption" style={styles.linkText}>{t('bills.title')}</Text>
                </Pressable>
              </View>
              {upcomingBills.length === 0 ? (
                <Text variant="caption" muted style={styles.emptyLine}>{t('bills.empty')}</Text>
              ) : (
                upcomingBills.map((b) => {
                  const overdue = isOverdue(b.next_due_date, todayISO);
                  return (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      onPress={() => router.push('/bills')}
                      style={({ pressed }) => [styles.comingRow, pressed ? styles.rowPressed : null]}
                    >
                      <View style={styles.comingMain}>
                        <Text variant="button" numberOfLines={1}>{b.name}</Text>
                        <Text variant="caption" style={overdue ? styles.flowNeg : undefined} muted={!overdue}>
                          {overdue
                            ? t('bills.overdueOn', { date: formatDate(b.next_due_date) })
                            : t('bills.dueOn', { date: formatDate(b.next_due_date) })}
                        </Text>
                      </View>
                      <Text variant="moneyMin">{formatAmount(b.amount_minor, b.currency_code)}</Text>
                    </Pressable>
                  );
                })
              )}
            </Card>
          </BentoRow>
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  padded: { padding: spacing.lg, gap: spacing.md },
  homeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  homeHeaderLeft: { flex: 1, gap: spacing.sm },
  greeting: { fontSize: 22 },
  householdPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  scope: { gap: spacing.xs },
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
  accountRowSelected: { backgroundColor: c.brandMuted },
  accountMain: { flex: 1, gap: 2 },
  accountAmounts: { alignItems: 'flex-end', gap: 2 },
  accountConverted: { color: c.textSecondary },
  accountNoRate: { color: c.tertiary },
  acctTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  byAcctHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  byAcctHeadText: { flex: 1, gap: 2 },
  byAcctManage: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.field,
  },
  rowPressed: { opacity: 0.6 },
  hero: {
    flex: 1,
    backgroundColor: c.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    boxShadow: elevation.raised,
  },
  heroLabel: { color: c.white, opacity: 0.85 },
  heroAmount: { color: c.white, fontSize: 36 },
  heroHint: { color: c.white, opacity: 0.9 },
  heroTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  heroFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.white },
  heroFillOver: { backgroundColor: c.accent },
  heroOver: { color: c.accent },
  heroBalance: { color: c.white, opacity: 0.85, marginTop: spacing.xs },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heroRowLabel: { color: c.white, opacity: 0.9, flex: 1 },
  heroRowValue: { color: c.white },
  heroRule: { height: 1, backgroundColor: c.white, opacity: 0.2, marginVertical: spacing.xs },
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
  upsellText: { color: c.white, opacity: 0.95, flex: 1 },
  premiumPill: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  premiumText: { color: c.accent },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    // Inset tile inside the actions card: tone, not a rule.
    backgroundColor: c.field,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.brandMuted,
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
  recentAll: { color: c.brand },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMid: { flex: 1, gap: 2 },
  recentIn: { color: c.success },
  // This month + Coming up cards (Phase B).
  summaryTile: { flex: 1, gap: spacing.sm },
  flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flowNet: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  flowIn: { color: c.success },
  flowNeg: { color: c.danger },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  linkText: { color: c.brand },
  emptyLine: { paddingVertical: spacing.sm },
  comingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  comingMain: { flex: 1, gap: 2 },
});
