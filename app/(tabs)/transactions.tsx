/** Transactions tab: recent activity grouped by day. Creation lives behind the
 *  header "+" (income / expense / transfer); deletes are confirm-guarded. */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { BentoPage, Card, Chip, CONTENT_MAX_WIDTH, EmptyState, ErrorNotice, Text, useActionSheet } from '@/components/ui';
import { listAccounts, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { monthFlow } from '@/features/finance/flow';
import { listLatestRates, makeRateLookup } from '@/features/finance/fxApi';
import { monthKeyOf } from '@/features/finance/insights';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, LatestFxRateRow } from '@/lib/database.types';
import { useIsWideLayout } from '@/lib/breakpoints';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

/** Only plain income/expense are editable; transfers and the read-only goal/debt
 *  ledger mirrors (#6) are shown but not editable from Activity. */
function isEditable(type: TransactionWithRefs['type']): boolean {
  return type === 'income' || type === 'expense';
}

/** Category pill tint by transaction type (2b table). */
function catTint(c: Palette, type: TransactionWithRefs['type']): { bg: string; fg: string } {
  if (type === 'income') return { bg: c.successMuted, fg: c.success };
  if (type === 'transfer' || type === 'debt_payment') return { bg: c.accentMuted, fg: c.accent };
  return { bg: c.brandMuted, fg: c.brand };
}

type DayGroup = { key: string; label: string; items: TransactionWithRefs[] };

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(
  items: TransactionWithRefs[],
  language: string,
  t: (key: string) => string,
): DayGroup[] {
  const todayKey = localDayKey(new Date().toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDayKey(yesterday.toISOString());
  const fmt = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' });

  const groups: DayGroup[] = [];
  for (const tx of items) {
    const key = localDayKey(tx.occurred_at);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label =
        key === todayKey
          ? t('common.today')
          : key === yesterdayKey
            ? t('common.yesterday')
            : fmt.format(new Date(tx.occurred_at));
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(tx);
  }
  return groups;
}

function typeIcon(c: Palette, type: TransactionWithRefs['type']): {
  name: keyof typeof Feather.glyphMap;
  color: string;
  bg: string;
} {
  // §6.6 row-icon tints (bg / glyph).
  if (type === 'income') return { name: 'arrow-down-left', color: c.positiveStrong, bg: c.positiveTint };
  if (type === 'transfer') return { name: 'repeat', color: c.infoStrong, bg: c.infoTint };
  if (type === 'goal_contribution') return { name: 'target', color: c.ink, bg: c.warn };
  if (type === 'debt_payment') return { name: 'file-text', color: c.ink, bg: c.divider };
  return { name: 'shopping-cart', color: c.primary, bg: c.primaryTint };
}

export default function TransactionsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();
  const isWide = useIsWideLayout();
  const sheet = useActionSheet();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const shortDate = (iso: string): string =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(new Date(iso));

  const [items, setItems] = useState<TransactionWithRefs[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [tx, fx, accs] = await Promise.all([
        listTransactions(active.id),
        listLatestRates(active.id),
        listAccounts(active.id),
      ]);
      setItems(tx);
      setRates(fx);
      setAccounts(accs);
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

  function onAdd() {
    sheet.show({
      title: t('finance.newTransaction'),
      cancelLabel: t('common.cancel'),
      actions: [
        { label: t('finance.addIncome'), onPress: () => router.push('/finance/entry?type=income') },
        { label: t('finance.addExpense'), onPress: () => router.push('/finance/entry?type=expense') },
        { label: t('finance.addTransfer'), onPress: () => router.push('/finance/transfer') },
      ],
    });
  }

  function typeLabel(type: TransactionWithRefs['type']): string {
    if (type === 'income') return t('finance.categories.income');
    if (type === 'transfer') return t('finance.transfer.title');
    if (type === 'goal_contribution') return t('finance.ledger.goalContribution');
    if (type === 'debt_payment') return t('finance.ledger.debtPayment');
    return t('finance.categories.expense');
  }

  if (hLoading || loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <Text variant="title">{t('screens.transactionsTitle')}</Text>
          <Text muted>{t('finance.noHousehold')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Account filter (same scope model as Home): null → all accounts.
  const scope =
    selectedAccountId && accounts.some((a) => a.id === selectedAccountId) ? selectedAccountId : null;
  const visible = scope ? items.filter((tx) => tx.account_id === scope) : items;
  const scopedName = accounts.find((a) => a.id === scope)?.name ?? '';
  const groups = groupByDay(visible, i18n.language, t);
  // In / Out / Net for the month, consolidated into the reporting currency
  // (transfers excluded) — the prototype's Activity summary header. Scoped too.
  const reporting = active.reporting_currency_code;
  const flow = monthFlow(visible, monthKeyOf(new Date().toISOString()), reporting, makeRateLookup(rates));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
        <View style={styles.headerRow}>
          <Text variant="title">{t('screens.transactionsTitle')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('finance.newTransaction')}
            onPress={onAdd}
            style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
          >
            <Feather name="plus" size={22} color={palette.white} />
          </Pressable>
        </View>

        {accounts.length > 1 ? (
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
        ) : null}

        {visible.length > 0 ? (
          <Card style={styles.summary}>
            <View style={styles.summaryCol}>
              <Text variant="caption" muted>{t('finance.ledger.in')}</Text>
              <Text variant="moneyMin" style={styles.inAmt}>+{formatAmount(flow.inMinor, reporting)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text variant="caption" muted>{t('finance.ledger.out')}</Text>
              <Text variant="moneyMin">−{formatAmount(flow.outMinor, reporting)}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text variant="caption" muted>{t('finance.ledger.net')}</Text>
              <Text variant="moneyMin" style={flow.netMinor >= 0 ? styles.inAmt : styles.netNeg}>
                {flow.netMinor >= 0 ? '+' : '−'}{formatAmount(Math.abs(flow.netMinor), reporting)}
              </Text>
            </View>
          </Card>
        ) : null}
        {flow.missing.length > 0 ? (
          <Text variant="caption" muted style={styles.missingNote}>
            {t('fx.missingRates', { currencies: flow.missing.join(', ') })}
          </Text>
        ) : null}

        {errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon="list"
            message={t('finance.activity.empty')}
            ctaLabel={t('finance.addExpense')}
            onCta={() => router.push('/finance/entry?type=expense')}
          />
        ) : visible.length === 0 ? (
          <Text muted style={styles.scopeEmpty}>
            {t('finance.activity.noneForAccount', { account: scopedName })}
          </Text>
        ) : isWide ? (
          <Card style={styles.table}>
            <View style={[styles.trow, styles.thead]}>
              <Text variant="caption" muted style={[styles.th, styles.cDate]}>{t('finance.cols.date')}</Text>
              <Text variant="caption" muted style={[styles.th, styles.cDesc]}>{t('finance.cols.description')}</Text>
              <Text variant="caption" muted style={[styles.th, styles.cCat]}>{t('finance.cols.category')}</Text>
              <Text variant="caption" muted style={[styles.th, styles.cAcct]}>{t('finance.cols.account')}</Text>
              <Text variant="caption" muted style={[styles.th, styles.cAmt]}>{t('finance.cols.amount')}</Text>
              <View style={styles.cEdit} />
            </View>
            {visible.map((tx, index) => {
              const positive = tx.direction === 'in';
              const tint = catTint(palette, tx.type);
              // Money-model #8/#6: only income/expense rows are editable; transfers and the
              // goal/debt ledger mirrors are read-only (editing would desync a paired balance).
              const editable = isEditable(tx.type);
              return (
                <Pressable
                  key={tx.id}
                  accessibilityRole={editable ? 'button' : undefined}
                  accessibilityLabel={editable ? t('finance.edit.title') : undefined}
                  disabled={!editable}
                  onPress={editable ? () => router.push(`/finance/edit/${tx.id}`) : undefined}
                  style={(s) => {
                    const st = s as { pressed?: boolean; hovered?: boolean };
                    return [
                      styles.trow,
                      index > 0 ? styles.rowDivider : null,
                      editable && st.hovered ? styles.trowHover : null,
                      editable && st.pressed ? styles.pressed : null,
                    ];
                  }}
                >
                  <Text variant="caption" muted style={styles.cDate}>{shortDate(tx.occurred_at)}</Text>
                  <Text style={styles.cDesc} numberOfLines={1}>
                    {tx.description || typeLabel(tx.type)}
                  </Text>
                  <View style={styles.cCat}>
                    <View style={[styles.pill, { backgroundColor: tint.bg }]}>
                      <Text variant="caption" style={{ color: tint.fg }} numberOfLines={1}>
                        {tx.category?.name ?? typeLabel(tx.type)}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" muted style={styles.cAcct} numberOfLines={1}>
                    {tx.account?.name ?? ''}
                  </Text>
                  <Text variant="moneyMin" style={[styles.cAmt, positive ? styles.amountIn : null]}>
                    {positive ? '+' : '−'}
                    {formatAmount(tx.amount_minor, tx.currency_code)}
                  </Text>
                  <View style={styles.cEdit}>
                    {editable ? <Feather name="edit-2" size={16} color={palette.textMuted} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <View style={styles.groups}>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text variant="eyebrow" muted>
                  {group.label}
                </Text>
                <Card style={styles.groupCard}>
                  {group.items.map((tx, index) => {
                    const positive = tx.direction === 'in';
                    const icon = typeIcon(palette, tx.type);
                    const editable = isEditable(tx.type);
                    const caption = [tx.category?.name, tx.account?.name].filter(Boolean).join(' · ');
                    return (
                      <Pressable
                        key={tx.id}
                        accessibilityRole={editable ? 'button' : undefined}
                        accessibilityLabel={editable ? t('finance.edit.title') : undefined}
                        disabled={!editable}
                        onPress={editable ? () => router.push(`/finance/edit/${tx.id}`) : undefined}
                        style={({ pressed }) => [
                          styles.row,
                          index > 0 ? styles.rowDivider : null,
                          editable && pressed ? styles.pressed : null,
                        ]}
                      >
                        <View style={[styles.iconTile, { backgroundColor: icon.bg }]}>
                          <Feather name={icon.name} size={18} color={icon.color} />
                        </View>
                        <View style={styles.rowMid}>
                          <Text numberOfLines={1}>{tx.description || typeLabel(tx.type)}</Text>
                          {caption ? (
                            <Text variant="caption" muted numberOfLines={1}>
                              {caption}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          variant="moneyMin"
                          style={positive ? styles.amountIn : null}
                        >
                          {positive ? '+' : '−'}
                          {formatAmount(tx.amount_minor, tx.currency_code)}
                        </Text>
                        {editable ? (
                          <Feather
                            name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
                            size={20}
                            color={palette.textMuted}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            ))}
          </View>
        )}

        {/* §6.6 footer hint — how to fix a wrong entry. */}
        {visible.length > 0 ? (
          <Text variant="caption" muted style={styles.footerHint}>
            {t('finance.activity.footerHint')}
          </Text>
        ) : null}
        </BentoPage>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  scopePills: { gap: spacing.sm, paddingVertical: spacing.xs },
  scopeEmpty: { paddingVertical: spacing.lg, textAlign: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryCol: { flex: 1, gap: 2, alignItems: 'center' },
  inAmt: { color: c.positiveStrong },
  netNeg: { color: c.danger },
  missingNote: { marginTop: -spacing.xs },
  footerHint: { lineHeight: 16, marginTop: spacing.xs },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.9 },
  groups: { gap: spacing.md },
  group: { gap: spacing.sm },
  groupCard: { paddingVertical: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.border },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1, gap: 2 },
  amountIn: { color: c.success },
  // 2b desktop table
  table: { padding: 0, gap: 0 },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  thead: { paddingVertical: spacing.sm },
  th: { letterSpacing: 0.5 },
  trowHover: { backgroundColor: c.field },
  cDate: { width: 84 },
  cDesc: { flex: 1, minWidth: 0 },
  cCat: { width: 150 },
  cAcct: { width: 150 },
  cAmt: { width: 130, textAlign: 'right' },
  cEdit: { width: 24, alignItems: 'center' },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
