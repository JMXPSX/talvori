/** Transactions tab: recent activity grouped by day. Creation lives behind the
 *  header "+" (income / expense / transfer); deletes are confirm-guarded. */

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Card, EmptyState, ErrorNotice, Text, useActionSheet } from '@/components/ui';
import { deleteTransaction, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

const INCOME_TILE = '#D9E8D2';

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

function typeIcon(type: TransactionWithRefs['type']): {
  name: keyof typeof Feather.glyphMap;
  color: string;
  bg: string;
} {
  if (type === 'income') return { name: 'arrow-down-left', color: palette.success, bg: INCOME_TILE };
  if (type === 'transfer') return { name: 'repeat', color: palette.brand, bg: palette.brandMuted };
  return { name: 'arrow-up-right', color: palette.brand, bg: palette.brandMuted };
}

export default function TransactionsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();
  const sheet = useActionSheet();

  const [items, setItems] = useState<TransactionWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      setItems(await listTransactions(active.id));
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

  function onDelete(id: string) {
    sheet.show({
      title: t('finance.confirmDeleteTitle'),
      message: t('finance.confirmDeleteBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteTransaction(id);
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

  function typeLabel(type: TransactionWithRefs['type']): string {
    if (type === 'income') return t('finance.categories.income');
    if (type === 'transfer') return t('finance.transfer.title');
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

  const groups = groupByDay(items, i18n.language, t);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
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

        {errorKey ? (
          <ErrorNotice message={t(errorKey)} retryLabel={t('common.retry')} onRetry={() => void load()} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon="list"
            message={t('finance.noTransactions')}
            ctaLabel={t('finance.addExpense')}
            onCta={() => router.push('/finance/entry?type=expense')}
          />
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
                    const icon = typeIcon(tx.type);
                    const caption = [tx.category?.name, tx.account?.name].filter(Boolean).join(' · ');
                    return (
                      <View key={tx.id} style={[styles.row, index > 0 ? styles.rowDivider : null]}>
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
                          variant="heading"
                          style={[styles.amount, positive ? styles.amountIn : null]}
                        >
                          {positive ? '+' : '−'}
                          {formatAmount(tx.amount_minor, tx.currency_code)}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('finance.delete')}
                          hitSlop={12}
                          onPress={() => onDelete(tx.id)}
                          style={({ pressed }) => (pressed ? styles.pressed : null)}
                        >
                          <Feather name="trash-2" size={18} color={palette.textMuted} />
                        </Pressable>
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      {sheet.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.brand,
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
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1, gap: 2 },
  amount: { fontSize: 16 },
  amountIn: { color: palette.success },
});
