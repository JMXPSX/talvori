/** Transactions tab: recent activity for the active household + quick actions.
 *  Amounts show a +/- by direction; income green, expense/out red. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { deleteTransaction, listTransactions, type TransactionWithRefs } from '@/features/finance/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function TransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();

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

  async function onDelete(id: string) {
    try {
      await deleteTransaction(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t('screens.transactionsTitle')}</Text>

        <View style={styles.actions}>
          <Button label={t('finance.addIncome')} onPress={() => router.push('/finance/entry?type=income')} />
          <Button
            label={t('finance.addExpense')}
            variant="secondary"
            onPress={() => router.push('/finance/entry?type=expense')}
          />
          <Button
            label={t('finance.addTransfer')}
            variant="secondary"
            onPress={() => router.push('/finance/transfer')}
          />
        </View>

        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        {items.length === 0 ? (
          <Text muted>{t('finance.noTransactions')}</Text>
        ) : (
          <View style={styles.list}>
            {items.map((tx) => {
              const positive = tx.direction === 'in';
              const sign = positive ? '+' : '−';
              return (
                <View key={tx.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text>{tx.account?.name ?? ''}</Text>
                    <Text style={{ color: positive ? palette.success : palette.danger }}>
                      {sign}
                      {formatAmount(tx.amount_minor, tx.currency_code)}
                    </Text>
                  </View>
                  <Text variant="caption" muted>
                    {t(`finance.${tx.type === 'transfer' ? 'addTransfer' : tx.type === 'income' ? 'addIncome' : 'addExpense'}`)}
                    {tx.category?.name ? ` · ${tx.category.name}` : ''}
                    {tx.description ? ` · ${tx.description}` : ''}
                  </Text>
                  <Pressable onPress={() => onDelete(tx.id)}>
                    <Text variant="caption" style={{ color: palette.danger }}>
                      {t('finance.delete')}
                    </Text>
                  </Pressable>
                </View>
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
  content: { padding: spacing.lg, gap: spacing.md },
  actions: { gap: spacing.sm },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
