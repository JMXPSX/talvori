/** Manage accounts: list with balances + create. Opening balance is entered in
 *  major units and converted to minor units before saving. */

import { getLocales } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createAccount, listAccountBalances, listAccounts } from '@/features/finance/api';
import { accountTypeSchema, createAccountSchema } from '@/features/finance/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountBalanceRow, AccountRow, AccountType } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

const ACCOUNT_TYPES = accountTypeSchema.options;

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

export default function AccountsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [balances, setBalances] = useState<Record<string, AccountBalanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [opening, setOpening] = useState('');
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

  async function onCreate() {
    if (!active) return;
    setFormError(null);
    const result = validate(createAccountSchema, {
      name,
      type,
      currencyCode: currency,
      openingBalanceMajor: opening === '' ? 0 : opening,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createAccount(active.id, {
        name: result.data.name,
        type: result.data.type,
        currencyCode: result.data.currencyCode,
        openingBalanceMinor: toMinorUnits(result.data.openingBalanceMajor, result.data.currencyCode),
      });
      setName('');
      setOpening('');
      await load();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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
                <View key={a.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text>{a.name}</Text>
                    <Text>
                      {formatAmount(bal ? bal.balance_minor : a.opening_balance_minor, a.currency_code)}
                    </Text>
                  </View>
                  <Text variant="caption" muted>
                    {t(`finance.accounts.types.${a.type}`)} · {a.currency_code}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('finance.accounts.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('finance.accounts.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />

          <Text variant="caption" muted>
            {t('finance.accounts.typeLabel')}
          </Text>
          <View style={styles.chips}>
            {ACCOUNT_TYPES.map((ty) => {
              const activeChip = ty === type;
              return (
                <Pressable
                  key={ty}
                  onPress={() => setType(ty)}
                  style={[styles.chip, activeChip ? styles.chipActive : null]}
                >
                  <Text variant="caption" style={{ color: activeChip ? palette.white : palette.text }}>
                    {t(`finance.accounts.types.${ty}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={t('finance.accounts.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('finance.accounts.openingBalanceLabel')}
            value={opening}
            onChangeText={setOpening}
            keyboardType="numeric"
            error={fieldErrors.openingBalanceMajor ? t('errors.validation') : undefined}
          />

          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}

          <Button
            label={submitting ? t('auth.processing') : t('finance.accounts.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>

        <Pressable style={styles.manage} onPress={() => router.push('/finance/categories')}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('finance.categories.manage')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
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
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  manage: { marginTop: spacing.lg, alignSelf: 'center' },
});
