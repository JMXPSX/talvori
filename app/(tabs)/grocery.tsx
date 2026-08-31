/**
 * Shop — "Our Grocery List" (§6.8). One shared, evergreen list per household with
 * three modes:
 *   • List      — budget card, this-week estimate, Buy-again, add/edit items.
 *   • Shopping  — check items off, enter real prices, running total.
 *   • Complete  — store + actual total → ONE expense (list stays active).
 *
 * Money moves ONLY at Record purchase (§5.2 #7): it posts one expense via
 * completeList(…, complete=false), marks the trip's items purchased, and keeps
 * the list active so purchased items show under PURCHASED until Clear purchased.
 * Price comparison is intentionally absent for V1 (priceComparisonEnabled=false).
 */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  AmountCard,
  Avatar,
  BentoPage,
  Button,
  Card,
  Chip,
  DestructiveAction,
  ErrorNotice,
  InlineEditor,
  ProgressBar,
  Segmented,
  Select,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
import { meterState, pickCurrentBudget, spentFraction } from '@/features/finance/plan';
import { listBudgets, listBudgetStatus } from '@/features/finance/planningApi';
import {
  addItem,
  completeList,
  createList,
  deleteItem,
  listItems,
  listPriceHistory,
  listRecentStores,
  setPurchased,
  updateItem,
  type PriceHistoryEntry,
} from '@/features/grocery/api';
import { listMembers } from '@/features/household/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listLists } from '@/features/grocery/api';
import type { AccountRow, BudgetStatusRow, CategoryRow, GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { minorExponent, toMinorUnits } from '@/lib/money';

const UNITS = ['each', 'pack', 'lb', 'oz', 'kg', 'g', 'L', 'mL', 'gallon', 'dozen'] as const;
type Mode = 'list' | 'shopping' | 'complete';

/** Major-unit string for a minor amount (for prefilled numeric inputs). */
function majorStr(minor: number, currency: string): string {
  return (minor / 10 ** minorExponent(currency)).toFixed(minorExponent(currency));
}

export default function ShopScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [list, setList] = useState<GroceryListRow | null>(null);
  const [items, setItems] = useState<GroceryItemRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatusRow[]>([]);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [recentStores, setRecentStores] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('list');

  // Add-item form.
  const [addOpen, setAddOpen] = useState(false);
  const [nName, setNName] = useState('');
  const [nQty, setNQty] = useState('1');
  const [nUnit, setNUnit] = useState<string>('each');
  const [nMore, setNMore] = useState(false);
  const [nNote, setNNote] = useState('');
  const [nPrice, setNPrice] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Row edit.
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eQty, setEQty] = useState('1');
  const [eUnit, setEUnit] = useState('each');
  const [ePrice, setEPrice] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Trip.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tripPrices, setTripPrices] = useState<Record<string, string>>({});

  // Complete.
  const [store, setStore] = useState('');
  const [actual, setActual] = useState('');
  const [payFrom, setPayFrom] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [lists, accs, cats, budgets, hist, stores, members] = await Promise.all([
        listLists(active.id),
        listAccounts(active.id),
        listCategories(active.id, 'expense'),
        listBudgets(active.id),
        listPriceHistory(active.id),
        listRecentStores(active.id),
        listMembers(active.id),
      ]);
      const activeList = lists.find((l) => l.status === 'active') ?? null;
      setList(activeList);
      setItems(activeList ? await listItems(activeList.id) : []);
      setAccounts(accs);
      setCategories(cats);
      setHistory(hist);
      setRecentStores(stores);
      setNames(Object.fromEntries(members.map((m) => [m.user_id, m.profile?.display_name || m.profile?.email || ''])));
      const current = pickCurrentBudget(budgets, new Date().toISOString());
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

  const currency = list?.currency_code ?? active?.reporting_currency_code ?? 'USD';

  // Grocery budget: the expense category whose name looks grocery-ish + its status.
  const groceryCat = categories.find((c) => /groc|market/i.test(c.name)) ?? null;
  const gStatus = groceryCat ? budgetStatus.find((r) => r.category_id === groceryCat.id) ?? null : null;

  const historyByName = useMemo(() => {
    const m = new Map<string, PriceHistoryEntry>();
    for (const h of history) m.set(h.name.toLowerCase(), h);
    return m;
  }, [history]);

  /** Estimate (minor) for an item: its own price, else last-paid × qty, else null. */
  const estimateOf = useCallback(
    (it: GroceryItemRow): number | null => {
      if (it.estimated_price_minor != null) return it.estimated_price_minor;
      const h = historyByName.get(it.name.toLowerCase());
      return h ? Math.round(h.unit_price_minor * it.quantity) : null;
    },
    [historyByName],
  );

  const pending = items.filter((it) => !it.is_purchased);
  const purchased = items.filter((it) => it.is_purchased);
  const estimatedTotal = pending.reduce((s, it) => s + (estimateOf(it) ?? 0), 0);
  const budgetRemaining = gStatus ? gStatus.limit_minor - gStatus.spent_minor : null;
  const afterTrip = budgetRemaining != null ? budgetRemaining - estimatedTotal : null;

  const runningTotal = pending.reduce((s, it) => {
    if (!checked[it.id]) return s;
    const typed = tripPrices[it.id];
    const minor = typed ? toMinorUnits(Number(typed) || 0, currency) : (estimateOf(it) ?? 0);
    return s + minor;
  }, 0);

  // Buy-again: history names not already on the pending list.
  const onList = new Set(pending.map((it) => it.name.toLowerCase()));
  const buyAgain = history.filter((h) => !onList.has(h.name.toLowerCase())).slice(0, 6);

  async function ensureList(): Promise<GroceryListRow> {
    if (list) return list;
    const created = await createList(active!.id, { name: t('shop.title'), currencyCode: currency });
    setList(created);
    return created;
  }

  async function onAdd() {
    setAddError(null);
    if (!nName.trim()) return setAddError('shop.nameRequired');
    const qty = Number(nQty);
    if (!Number.isFinite(qty) || qty <= 0) return setAddError('shop.qtyPositive');
    const priceNum = nPrice.trim() ? Number(nPrice) : null;
    if (priceNum != null && (!Number.isFinite(priceNum) || priceNum < 0)) return setAddError('shop.pricePositive');
    try {
      const l = await ensureList();
      await addItem(l.id, {
        name: nName.trim(),
        quantity: qty,
        unit: nUnit,
        estimatedPriceMinor: priceNum != null ? toMinorUnits(priceNum, currency) : undefined,
      });
      setNName(''); setNQty('1'); setNUnit('each'); setNNote(''); setNPrice(''); setNMore(false); setAddOpen(false);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onBuyAgain(h: PriceHistoryEntry) {
    try {
      const l = await ensureList();
      await addItem(l.id, { name: h.name, quantity: 1, unit: 'each', estimatedPriceMinor: h.unit_price_minor });
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  function openEdit(it: GroceryItemRow) {
    setEditId(it.id);
    setEName(it.name);
    setEQty(String(it.quantity));
    setEUnit(it.unit ?? 'each');
    setEPrice(it.estimated_price_minor != null ? majorStr(it.estimated_price_minor, currency) : '');
    setEditError(null);
  }

  async function onSaveEdit() {
    if (!editId) return;
    setEditError(null);
    if (!eName.trim()) return setEditError('shop.nameRequired');
    const qty = Number(eQty);
    if (!Number.isFinite(qty) || qty <= 0) return setEditError('shop.qtyPositive');
    const priceNum = ePrice.trim() ? Number(ePrice) : null;
    if (priceNum != null && (!Number.isFinite(priceNum) || priceNum < 0)) return setEditError('shop.pricePositive');
    try {
      await updateItem(editId, {
        name: eName.trim(),
        quantity: qty,
        unit: eUnit,
        estimatedPriceMinor: priceNum != null ? toMinorUnits(priceNum, currency) : null,
      });
      setEditId(null);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onRemove(id: string) {
    try {
      await deleteItem(id);
      setEditId(null);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onUseAsEstimate(it: GroceryItemRow) {
    const h = historyByName.get(it.name.toLowerCase());
    if (!h) return;
    try {
      await updateItem(it.id, { estimatedPriceMinor: Math.round(h.unit_price_minor * it.quantity) });
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  function startShopping() {
    if (pending.length === 0) {
      setErrorKey('shop.emptyBeforeShop');
      return;
    }
    setMode('shopping');
  }

  function finishShopping() {
    setActual(majorStr(runningTotal, currency));
    setPayFrom((prev) => prev ?? accounts.find((a) => a.currency_code === currency)?.id ?? accounts[0]?.id ?? null);
    setMode('complete');
  }

  async function onClearPurchased() {
    try {
      await Promise.all(purchased.map((it) => deleteItem(it.id)));
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onRecord() {
    if (!list || !payFrom) return;
    setRecordError(null);
    const actualNum = Number(actual);
    if (!Number.isFinite(actualNum) || actualNum <= 0) return setRecordError('shop.actualRequired');
    const account = accounts.find((a) => a.id === payFrom);
    try {
      // Mark this trip's checked items purchased, writing the price paid.
      const checkedItems = pending.filter((it) => checked[it.id]);
      await Promise.all(
        checkedItems.map((it) => {
          const typed = tripPrices[it.id];
          const minor = typed ? toMinorUnits(Number(typed) || 0, currency) : (estimateOf(it) ?? undefined);
          return setPurchased(it.id, true, minor);
        }),
      );
      // One expense; keep the list active (evergreen).
      await completeList(list.id, payFrom, groceryCat?.id, store, toMinorUnits(actualNum, currency), false);
      toast.show(
        t('shop.recordedToast', {
          amount: formatAmount(toMinorUnits(actualNum, currency), currency),
          store: store.trim() || t('shop.title'),
          account: account?.name ?? '',
        }),
        { tone: 'success', money: true },
      );
      setChecked({}); setTripPrices({}); setStore(''); setActual(''); setMode('list');
      router.push('/(tabs)/transactions');
      await load();
    } catch (err) {
      setRecordError(toAppError(err).messageKey);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.pad}>
          <Text variant="title">{t('shop.title')}</Text>
          <Text muted>{t('finance.noHousehold')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remainingCount = pending.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView>
        <BentoPage>
          {mode === 'complete' ? (
            renderComplete()
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text variant="title">{t('shop.title')}</Text>
                  <Text variant="caption" muted>{`${active.name} · ${t('shop.shared')}`}</Text>
                </View>
                <Avatar name={active.name} size={42} variant="self" />
              </View>

              {errorKey ? (
                <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => { setErrorKey(null); void load(); }} />
              ) : null}

              {/* Groceries budget card — hidden entirely when there's no grocery category. */}
              {gStatus ? (
                <Card>
                  <View style={styles.rowBetween}>
                    <Text variant="subheading">{t('shop.budgetTitle', { category: groceryCat?.name ?? '' })}</Text>
                    <Text variant="caption" muted>{new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date())}</Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text variant="caption" muted>{t('shop.monthlyBudget')}</Text>
                    <Text variant="moneyMin">{formatAmount(gStatus.limit_minor, gStatus.currency_code)}</Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text variant="caption" muted>{t('shop.spentThisMonth')}</Text>
                    <Text variant="moneyMin">{formatAmount(gStatus.spent_minor, gStatus.currency_code)}</Text>
                  </View>
                  <ProgressBar
                    fraction={spentFraction(gStatus.limit_minor, gStatus.spent_minor)}
                    state={meterState(gStatus.limit_minor, gStatus.spent_minor)}
                  />
                  <View style={styles.rowBetween}>
                    <Text variant="button">{t('shop.remaining')}</Text>
                    <Text variant="subheading">{formatAmount(Math.max(0, gStatus.limit_minor - gStatus.spent_minor), gStatus.currency_code)}</Text>
                  </View>
                </Card>
              ) : null}

              {/* This week's list */}
              <Card style={styles.weekCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text variant="subheading">{t('shop.thisWeek')}</Text>
                    <Text variant="caption" muted>
                      {t(remainingCount === 1 ? 'shop.itemsRemaining_one' : 'shop.itemsRemaining_other', { count: remainingCount })}
                    </Text>
                  </View>
                  <View style={styles.weekEst}>
                    <Text variant="caption" muted>{t('shop.estimated')}</Text>
                    <Text variant="title" style={styles.estAmount}>{formatAmount(estimatedTotal, currency)}</Text>
                  </View>
                </View>
                {afterTrip != null ? (
                  <View style={styles.afterStrip}>
                    <Text variant="caption" muted>{t('shop.afterTrip')}</Text>
                    <Text variant="button" style={afterTrip < 0 ? styles.overText : styles.leftText}>
                      {t('shop.leftApprox', { amount: formatAmount(afterTrip, currency) })}
                    </Text>
                  </View>
                ) : null}
                <Segmented
                  options={[
                    { value: 'list', label: t('shop.modeList') },
                    { value: 'shopping', label: t('shop.modeShopping') },
                  ]}
                  value={mode}
                  onChange={(m) => (m === 'shopping' ? startShopping() : setMode('list'))}
                />
              </Card>

              {mode === 'list' ? renderList() : renderShopping()}
            </>
          )}
        </BentoPage>
      </ScrollView>
    </SafeAreaView>
  );

  function renderList() {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <Text variant="subheading">{t('shop.yourList')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setAddOpen((o) => !o)}>
            <Text variant="button" style={styles.link}>{t('shop.addItem')}</Text>
          </Pressable>
        </View>

        {addOpen ? (
          <InlineEditor
            saveLabel={t('shop.addToList')}
            cancelLabel={t('common.cancel')}
            onSave={onAdd}
            onCancel={() => { setAddOpen(false); setAddError(null); }}
            error={addError ? t(addError) : null}
          >
            <TextField label={t('shop.itemName')} value={nName} onChangeText={setNName} autoCapitalize="sentences" />
            <View style={styles.qtyRow}>
              <View style={styles.qtyField}>
                <TextField label={t('shop.qty')} value={nQty} onChangeText={setNQty} keyboardType="numeric" />
              </View>
              <View style={styles.unitField}>
                <Text variant="caption" muted>{t('shop.unit')}</Text>
                <Select accessibilityLabel={t('shop.unit')} options={UNITS.map((u) => ({ value: u, label: u }))} value={nUnit} onChange={setNUnit} />
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setNMore((m) => !m)}>
              <Text variant="caption" style={styles.link}>{t('shop.moreOptions')}</Text>
            </Pressable>
            {nMore ? (
              <>
                <TextField label={t('shop.noteOptional')} value={nNote} onChangeText={setNNote} />
                <TextField label={t('shop.estPrice')} value={nPrice} onChangeText={setNPrice} keyboardType="numeric" hint={t('shop.estHelper')} />
              </>
            ) : null}
          </InlineEditor>
        ) : null}

        {/* Buy again */}
        {buyAgain.length > 0 ? (
          <View style={styles.buyAgain}>
            <Text variant="eyebrow" muted>{t('shop.buyAgain')}</Text>
            <View style={styles.chips}>
              {buyAgain.map((h) => (
                <Chip key={h.name} label={`＋ ${h.name}`} onPress={() => onBuyAgain(h)} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Pending items */}
        {pending.length === 0 && purchased.length === 0 ? (
          <Text variant="caption" muted style={styles.emptyText}>{t('shop.emptyList')}</Text>
        ) : (
          pending.map((it) => renderItemRow(it))
        )}

        {/* Purchased section */}
        {purchased.length > 0 ? (
          <View style={styles.purchasedSection}>
            <Text variant="eyebrow" muted>{t('shop.purchased')}</Text>
            {purchased.map((it) => (
              <View key={it.id} style={styles.purchasedRow}>
                <View style={styles.checkTile}><Feather name="check" size={14} color={palette.white} /></View>
                <Text style={styles.struck} numberOfLines={1}>{it.name}</Text>
                <Text variant="caption" muted>
                  {it.quantity} {it.unit ?? ''}{it.actual_price_minor != null ? ` · ${formatAmount(it.actual_price_minor, currency)}` : ''}
                </Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={onClearPurchased}>
              <Text variant="button" style={styles.link}>{t('shop.clearPurchased')}</Text>
            </Pressable>
            <Text variant="caption" muted>{t('shop.clearNote')}</Text>
          </View>
        ) : null}
      </Card>
    );
  }

  function renderItemRow(it: GroceryItemRow) {
    if (editId === it.id) {
      return (
        <InlineEditor
          key={it.id}
          saveLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onSave={onSaveEdit}
          onCancel={() => setEditId(null)}
          error={editError ? t(editError) : null}
          destructive={<DestructiveAction label={t('shop.remove')} confirmLabel={t('components.tapAgain')} onConfirm={() => onRemove(it.id)} />}
        >
          <TextField label={t('shop.itemName')} value={eName} onChangeText={setEName} />
          <View style={styles.qtyRow}>
            <View style={styles.qtyField}><TextField label={t('shop.qty')} value={eQty} onChangeText={setEQty} keyboardType="numeric" /></View>
            <View style={styles.unitField}>
              <Text variant="caption" muted>{t('shop.unit')}</Text>
              <Select accessibilityLabel={t('shop.unit')} options={UNITS.map((u) => ({ value: u, label: u }))} value={eUnit} onChange={setEUnit} />
            </View>
          </View>
          <TextField label={t('shop.editPricePerUnit', { unit: eUnit })} value={ePrice} onChangeText={setEPrice} keyboardType="numeric" />
        </InlineEditor>
      );
    }
    const est = estimateOf(it);
    const hist = historyByName.get(it.name.toLowerCase());
    return (
      <View key={it.id} style={styles.itemRow}>
        <View style={styles.itemMid}>
          <Text variant="button" numberOfLines={1}>{it.name}</Text>
          <Text variant="caption" muted>{it.quantity} {it.unit ?? ''}</Text>
          <View style={styles.addedBy}>
            <Avatar name={names[it.added_by ?? ''] || '?'} size={16} />
            <Text variant="caption" muted>{(names[it.added_by ?? ''] || '').split(' ')[0]}</Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          {est != null ? (
            <Text variant="moneyMin">{t('shop.est', { amount: formatAmount(est, currency) })}</Text>
          ) : hist ? (
            <Pressable accessibilityRole="button" onPress={() => onUseAsEstimate(it)}>
              <Text variant="caption" style={styles.link}>
                {t('shop.lastPaid', { amount: formatAmount(hist.unit_price_minor, currency) })} · {t('shop.useAsEstimate')}
              </Text>
            </Pressable>
          ) : (
            <Text variant="caption" muted>{t('shop.noEstimate')}</Text>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.save')} hitSlop={10} onPress={() => openEdit(it)}>
            <Feather name="edit-2" size={16} color={palette.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  function renderShopping() {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="subheading">{t('shop.tripTitle')}</Text>
            <Text variant="caption" muted>{t('shop.itemsLeft', { done: pending.filter((it) => !checked[it.id]).length, total: pending.length })}</Text>
          </View>
          {gStatus ? (
            <View style={styles.weekEst}>
              <Text variant="caption" muted>{t('shop.groceriesLeft')}</Text>
              <Text variant="subheading">{formatAmount(Math.max(0, gStatus.limit_minor - gStatus.spent_minor), gStatus.currency_code)}</Text>
            </View>
          ) : null}
        </View>

        {pending.map((it) => {
          const on = !!checked[it.id];
          const est = estimateOf(it);
          return (
            <View key={it.id} style={styles.tripRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={it.name}
                onPress={() => setChecked((c) => ({ ...c, [it.id]: !c[it.id] }))}
                style={[styles.checkbox, on ? styles.checkboxOn : styles.checkboxOff]}
              >
                {on ? <Feather name="check" size={16} color={palette.white} /> : null}
              </Pressable>
              <View style={styles.itemMid}>
                <Text variant="button" numberOfLines={1} style={on ? styles.checkedName : undefined}>{it.name}</Text>
                <Text variant="caption" muted>
                  {it.quantity} {it.unit ?? ''}{est != null ? ` · ${t('shop.est', { amount: formatAmount(est, currency) })}` : ''}
                </Text>
              </View>
              <TextInput
                style={styles.priceInput}
                value={tripPrices[it.id] ?? ''}
                onChangeText={(v) => setTripPrices((p) => ({ ...p, [it.id]: v }))}
                placeholder={est != null ? majorStr(est, currency) : '0'}
                placeholderTextColor={palette.textTertiary}
                keyboardType="decimal-pad"
                accessibilityLabel={it.name}
              />
            </View>
          );
        })}

        <View style={styles.runningStrip}>
          <Text variant="button">{t('shop.runningTotal')}</Text>
          <Text variant="subheading">{formatAmount(runningTotal, currency)}</Text>
        </View>
        <Text variant="caption" muted>{t('shop.tripHelper')}</Text>
        <View style={styles.tripButtons}>
          <Button label={t('shop.finishShopping')} variant="accent" onPress={finishShopping} style={styles.flex1} />
          <Button label={t('shop.backToList')} variant="secondary" onPress={() => setMode('list')} style={styles.flex1} />
        </View>
      </Card>
    );
  }

  function renderComplete() {
    const account = accounts.find((a) => a.id === payFrom);
    return (
      <>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => setMode('shopping')} hitSlop={10}>
            <Feather name="chevron-left" size={24} color={palette.primary} />
          </Pressable>
          <Text variant="title">{t('shop.completeTitle')}</Text>
        </View>

        <Card>
          <TextField label={t('shop.store')} value={store} onChangeText={setStore} placeholder={t('shop.storePlaceholder')} />
          {recentStores.length > 0 ? (
            <View style={styles.chips}>
              {recentStores.map((s) => <Chip key={s} label={s} selected={store === s} onPress={() => setStore(s)} />)}
            </View>
          ) : null}

          <View style={styles.rowBetween}>
            <Text variant="caption" muted>{t('shop.estimatedTotal')}</Text>
            <Text variant="moneyMin">{formatAmount(runningTotal, currency)}</Text>
          </View>

          <AmountCard currencyCode={currency} value={actual} onChangeValue={setActual} label={t('shop.actualTotal')} />

          <Text variant="caption" muted>{t('shop.paidFrom')}</Text>
          <Select
            accessibilityLabel={t('shop.paidFrom')}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={payFrom ?? ''}
            onChange={setPayFrom}
          />

          <View style={styles.rowBetween}>
            <Text variant="caption" muted>{t('shop.category')}</Text>
            <Text variant="button">{groceryCat?.name ?? ''}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text variant="caption" muted>{t('shop.date')}</Text>
            <Text variant="button">{t('common.today')}</Text>
          </View>

          {recordError ? <Text variant="caption" style={styles.overText}>{t(recordError)}</Text> : null}

          <Button label={t('shop.recordPurchase')} onPress={onRecord} />
          <Text variant="caption" muted style={styles.helper}>
            {t('shop.recordHelper', { category: groceryCat?.name ?? '', account: account?.name ?? '' })}
          </Text>
        </Card>
      </>
    );
  }
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  pad: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  weekCard: { backgroundColor: c.primaryTint, gap: spacing.sm },
  weekEst: { alignItems: 'flex-end' },
  estAmount: { fontSize: 24 },
  afterStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  leftText: { color: c.positiveStrong },
  overText: { color: c.danger },
  link: { color: c.primary },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  buyAgain: { gap: spacing.sm, marginTop: spacing.xs },
  emptyText: { paddingVertical: spacing.sm },
  qtyRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  qtyField: { width: 90 },
  unitField: { flex: 1, gap: spacing.xs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.divider },
  itemMid: { flex: 1, gap: 2 },
  addedBy: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemRight: { alignItems: 'flex-end', gap: spacing.xs, flexDirection: 'row' },
  purchasedSection: { gap: spacing.sm, marginTop: spacing.sm },
  purchasedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkTile: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: c.positiveStrong, alignItems: 'center', justifyContent: 'center' },
  struck: { flex: 1, textDecorationLine: 'line-through', color: c.textSecondary },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: c.positiveStrong },
  checkboxOff: { borderWidth: 2, borderColor: c.border },
  checkedName: { color: c.positiveStrong },
  priceInput: {
    width: 84, minHeight: 40, borderRadius: radius.md, backgroundColor: c.fill,
    paddingHorizontal: spacing.sm, textAlign: 'right', color: c.ink,
  },
  runningStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.primaryTint, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  tripButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex1: { flex: 1 },
  helper: { lineHeight: 16 },
});
