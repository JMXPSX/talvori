/** Transfer money between two accounts (§6.5). From/To account chips (To excludes
 *  From and is warn-toned; changing From auto-moves a colliding To), an amount card,
 *  date and note. Same-currency mirrors the amount; cross-currency takes an amount
 *  in each account's own currency. Posts a neutral-signed transfer and toasts back. */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import {
  AmountCard,
  Button,
  Chip,
  DateField,
  FORM_MAX_WIDTH,
  resolveDate,
  Text,
  TextField,
  useToast,
  type DateMode,
} from '@/components/ui';
import { createTransfer, listAccounts } from '@/features/finance/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { AccountRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    try {
      const accs = await listAccounts(active.id);
      setAccounts(accs);
      setFromId((prev) => prev ?? accs[0]?.id ?? null);
      setToId((prev) => prev ?? accs[1]?.id ?? null);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const from = useMemo(() => accounts.find((a) => a.id === fromId) ?? null, [accounts, fromId]);
  const to = useMemo(() => accounts.find((a) => a.id === toId) ?? null, [accounts, toId]);
  const sameCurrency = Boolean(from && to && from.currency_code === to.currency_code);

  // Changing From auto-moves a colliding To to the first other account (§6.5 #4).
  function pickFrom(id: string) {
    setFromId(id);
    if (toId === id) setToId(accounts.find((a) => a.id !== id)?.id ?? null);
  }

  async function onSave() {
    if (!from || !to) return;
    setFormError(null);
    if (from.id === to.id) {
      setFormError('finance.transfer.sameAccounts');
      return;
    }
    const fromParsed = Number(fromAmount);
    const toParsed = sameCurrency ? fromParsed : Number(toAmount);
    if (!Number.isFinite(fromParsed) || fromParsed <= 0 || !Number.isFinite(toParsed) || toParsed <= 0) {
      setFormError('finance.form.amountPositive');
      return;
    }
    setSubmitting(true);
    try {
      await createTransfer({
        fromAccountId: from.id,
        toAccountId: to.id,
        fromAmountMinor: toMinorUnits(fromParsed, from.currency_code),
        toAmountMinor: toMinorUnits(toParsed, to.currency_code),
        occurredAt: new Date(`${resolveDate(dateMode, customDate)}T12:00:00`).toISOString(),
      });
      toast.show(
        t('finance.toast.transferSaved', {
          amount: formatAmount(toMinorUnits(fromParsed, from.currency_code), from.currency_code),
          from: from.name,
          to: to.name,
        }),
        { tone: 'success', money: true },
      );
      router.back();
    } catch (err) {
      setFormError(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !active) {
    return (
      <SafeAreaView style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} />
      </SafeAreaView>
    );
  }

  if (accounts.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Text variant="title">{t('finance.transfer.moneyTitle')}</Text>
          <Text muted>{t('finance.transfer.needTwo')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">{t('finance.transfer.moneyTitle')}</Text>

        <AmountCard
          currencyCode={from?.currency_code ?? active.reporting_currency_code}
          value={fromAmount}
          onChangeValue={setFromAmount}
        />

        <View style={styles.group}>
          <Text variant="caption" muted>{t('finance.form.fromAccount')}</Text>
          <View style={styles.chips}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={a.id === fromId}
                role="radio"
                onPress={() => pickFrom(a.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="caption" muted>{t('finance.form.toAccount')}</Text>
          <View style={styles.chips}>
            {accounts
              .filter((a) => a.id !== fromId)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  selected={a.id === toId}
                  tone="warn"
                  role="radio"
                  onPress={() => setToId(a.id)}
                />
              ))}
          </View>
        </View>

        {!sameCurrency ? (
          <View style={styles.group}>
            <Text variant="caption" muted>{t('finance.transfer.crossCurrencyHint')}</Text>
            <AmountCard
              currencyCode={to?.currency_code ?? active.reporting_currency_code}
              value={toAmount}
              onChangeValue={setToAmount}
              label={t('finance.transfer.toAmountLabel')}
            />
          </View>
        ) : null}

        <DateField
          mode={dateMode}
          customDate={customDate}
          onModeChange={setDateMode}
          onCustomChange={setCustomDate}
        />

        <TextField
          label={t('finance.form.noteLabel')}
          value={note}
          onChangeText={setNote}
          placeholder={t('finance.transfer.notePlaceholderExample')}
          autoCapitalize="sentences"
        />

        {formError ? (
          <Text variant="caption" style={{ color: palette.danger }}>
            {t(formError)}
          </Text>
        ) : null}

        <Button
          label={t('finance.transfer.saveTransfer')}
          onPress={onSave}
          loading={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
