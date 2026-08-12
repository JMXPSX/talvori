/**
 * Home dashboard: the active household's accounts with live balances (from the
 * account_balances view) plus quick actions. Balances are formatted per the
 * device locale and each account's own currency — never hard-coded.
 */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listAccountBalances, listAccounts } from '@/features/finance/api';
import type { AccountBalanceRow, AccountRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active, loading: hLoading } = useActiveHousehold();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [balances, setBalances] = useState<Record<string, AccountBalanceRow>>({});
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
      const [accs, bals] = await Promise.all([
        listAccounts(active.id),
        listAccountBalances(active.id),
      ]);
      setAccounts(accs);
      setBalances(Object.fromEntries(bals.map((b) => [b.account_id, b])));
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
          <Text muted>{t('finance.noHousehold')}</Text>
          <Link href="/household" style={styles.link}>
            <Text style={{ color: palette.brand }}>{t('finance.goToHouseholds')}</Text>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{active.name}</Text>

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : errorKey ? (
          <Text style={{ color: palette.danger }}>{t(errorKey)}</Text>
        ) : accounts.length === 0 ? (
          <Text muted>{t('finance.noAccounts')}</Text>
        ) : (
          <View style={styles.list}>
            {accounts.map((a) => {
              const bal = balances[a.id];
              return (
                <Pressable
                  key={a.id}
                  style={styles.card}
                  onPress={() => router.push('/finance/accounts')}
                >
                  <View style={styles.cardRow}>
                    <Text variant="heading">{a.name}</Text>
                    <Text variant="heading">
                      {bal
                        ? formatAmount(bal.balance_minor, bal.currency_code)
                        : formatAmount(a.opening_balance_minor, a.currency_code)}
                    </Text>
                  </View>
                  <Text variant="caption" muted>
                    {t(`finance.accounts.types.${a.type}`)} · {a.currency_code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

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
          <Button
            label={t('finance.manageAccounts')}
            variant="secondary"
            onPress={() => router.push('/finance/accounts')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  padded: { padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.md },
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
  actions: { gap: spacing.sm, marginTop: spacing.md },
  link: { marginTop: spacing.sm },
});
