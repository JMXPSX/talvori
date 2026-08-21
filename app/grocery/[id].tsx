/** Grocery list detail: live items, purchase toggle, totals, and checkout. */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, Chip, CONTENT_MAX_WIDTH, ProgressBar, Text, TextField, useActionSheet } from '@/components/ui';
import { listAccounts, listCategories } from '@/features/finance/api';
import {
  addItem,
  completeList,
  deleteItem,
  deleteList,
  getList,
  listItems,
  setPurchased,
  subscribeToItems,
} from '@/features/grocery/api';
import { addItemSchema } from '@/features/grocery/schemas';
import { actualTotalMinor, estimatedTotalMinor, purchasedCount } from '@/features/grocery/totals';
import { listMembers } from '@/features/household/api';
import { listProducts } from '@/features/retail/api';
import type { AccountRow, CategoryRow, GroceryItemRow, GroceryListRow } from '@/lib/database.types';
import { parseAmount } from '@/lib/amountInput';
import { toAppError } from '@/lib/errors';
import { formatAmount, localeTag } from '@/lib/format';
import { money, toMajorUnits, toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function GroceryListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);
  const sheet = useActionSheet();

  const [list, setList] = useState<GroceryListRow | null>(null);
  const [items, setItems] = useState<GroceryItemRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [est, setEst] = useState('');
  // The item awaiting an optional actual-price entry after being ticked (F12).
  const [promptItem, setPromptItem] = useState<GroceryItemRow | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    setErrorKey(null);
    try {
      const l = await getList(listId);
      setList(l);
      const [its, accs, members] = await Promise.all([
        listItems(listId),
        l ? listAccounts(l.household_id) : Promise.resolve<AccountRow[]>([]),
        l ? listMembers(l.household_id) : Promise.resolve([]),
      ]);
      setItems(its);
      const sameCcy = accs.filter((a) => !l || a.currency_code === l.currency_code);
      setAccounts(sameCcy);
      setAccountId((prev) => prev ?? sameCcy[0]?.id ?? null);
      setNames(
        Object.fromEntries(
          members.map((m) => [m.user_id, m.profile?.display_name || m.profile?.email || '']),
        ),
      );
      if (l) {
        setCategories(await listCategories(l.household_id, 'expense'));
        const prods = await listProducts(l.household_id);
        setProductNames(Object.fromEntries(prods.map((p) => [p.id, p.name])));
      }
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const unsub = subscribeToItems(listId, () => void load());
    return unsub;
  }, [listId, load]);

  async function onAdd() {
    const result = validate(addItemSchema, { name, quantity: qty, estimatedMajor: est });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    try {
      const ccy = list?.currency_code ?? 'USD';
      await addItem(listId, {
        name: result.data.name,
        quantity: result.data.quantity,
        unit: result.data.unit,
        estimatedPriceMinor:
          result.data.estimatedMajor === undefined
            ? undefined
            : toMinorUnits(result.data.estimatedMajor, ccy),
      });
      setName('');
      setQty('');
      setEst('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  // Ticking the circle: un-tick applies immediately; ticking opens the optional
  // actual-price prompt (F12 — no always-visible per-row field or button).
  async function onTick(item: GroceryItemRow) {
    if (item.is_purchased) {
      try {
        await setPurchased(item.id, false);
        await load();
      } catch (err) {
        setErrorKey(toAppError(err).messageKey);
      }
      return;
    }
    const ccy = list?.currency_code ?? 'USD';
    const estMajor =
      item.estimated_price_minor != null
        ? String(toMajorUnits(money(item.estimated_price_minor, ccy)))
        : '';
    setPromptItem(item);
    setPromptValue(estMajor);
  }

  async function confirmPurchase() {
    if (!promptItem) return;
    const ccy = list?.currency_code ?? 'USD';
    const raw = promptValue.trim();
    const major = raw ? parseAmount(raw, localeTag()) : null;
    const actualMinor = major != null && major >= 0 ? toMinorUnits(major, ccy) : undefined;
    const item = promptItem;
    setPromptItem(null);
    setPromptValue('');
    try {
      await setPurchased(item.id, true, actualMinor);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  function onDeleteList() {
    sheet.show({
      title: t('grocery.confirmDeleteListTitle'),
      message: t('grocery.confirmDeleteListBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('grocery.deleteListCta'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteList(listId);
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/grocery');
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  function onDeleteItem(item: GroceryItemRow) {
    sheet.show({
      title: t('grocery.confirmDeleteItemTitle'),
      message: t('grocery.confirmDeleteItemBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('grocery.deleteItem'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteItem(item.id);
                await load();
              } catch (err) {
                setErrorKey(toAppError(err).messageKey);
              }
            })();
          },
        },
      ],
    });
  }

  async function onComplete() {
    if (!list || !accountId) {
      setErrorKey('grocery.errors.noAccount');
      return;
    }
    setCheckingOut(true);
    try {
      await completeList(listId, accountId, categoryId ?? undefined);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setCheckingOut(false);
    }
  }

  const nameFor = (id: string | null): string =>
    (id && names[id]) || t('grocery.someone');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  const ccy = list?.currency_code ?? 'USD';
  const isCompleted = list?.status === 'completed';

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.summary}>
          <Text variant="moneyMin" muted>
            {t('grocery.estimatedTotal')}: {formatAmount(estimatedTotalMinor(items), ccy)}
          </Text>
          <Text variant="moneyMin" muted>
            {t('grocery.actualTotal')}: {formatAmount(actualTotalMinor(items), ccy)}
          </Text>
          <Text variant="caption" muted>
            {t('grocery.purchasedOf', { done: purchasedCount(items), total: items.length })}
          </Text>
          {items.length > 0 ? (
            <ProgressBar
              fraction={purchasedCount(items) / items.length}
              state={purchasedCount(items) === items.length ? 'full' : 'normal'}
              height={7}
            />
          ) : null}
          {items.some((it) => it.product_id) && (
            <Button
              label={t('grocery.compareCta')}
              variant="secondary"
              onPress={() => router.push(`/grocery/compare/${listId}`)}
            />
          )}
        </View>

        <View style={styles.list}>
          {items.map((it) => (
            <View key={it.id} style={[styles.card, it.is_purchased ? styles.doneCard : null]}>
              <View style={styles.itemRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: it.is_purchased }}
                  accessibilityLabel={it.name}
                  disabled={isCompleted}
                  hitSlop={10}
                  onPress={() => onTick(it)}
                  style={styles.tickHit}
                >
                  <View style={[styles.tick, it.is_purchased ? styles.tickDone : null]}>
                    {it.is_purchased ? <Feather name="check" size={16} color={palette.white} /> : null}
                  </View>
                </Pressable>

                <View style={styles.itemMid}>
                  <Text variant="subheading" style={it.is_purchased ? styles.struck : undefined}>
                    {it.unit ? `${it.name} · ${it.quantity} ${it.unit}` : `${it.name} · ${it.quantity}`}
                  </Text>
                  <Text variant="caption" muted>
                    {it.is_purchased
                      ? t('grocery.purchasedBy', { name: nameFor(it.purchased_by) })
                      : t('grocery.addedBy', { name: nameFor(it.added_by) })}
                  </Text>
                  <Pressable onPress={() => router.push(`/grocery/link/${it.id}`)}>
                    <Text variant="caption" style={{ color: palette.brand }}>
                      {it.product_id
                        ? t('grocery.linkedTo', { name: productNames[it.product_id] ?? '…' })
                        : t('grocery.linkProduct')}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.itemTrail}>
                  <Text variant="moneyMin" muted>
                    {formatAmount(it.actual_price_minor ?? it.estimated_price_minor ?? 0, ccy)}
                  </Text>
                  {!isCompleted && !it.is_purchased ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('grocery.deleteItem')}
                      hitSlop={10}
                      onPress={() => onDeleteItem(it)}
                    >
                      <Feather name="trash-2" size={16} color={palette.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>

        {!isCompleted && (
          <>
            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.addItemTitle')}</Text>
            <View style={styles.form}>
              <TextField
                label={t('grocery.itemNameLabel')}
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
                error={fieldErrors.name ? t('errors.validation') : undefined}
              />
              <TextField label={t('grocery.quantityLabel')} value={qty} onChangeText={setQty} keyboardType="numeric" />
              <TextField label={t('grocery.estimatedLabel')} value={est} onChangeText={setEst} keyboardType="numeric" />
              <Button label={t('grocery.addCta')} onPress={onAdd} />
            </View>

            <View style={styles.divider} />
            <Text variant="heading">{t('grocery.completeTitle')}</Text>
            {accounts.length === 0 ? (
              <Text muted>{t('grocery.errors.noAccount')}</Text>
            ) : (
              <View style={styles.form}>
                <Text variant="caption" muted>{t('grocery.accountLabel')}</Text>
                <View style={styles.chips}>
                  {accounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={`${a.name} (${a.currency_code})`}
                      selected={a.id === accountId}
                      role="radio"
                      onPress={() => setAccountId(a.id)}
                    />
                  ))}
                </View>

                {categories.length > 0 && (
                  <>
                    <Text variant="caption" muted>{t('grocery.categoryLabel')}</Text>
                    <View style={styles.chips}>
                      <Chip
                        label={t('finance.categories.none')}
                        selected={categoryId === null}
                        role="radio"
                        onPress={() => setCategoryId(null)}
                      />
                      {categories.map((c) => (
                        <Chip
                          key={c.id}
                          label={c.name}
                          selected={c.id === categoryId}
                          role="radio"
                          onPress={() => setCategoryId(c.id)}
                        />
                      ))}
                    </View>
                  </>
                )}

                <Button
                  label={checkingOut ? t('auth.processing') : t('grocery.completeCta')}
                  onPress={onComplete}
                  loading={checkingOut}
                />
              </View>
            )}
          </>
        )}

        {isCompleted && <Text muted>{t('grocery.completedNote')}</Text>}

        {list ? (
          <Button label={t('grocery.deleteListCta')} variant="dangerQuiet" onPress={onDeleteList} />
        ) : null}
      </ScrollView>

      {/* Optional actual-price prompt shown once when an item is ticked (F12). */}
      <Modal
        visible={promptItem != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPromptItem(null);
          setPromptValue('');
        }}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text variant="subheading">{t('grocery.actualPromptTitle')}</Text>
            {promptItem ? (
              <Text variant="caption" muted>
                {promptItem.name}
              </Text>
            ) : null}
            <TextField
              label={`${t('grocery.actualLabel')} (${ccy})`}
              value={promptValue}
              onChangeText={setPromptValue}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={() => {
                  setPromptItem(null);
                  setPromptValue('');
                }}
                style={styles.modalBtn}
              />
              <Button label={t('grocery.markPurchased')} onPress={confirmPurchase} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {sheet.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  summary: { gap: spacing.xs },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile,
    gap: spacing.xs,
  },
  doneCard: { backgroundColor: palette.surfaceMuted },
  struck: { textDecorationLine: 'line-through' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // ≥44px hit target around a 26px tick circle.
  tickHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tick: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: { backgroundColor: palette.success, borderColor: palette.success },
  itemMid: { flex: 1, gap: 2 },
  itemTrail: { alignItems: 'flex-end', gap: spacing.xs },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: { flex: 1 },
});
