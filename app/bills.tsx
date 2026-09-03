/**
 * Bills & recurring payments (§6.10). Lists the household's recurring money
 * movements (soonest due first, overdue flagged), with pause/resume, a guarded
 * delete, and "Mark paid" — which records a real transaction on the bill's
 * account and advances the due date. An add/edit form sits below the list.
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
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  FORM_MAX_WIDTH,
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

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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

  const activeBills = bills.filter((b) => b.is_active);
  const overdueCount = activeBills.filter((b) => isOverdue(b.next_due_date, today)).length;

  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency_code}` }));
  const categoryOptions = [
    { value: NO_CATEGORY, label: t('bills.categoryNone') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('bills.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="title">{t('bills.title')}</Text>
          <Text muted>{t('bills.sub')}</Text>
        </View>

        <View style={styles.hero}>
          <Text variant="eyebrow" style={styles.heroLabel}>{t('bills.title')}</Text>
          <Text variant="title" style={styles.heroAmount}>
            {t('bills.activeCount', { n: activeBills.length })}
          </Text>
          <Text variant="caption" style={styles.heroSub}>
            {t('bills.overdueCount', { n: overdueCount })}
          </Text>
        </View>

        {errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : bills.length === 0 ? (
          <EmptyState icon="file-text" message={t('bills.empty')} />
        ) : (
          <View style={styles.list}>
            {bills.map((bill) => {
              const overdue = bill.is_active && isOverdue(bill.next_due_date, today);
              const cat = categoryName(bill.category_id);
              return (
                <Card
                  key={bill.id}
                  style={StyleSheet.flatten([styles.billCard, !bill.is_active ? styles.billPaused : null])}
                >
                  <View style={styles.billTop}>
                    <View style={styles.billMain}>
                      <Text variant="button" numberOfLines={1}>{bill.name}</Text>
                      <Text variant="caption" muted numberOfLines={1}>
                        {t(`bills.freq.${bill.frequency}`)} · {accountName(bill.account_id)}
                        {cat ? ` · ${cat}` : ''}
                      </Text>
                    </View>
                    <View style={styles.billAmountCol}>
                      <Text variant="button" style={bill.direction === 'in' ? styles.amountIn : undefined}>
                        {bill.direction === 'in' ? '+' : '−'}{formatAmount(bill.amount_minor, bill.currency_code)}
                      </Text>
                      <Text
                        variant="caption"
                        style={overdue ? styles.overdue : styles.dueMuted}
                      >
                        {bill.is_active
                          ? overdue
                            ? t('bills.overdueOn', { date: formatDate(bill.next_due_date) })
                            : t('bills.dueOn', { date: formatDate(bill.next_due_date) })
                          : t('bills.paused')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.billActions}>
                    {bill.is_active ? (
                      <Button
                        label={t('bills.markPaid')}
                        variant="accent"
                        style={styles.smallBtn}
                        onPress={() => onMarkPaid(bill)}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={bill.is_active ? t('bills.pause') : t('bills.resume')}
                      hitSlop={10}
                      onPress={() => onToggleActive(bill)}
                      style={styles.iconBtn}
                    >
                      <Feather name={bill.is_active ? 'pause' : 'play'} size={16} color={palette.textMuted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('bills.edit')}
                      hitSlop={10}
                      onPress={() => onEdit(bill)}
                      style={styles.iconBtn}
                    >
                      <Feather name="edit-2" size={16} color={palette.textMuted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('finance.delete')}
                      hitSlop={10}
                      onPress={() => onDelete(bill)}
                      style={styles.iconBtn}
                    >
                      <Feather name="trash-2" size={16} color={palette.textMuted} />
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Add / edit form */}
        <View style={styles.divider} />
        <Text variant="heading">{editingId ? t('bills.edit') : t('bills.add')}</Text>

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
              keyboardType="numeric"
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
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  hero: {
    backgroundColor: c.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    boxShadow: elevation.raised,
  },
  heroLabel: { color: c.white, opacity: 0.85 },
  heroAmount: { color: c.white, fontSize: 30 },
  heroSub: { color: c.white, opacity: 0.9 },
  list: { gap: spacing.sm },
  billCard: { gap: spacing.sm },
  billPaused: { opacity: 0.6 },
  billTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  billMain: { flex: 1, gap: 2 },
  billAmountCol: { alignItems: 'flex-end', gap: 2 },
  amountIn: { color: c.success },
  overdue: { color: c.danger },
  dueMuted: { color: c.textMuted },
  billActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  smallBtn: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, marginEnd: 'auto' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: c.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  saveBtn: { flex: 1 },
});
