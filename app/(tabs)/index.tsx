/**
 * Home dashboard — Modernist redesign. A solid black consolidated-balance block
 * leads; below it, 2px-ruled sections for accounts (native + reporting + share
 * bar), spending-by-category bars, and quick actions. All money is integer minor
 * units formatted per locale; copy is localized; FX conversion is premium-gated.
 */

import { Feather } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { BentoPage, BentoRow, Card, EmptyState, ErrorNotice, Text } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listAccountBalances, listAccounts, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { categoryBreakdown } from '@/features/finance/donut';
import { sumInReporting } from '@/features/finance/fx';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import type { AccountBalanceRow, AccountRow, LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

type FeatherName = keyof typeof Feather.glyphMap;

/** A flat ink share/meter bar on a neutral track (Modernist — square, no radius).
 *  Built with flex fractions so it stays RTL-safe (grows from the start edge). */
function ShareBar({ fraction }: { fraction: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.shareTrack}>
      <View style={{ flex: f, backgroundColor: palette.text }} />
      <View style={{ flex: 1 - f }} />
    </View>
  );
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
  const premium = has('multi_currency_dashboard');
  const rateLookup = makeRateLookup(rates);
  const reportingOf = (balanceMinor: number, currency: string) =>
    sumInReporting([{ balanceMinor, currency }], reporting, rateLookup).totalMinor;

  const items = accounts.map((a) => ({
    balanceMinor: balances[a.id]?.balance_minor ?? a.opening_balance_minor,
    currency: a.currency_code,
  }));
  const consolidated = premium ? sumInReporting(items, reporting, rateLookup) : null;
  const totalMinor = consolidated?.totalMinor ?? 0;

  const breakdown = categoryBreakdown(txns, reporting, rateLookup, t('finance.categories.none'));
  const spendTotal = breakdown.slices.reduce((sum, s) => sum + s.amountMinor, 0);
  const maxSlice = breakdown.slices.reduce((m, s) => Math.max(m, s.amountMinor), 0);

  const actions: { icon: FeatherName; label: string; href: string; primary?: boolean }[] = [
    { icon: 'plus', label: t('finance.addExpense'), href: '/finance/entry?type=expense', primary: true },
    { icon: 'arrow-down-left', label: t('finance.addIncome'), href: '/finance/entry?type=income' },
    { icon: 'repeat', label: t('finance.addTransfer'), href: '/finance/transfer' },
    { icon: 'credit-card', label: t('finance.manageAccounts'), href: '/finance/accounts' },
    { icon: 'trending-up', label: t('fx.manageRates'), href: '/finance/rates' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
          <Text variant="eyebrow" muted>{active.name}</Text>

          <BentoRow>
            {/* left column — balance hero, accounts, spending */}
            <View style={styles.mainCol}>
              {/* consolidated balance — the black block */}
              {premium ? (
                <View style={styles.hero}>
                  <View style={styles.heroTopRow}>
                    <Text variant="eyebrow" style={styles.heroEyebrow}>
                      {t('fx.reportingTotal', { currency: reporting })}
                    </Text>
                    <Text variant="caption" style={styles.heroEyebrow}>
                      {t('finance.accounts.title')}
                    </Text>
                  </View>
                  <View style={styles.heroAmountSlot}>
                    {loading ? (
                      <ActivityIndicator color={palette.white} />
                    ) : (
                      <Text variant="title" tabular style={styles.heroAmount}>
                        {formatAmount(totalMinor, reporting)}
                      </Text>
                    )}
                  </View>
                  {!loading && consolidated && consolidated.missing.length > 0 ? (
                    <Link href="/finance/rates">
                      <Text variant="caption" style={styles.heroHint}>
                        {t('fx.missingRates', { currencies: consolidated.missing.join(', ') })}
                      </Text>
                    </Link>
                  ) : null}
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.hero, pressed ? styles.heroPressed : null]}
                  onPress={() => router.push('/subscription')}
                >
                  <Text variant="eyebrow" style={styles.heroEyebrow}>{t('billing.capMultiCurrency')}</Text>
                  <Text variant="heading" style={styles.heroLocked}>{t('billing.lockedTitle')}</Text>
                  <Text variant="caption" style={styles.heroHint}>{t('billing.manageCta')}</Text>
                </Pressable>
              )}

              {/* accounts */}
              <Card>
                <View style={styles.cardHead}>
                  <Text variant="heading">{t('finance.accounts.title')}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/finance/accounts')}>
                    <Text variant="caption" style={styles.link}>{t('finance.manageAccounts')}</Text>
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
                  <View>
                    {accounts.map((a, i) => {
                      const nativeMinor = balances[a.id]?.balance_minor ?? a.opening_balance_minor;
                      const inReporting = premium ? reportingOf(nativeMinor, a.currency_code) : 0;
                      const share = premium && totalMinor > 0 ? inReporting / totalMinor : 0;
                      return (
                        <Pressable
                          key={a.id}
                          accessibilityRole="button"
                          onPress={() => router.push('/finance/accounts')}
                          style={({ pressed }) => [
                            styles.acctRow,
                            i < accounts.length - 1 ? styles.rowDivider : null,
                            pressed ? styles.rowPressed : null,
                          ]}
                        >
                          <View style={styles.acctMain}>
                            <Text variant="button" numberOfLines={1}>{a.name}</Text>
                            <Text variant="caption" muted>
                              {t(`finance.accounts.types.${a.type}`)} · {a.currency_code}
                            </Text>
                          </View>
                          <View style={styles.acctFig}>
                            <Text variant="button" tabular>{formatAmount(nativeMinor, a.currency_code)}</Text>
                            {premium ? (
                              <Text variant="caption" muted tabular>{formatAmount(inReporting, reporting)}</Text>
                            ) : null}
                          </View>
                          {premium ? (
                            <View style={styles.acctShare}>
                              <ShareBar fraction={share} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Card>

              {/* spending by category */}
              {breakdown.slices.length > 0 ? (
                <Card>
                  <View style={styles.cardHead}>
                    <Text variant="heading">{t('finance.spendingByCategory')}</Text>
                    <Text variant="caption" muted tabular>{formatAmount(spendTotal, reporting)}</Text>
                  </View>
                  <View style={styles.bars}>
                    {breakdown.slices.slice(0, 6).map((s) => (
                      <View key={s.label}>
                        <View style={styles.barLabelRow}>
                          <Text variant="caption" style={styles.barLabel} numberOfLines={1}>{s.label}</Text>
                          <Text variant="caption" tabular>{formatAmount(s.amountMinor, reporting)}</Text>
                        </View>
                        <ShareBar fraction={maxSlice > 0 ? s.amountMinor / maxSlice : 0} />
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}
            </View>

            {/* right column — quick actions */}
            <View style={styles.sideCol}>
              <Card>
                <Text variant="heading">{t('screens.homeTitle')}</Text>
                <View style={styles.actions}>
                  {actions.map((a) => (
                    <Pressable
                      key={a.href}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                      onPress={() => router.push(a.href as never)}
                      style={({ pressed }) => [
                        styles.action,
                        a.primary ? styles.actionPrimary : null,
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      <Feather
                        name={a.icon}
                        size={18}
                        color={a.primary ? palette.white : palette.text}
                      />
                      <Text
                        variant="button"
                        style={a.primary ? styles.actionLabelPrimary : undefined}
                      >
                        {a.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            </View>
          </BentoRow>
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  padded: { padding: spacing.lg, gap: spacing.md },

  // Flex weights: hero+accounts+spending take two thirds beside quick actions on
  // wide viewports; BentoRow collapses both to full width on narrow.
  mainCol: { flex: 2, gap: spacing.md },
  sideCol: { flex: 1, gap: spacing.md },

  // — balance hero: the solid black block —
  hero: {
    backgroundColor: palette.text,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroPressed: { opacity: 0.9 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { color: palette.white, opacity: 0.65 },
  heroAmountSlot: { minHeight: 52, justifyContent: 'center' },
  heroAmount: { color: palette.white, fontSize: 44, lineHeight: 48 },
  heroLocked: { color: palette.white, marginTop: spacing.xs },
  heroHint: { color: palette.white, opacity: 0.8 },

  // — section heads —
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  link: { color: palette.brand },

  // — account rows —
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  rowPressed: { opacity: 0.6 },
  acctMain: { flex: 1, gap: 2, minWidth: 0 },
  acctFig: { alignItems: 'flex-end', gap: 2 },
  acctShare: { width: 72 },

  // — flat share / meter bars —
  shareTrack: { flexDirection: 'row', height: 8, backgroundColor: palette.surfaceMuted, overflow: 'hidden' },

  // — spending bars —
  bars: { gap: spacing.md },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { flex: 1, marginEnd: spacing.sm },

  // — quick actions —
  actions: { gap: spacing.sm },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  actionPrimary: { backgroundColor: palette.brand, borderColor: palette.brand },
  actionLabelPrimary: { color: palette.white },
});
