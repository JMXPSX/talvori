/** Debts: outstanding balance per debt + inline payments + create. */

import { getLocales } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, Chip, CONTENT_MAX_WIDTH, Text, TextField, useActionSheet } from '@/components/ui';
import { listAccounts } from '@/features/finance/api';
import {
  addPayment,
  createDebt,
  deleteDebt,
  listDebtStatus,
  listDebts,
} from '@/features/finance/planningApi';
import { createDebtSchema } from '@/features/finance/planningSchemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow, DebtRow, DebtStatusRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

export default function DebtsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const sheet = useActionSheet();

  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [status, setStatus] = useState<Record<string, DebtStatusRow>>({});
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [payInputs, setPayInputs] = useState<Record<string, string>>({});
  // Money-model #6: a payment posts an 'out' transaction, so it needs a funding
  // account whose currency matches the debt. Selection is per debt.
  const [payAccount, setPayAccount] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [principal, setPrincipal] = useState('');
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
      const [d, s, accs] = await Promise.all([
        listDebts(active.id),
        listDebtStatus(active.id),
        listAccounts(active.id),
      ]);
      setDebts(d);
      setStatus(Object.fromEntries(s.map((row) => [row.debt_id, row])));
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

  function eligibleAccountsFor(debt: DebtRow): AccountRow[] {
    return accounts.filter((a) => a.currency_code === debt.currency_code);
  }

  async function onPay(debt: DebtRow) {
    if (!active) return;
    const raw = payInputs[debt.id] ?? '';
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return;
    const eligible = eligibleAccountsFor(debt);
    const accountId = payAccount[debt.id] ?? eligible[0]?.id;
    if (!accountId) {
      setErrorKey('planning.errors.noFundingAccount');
      return;
    }
    try {
      await addPayment({
        debtId: debt.id,
        accountId,
        amountMinor: toMinorUnits(amount, debt.currency_code),
      });
      setPayInputs((prev) => ({ ...prev, [debt.id]: '' }));
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  function onDeleteDebt(debt: DebtRow) {
    sheet.show({
      title: t('planning.debts.confirmDeleteTitle'),
      message: t('planning.debts.confirmDeleteBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteDebt(debt.id);
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

  async function onCreate() {
    if (!active) return;
    setFormError(null);
    const result = validate(createDebtSchema, {
      name,
      currencyCode: currency,
      principalMajor: principal === '' ? 0 : principal,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createDebt(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
        principalMinor: toMinorUnits(result.data.principalMajor, result.data.currencyCode),
        apr: result.data.apr,
        dueDay: result.data.dueDay,
      });
      setName('');
      setPrincipal('');
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
        ) : debts.length === 0 ? (
          <Text muted>{t('planning.debts.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {debts.map((d) => {
              const s = status[d.id];
              const balance = s?.balance_minor ?? d.principal_minor;
              return (
                <View key={d.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">{d.name}</Text>
                    <View style={styles.cardTrailing}>
                      <Text variant="heading" style={{ color: balance > 0 ? palette.danger : palette.success }}>
                        {formatAmount(balance, d.currency_code)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('finance.delete')}
                        hitSlop={12}
                        onPress={() => onDeleteDebt(d)}
                      >
                        <Feather name="trash-2" size={18} color={palette.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                  <Text variant="caption" muted>
                    {t('planning.debts.balance')}
                    {d.apr != null ? ` · ${d.apr}% APR` : ''}
                  </Text>
                  {(() => {
                    const eligible = eligibleAccountsFor(d);
                    if (eligible.length === 0) {
                      return (
                        <Text variant="caption" muted>
                          {t('planning.debts.noFundingAccount', { currency: d.currency_code })}
                        </Text>
                      );
                    }
                    const selected = payAccount[d.id] ?? eligible[0]?.id ?? null;
                    return (
                      <>
                        {eligible.length > 1 ? (
                          <View style={styles.accountChips}>
                            {eligible.map((a) => (
                              <Chip
                                key={a.id}
                                label={a.name}
                                selected={selected === a.id}
                                role="radio"
                                onPress={() => setPayAccount((p) => ({ ...p, [d.id]: a.id }))}
                              />
                            ))}
                          </View>
                        ) : null}
                        <View style={styles.inlineRow}>
                          <View style={styles.inlineField}>
                            <TextField
                              label={t('planning.debts.amountLabel')}
                              value={payInputs[d.id] ?? ''}
                              onChangeText={(v) => setPayInputs((prev) => ({ ...prev, [d.id]: v }))}
                              keyboardType="numeric"
                            />
                          </View>
                          <Button label={t('planning.debts.payCta')} onPress={() => onPay(d)} />
                        </View>
                        <Text variant="caption" muted>
                          {t('planning.debts.fundedFrom', {
                            name: eligible.find((a) => a.id === selected)?.name ?? '',
                          })}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('planning.debts.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('planning.debts.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.debts.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.debts.principalLabel')}
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="numeric"
            error={fieldErrors.principalMajor ? t('errors.validation') : undefined}
          />
          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}
          <Button
            label={submitting ? t('auth.processing') : t('planning.debts.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>
      </ScrollView>
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
  list: { gap: spacing.sm },
  // Matches the Card primitive's bento treatment: borderless, ambient shadow.
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile,
    gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  inlineField: { flex: 1 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
