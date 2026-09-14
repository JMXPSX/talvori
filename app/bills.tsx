/**
 * Bills & recurring payments (§6.10). Lists the household's recurring money
 * movements (soonest due first, overdue flagged), with pause/resume, a guarded
 * delete, and "Mark paid" — which records a real transaction on the bill's
 * account and advances the due date. An add/edit form sits beside the list.
 *
 * Wide layout (Talvori desktop): a row of four stat tiles (due this month /
 * overdue / expected in / active·paused, all computed from the loaded bills) over
 * a two-column row — the filtered bill list beside the add/edit form. The same
 * JSX stacks to one column on mobile via BentoRow.
 */

import { Feather } from '@expo/vector-icons';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  BentoPage,
  BentoRow,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Segmented,
  Select,
  Text,
  TextField,
  useActionSheet,
  useToast,
} from '@/components/ui';
import { CustomDateInput } from '@/components/ui/CustomDateInput';
import {
  createBill,
  deleteBill,
  listBills,
  markBillPaid,
  setBillActive,
  updateBill,
} from '@/features/bills/api';
import { isOverdue } from '@/features/bills/recurrence';
import { billFormSchema } from '@/features/bills/schemas';
import { listAccounts, listCategories } from '@/features/finance/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, BillFrequency, BillRow, CategoryRow, FlowDirection } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount, formatDate } from '@/lib/format';
import { money, toMajorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

const NO_CATEGORY = '__none__';
type BillFilter = 'all' | 'overdue' | 'paused';

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** First/last calendar day of `today`'s month, as `yyyy-mm-dd` strings. */
function monthBounds(today: string): { start: string; end: string } {
  const [ys, ms] = today.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start: first, end: last };
}

export default function BillsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();
  const sheet = useActionSheet();
  const toast = useToast();
  const currency = active?.reporting_currency_code ?? 'USD';
  const today = todayISO();

  const [bills, setBills] = useState<BillRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillFilter>('all');

  // Form state (editingId null = create mode).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<FlowDirection>('out');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [dueDate, setDueDate] = useState(today);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [b, accs, cats] = await Promise.all([
        listBills(active.id),
        listAccounts(active.id),
        listCategories(active.id),
      ]);
      setBills(b);
      setAccounts(accs);
      setCategories(cats);
      if (!accountId && accs[0]) setAccountId(accs[0].id);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, accountId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function resetForm() {
    setEditingId(null);
    setName('');
    setDirection('out');
    setAmount('');
    setFrequency('monthly');
    setDueDate(today);
    setAccountId(accounts[0]?.id ?? '');
    setCategoryId(NO_CATEGORY);
    setNotes('');
    setFieldErrors({});
    setFormError(null);
  }

  function onEdit(bill: BillRow) {
    setEditingId(bill.id);
    setName(bill.name);
    setDirection(bill.direction);
    setAmount(String(toMajorUnits(money(bill.amount_minor, bill.currency_code))));
    setFrequency(bill.frequency);
    setDueDate(bill.next_due_date);
    setAccountId(bill.account_id);
    setCategoryId(bill.category_id ?? NO_CATEGORY);
    setNotes(bill.notes ?? '');
    setFieldErrors({});
    setFormError(null);
  }

  function accountName(id: string): string {
    return accounts.find((a) => a.id === id)?.name ?? '';
  }
  function categoryName(id: string | null): string | null {
    if (!id) return null;
    return categories.find((c) => c.id === id)?.name ?? null;
  }

  async function onSubmit() {
    if (!active) return;
    setFormError(null);
    const result = validate(billFormSchema, {
      name,
      direction,
      amountMajor: amount === '' ? 0 : amount,
      frequency,
      nextDueDate: dueDate,
      accountId: accountId || undefined,
      categoryId: categoryId === NO_CATEGORY ? undefined : categoryId,
      notes: notes.trim() || undefined,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    const ccy = accounts.find((a) => a.id === result.data.accountId)?.currency_code ?? currency;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateBill(editingId, result.data, ccy);
      } else {
        await createBill(active.id, result.data, ccy);
      }
      resetForm();
      await load();
      toast.show(t('bills.saved'));
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  function onMarkPaid(bill: BillRow) {
    sheet.show({
      title: t('bills.markPaidTitle', { name: bill.name }),
      message: t('bills.markPaidBody', {
        amount: formatAmount(bill.amount_minor, bill.currency_code),
        account: accountName(bill.account_id),
      }),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('bills.markPaid'),
          onPress: () => {
            void (async () => {
              try {
                await markBillPaid(bill);
                await load();
                toast.show(t('bills.paidToast'));
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  function onToggleActive(bill: BillRow) {
    void (async () => {
      try {
        await setBillActive(bill.id, !bill.is_active);
        await load();
      } catch (err) {
        setErrorKey(toAppError(err).messageKey);
      }
    })();
  }

  function onDelete(bill: BillRow) {
    sheet.show({
      title: t('bills.confirmDeleteTitle'),
      message: t('bills.confirmDeleteBody', { name: bill.name }),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteBill(bill.id);
                if (editingId === bill.id) resetForm();
                await load();
                toast.show(t('bills.deleted'));
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  // ── Stat tiles — computed from the loaded bills. Each bill's currency follows
  // its account, so we never mix currencies: the money totals sum only bills in
  // the reporting currency (the common case) and count the rest separately.
  const { start: monthStart, end: monthEnd } = monthBounds(today);
  const activeBills = bills.filter((b) => b.is_active);
  const pausedBills = bills.filter((b) => !b.is_active);
  const overdueBills = activeBills.filter((b) => isOverdue(b.next_due_date, today));
  const inReporting = (b: BillRow) => b.currency_code.toUpperCase() === currency.toUpperCase();
  const dueThisMonth = (b: BillRow) => b.next_due_date >= monthStart && b.next_due_date <= monthEnd;

  const dueMonthMinor = activeBills
    .filter((b) => b.direction === 'out' && dueThisMonth(b) && inReporting(b))
    .reduce((sum, b) => sum + b.amount_minor, 0);
  const overdueMinor = overdueBills
    .filter((b) => b.direction === 'out' && inReporting(b))
    .reduce((sum, b) => sum + b.amount_minor, 0);
  const expectedInMinor = activeBills
    .filter((b) => b.direction === 'in' && dueThisMonth(b) && inReporting(b))
    .reduce((sum, b) => sum + b.amount_minor, 0);

  const stats: { key: string; label: string; value: string; tone?: 'danger' | 'positive' }[] = [
    { key: 'due', label: t('bills.stats.dueThisMonth'), value: formatAmount(dueMonthMinor, currency) },
    {
      key: 'overdue',
      label: t('bills.stats.overdue'),
      value: formatAmount(overdueMinor, currency),
      tone: 'danger',
    },
    {
      key: 'expected',
      label: t('bills.stats.expectedIn'),
      value: `+${formatAmount(expectedInMinor, currency)}`,
      tone: 'positive',
    },
    {
      key: 'counts',
      label: t('bills.stats.activePaused'),
      value: `${activeBills.length} · ${pausedBills.length}`,
    },
  ];

  // Filtered list. Underlying `bills` is already soonest-due-first from the api;
  // "All" pushes paused rows to the end so active/overdue lead.
  const filtered =
    filter === 'overdue'
      ? overdueBills
      : filter === 'paused'
        ? pausedBills
        : [...activeBills, ...pausedBills];

  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency_code}` }));
  const categoryOptions = [
    { value: NO_CATEGORY, label: t('bills.categoryNone') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('bills.title') }} />
      <ScrollView>
        <BentoPage>
          {errorKey ? (
            <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
          ) : null}

          {/* Row 1 — four stat tiles */}
          <BentoRow>
            {stats.map((s) => (
              <View key={s.key} style={styles.statTile}>
                <Text variant="caption" style={styles.statLabel}>{s.label}</Text>
                <Text
                  variant="moneyMin"
                  style={[
                    styles.statValue,
                    s.tone === 'danger' ? styles.statDanger : null,
                    s.tone === 'positive' ? styles.statPositive : null,
                  ]}
                >
                  {s.value}
                </Text>
              </View>
            ))}
          </BentoRow>

          {/* Row 2 — bill list beside the add/edit form */}
          <BentoRow style={styles.mainRow}>
            <Card style={styles.listSlot}>
              <View style={styles.listHeader}>
                <View style={styles.listHeadText}>
                  <Text variant="heading">{t('bills.allBills')}</Text>
                  <Text variant="caption" muted>{t('bills.listCaption')}</Text>
                </View>
                <Segmented
                  style={styles.filter}
                  options={[
                    { value: 'all', label: t('bills.filter.all') },
                    { value: 'overdue', label: t('bills.filter.overdue') },
                    { value: 'paused', label: t('bills.filter.paused') },
                  ]}
                  value={filter}
                  onChange={(v) => setFilter(v as BillFilter)}
                />
              </View>

              {loading ? (
                <ActivityIndicator color={palette.brand} />
              ) : filtered.length === 0 ? (
                <EmptyState icon="file-text" message={t('bills.empty')} />
              ) : (
                <View style={styles.list}>
                  {filtered.map((bill) => {
                    const overdue = bill.is_active && isOverdue(bill.next_due_date, today);
                    const cat = categoryName(bill.category_id);
                    return (
                      <View
                        key={bill.id}
                        style={StyleSheet.flatten([styles.billRow, !bill.is_active ? styles.billPaused : null])}
                      >
                        <View
                          style={[styles.billIcon, overdue ? styles.billIconOverdue : null]}
                        >
                          <Feather
                            name={bill.direction === 'in' ? 'arrow-down-left' : 'file-text'}
                            size={17}
                            color={overdue ? palette.danger : palette.primary}
                          />
                        </View>
                        <View style={styles.billMain}>
                          <Text variant="button" numberOfLines={1}>{bill.name}</Text>
                          <Text variant="caption" muted numberOfLines={1}>
                            {t(`bills.freq.${bill.frequency}`)} · {accountName(bill.account_id)}
                            {cat ? ` · ${cat}` : ''}
                          </Text>
                        </View>
                        <View style={styles.billAmountCol}>
                          <Text variant="moneyMin" style={bill.direction === 'in' ? styles.amountIn : undefined}>
                            {bill.direction === 'in' ? '+' : '−'}{formatAmount(bill.amount_minor, bill.currency_code)}
                          </Text>
                          <Text variant="caption" style={overdue ? styles.overdue : styles.dueMuted}>
                            {bill.is_active
                              ? overdue
                                ? t('bills.overdueOn', { date: formatDate(bill.next_due_date) })
                                : t('bills.dueOn', { date: formatDate(bill.next_due_date) })
                              : t('bills.paused')}
                          </Text>
                        </View>
                        <View style={styles.billActions}>
                          {bill.is_active ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t('bills.markPaid')}
                              onPress={() => onMarkPaid(bill)}
                              style={({ pressed }) => [styles.paidBtn, pressed ? styles.pressed : null]}
                            >
                              <Text variant="button" style={styles.paidBtnText}>{t('bills.markPaid')}</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={bill.is_active ? t('bills.pause') : t('bills.resume')}
                            hitSlop={8}
                            onPress={() => onToggleActive(bill)}
                            style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}
                          >
                            <Feather name={bill.is_active ? 'pause' : 'play'} size={15} color={palette.textSecondary} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('bills.edit')}
                            hitSlop={8}
                            onPress={() => onEdit(bill)}
                            style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}
                          >
                            <Feather name="edit-2" size={15} color={palette.textSecondary} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('finance.delete')}
                            hitSlop={8}
                            onPress={() => onDelete(bill)}
                            style={({ pressed }) => [styles.iconBtnDanger, pressed ? styles.pressed : null]}
                          >
                            <Feather name="trash-2" size={15} color={palette.danger} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* Add / edit form */}
            <Card style={styles.formSlot}>
              <View style={styles.formHead}>
                <Text variant="heading">{editingId ? t('bills.edit') : t('bills.add')}</Text>
                <Text variant="caption" muted>{t('bills.formCaption')}</Text>
              </View>

              {accounts.length === 0 ? (
                <Text muted>{t('bills.needAccount')}</Text>
              ) : (
                <View style={styles.form}>
                  <TextField
                    label={t('bills.nameLabel')}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    error={fieldErrors.name ? t('errors.validation') : undefined}
                  />

                  <Text variant="caption" muted>{t('bills.directionLabel')}</Text>
                  <Segmented
                    options={[
                      { value: 'out', label: t('finance.expense') },
                      { value: 'in', label: t('finance.income') },
                    ]}
                    value={direction}
                    onChange={(v) => setDirection(v as FlowDirection)}
                  />

                  <TextField
                    label={t('bills.amountLabel')}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    error={fieldErrors.amountMajor ? t('errors.validation') : undefined}
                  />

                  <Text variant="caption" muted>{t('bills.frequencyLabel')}</Text>
                  <Segmented
                    options={[
                      { value: 'weekly', label: t('bills.freq.weekly') },
                      { value: 'monthly', label: t('bills.freq.monthly') },
                      { value: 'yearly', label: t('bills.freq.yearly') },
                    ]}
                    value={frequency}
                    onChange={(v) => setFrequency(v as BillFrequency)}
                  />

                  <Text variant="caption" muted>{t('bills.dueLabel')}</Text>
                  <CustomDateInput value={dueDate} onChange={setDueDate} maxToday={false} />

                  <Text variant="caption" muted>{t('bills.accountLabel')}</Text>
                  <Select
                    accessibilityLabel={t('bills.accountLabel')}
                    options={accountOptions}
                    value={accountId}
                    onChange={setAccountId}
                  />

                  <Text variant="caption" muted>{t('bills.categoryLabel')}</Text>
                  <Select
                    accessibilityLabel={t('bills.categoryLabel')}
                    options={categoryOptions}
                    value={categoryId}
                    onChange={setCategoryId}
                  />

                  <TextField label={t('bills.notesLabel')} value={notes} onChangeText={setNotes} />

                  {formError ? (
                    <Text variant="caption" style={{ color: palette.danger }}>{t(formError)}</Text>
                  ) : null}

                  <View style={styles.formActions}>
                    <Button
                      label={submitting ? t('auth.processing') : t('bills.saveCta')}
                      onPress={onSubmit}
                      loading={submitting}
                      style={styles.saveBtn}
                    />
                    {editingId ? (
                      <Button label={t('common.cancel')} variant="secondary" onPress={resetForm} />
                    ) : null}
                  </View>
                </View>
              )}
            </Card>
          </BentoRow>
        </BentoPage>
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  // Stat tiles.
  statTile: {
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    gap: spacing.xs,
    boxShadow: elevation.tile,
  },
  statLabel: { color: c.textSecondary },
  statValue: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statDanger: { color: c.danger },
  statPositive: { color: c.positiveStrong },
  // Main row.
  mainRow: { alignItems: 'stretch' },
  listSlot: { flex: 1.5, minWidth: 0, gap: spacing.md },
  formSlot: { flex: 1, minWidth: 0, gap: spacing.md },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  listHeadText: { flex: 1, minWidth: 0, gap: 2 },
  filter: { flexShrink: 0 },
  list: { gap: spacing.xs },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  billPaused: { opacity: 0.6 },
  billIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billIconOverdue: { backgroundColor: c.dangerTint },
  billMain: { flex: 1, minWidth: 0, gap: 2 },
  billAmountCol: { alignItems: 'flex-end', gap: 2 },
  amountIn: { color: c.positiveStrong },
  overdue: { color: c.danger },
  dueMuted: { color: c.textTertiary },
  billActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  paidBtn: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidBtnText: { color: c.primary },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: c.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  // Form.
  formHead: { gap: 2 },
  form: { gap: spacing.sm },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  saveBtn: { flex: 1 },
});
