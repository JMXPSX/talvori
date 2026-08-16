/** Savings goals: progress toward each target + inline contributions + create. */

import { getLocales } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField, useActionSheet } from '@/components/ui';
import {
  addContribution,
  createGoal,
  deleteGoal,
  listGoalStatus,
  listGoals,
} from '@/features/finance/planningApi';
import { createGoalSchema } from '@/features/finance/planningSchemas';
import { goalRemainingMinor, progressRatio } from '@/features/finance/progress';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { SavingsGoalRow, SavingsGoalStatusRow } from '@/lib/database.types';
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

export default function GoalsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const sheet = useActionSheet();

  const [goals, setGoals] = useState<SavingsGoalRow[]>([]);
  const [status, setStatus] = useState<Record<string, SavingsGoalStatusRow>>({});
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [contribInputs, setContribInputs] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [target, setTarget] = useState('');
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
      const [g, s] = await Promise.all([listGoals(active.id), listGoalStatus(active.id)]);
      setGoals(g);
      setStatus(Object.fromEntries(s.map((row) => [row.goal_id, row])));
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

  async function onContribute(goal: SavingsGoalRow) {
    if (!active) return;
    const raw = contribInputs[goal.id] ?? '';
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await addContribution({
        goalId: goal.id,
        householdId: active.id,
        amountMinor: toMinorUnits(amount, goal.currency_code),
      });
      setContribInputs((prev) => ({ ...prev, [goal.id]: '' }));
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  function onDeleteGoal(goal: SavingsGoalRow) {
    sheet.show({
      title: t('planning.goals.confirmDeleteTitle'),
      message: t('planning.goals.confirmDeleteBody'),
      cancelLabel: t('common.cancel'),
      actions: [
        {
          label: t('finance.delete'),
          destructive: true,
          onPress: () => {
            void (async () => {
              try {
                await deleteGoal(goal.id);
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
    const result = validate(createGoalSchema, { name, currencyCode: currency, targetMajor: target });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createGoal(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
        targetMinor: toMinorUnits(result.data.targetMajor, result.data.currencyCode),
        targetDate: result.data.targetDate,
      });
      setName('');
      setTarget('');
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
        ) : goals.length === 0 ? (
          <Text muted>{t('planning.goals.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {goals.map((g) => {
              const s = status[g.id];
              const saved = s?.saved_minor ?? 0;
              const remaining = goalRemainingMinor(g.target_minor, saved);
              const ratio = progressRatio(saved, g.target_minor);
              return (
                <View key={g.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">{g.name}</Text>
                    <View style={styles.cardTrailing}>
                      <Text variant="caption" muted>
                        {formatAmount(saved, g.currency_code)} / {formatAmount(g.target_minor, g.currency_code)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('finance.delete')}
                        hitSlop={12}
                        onPress={() => onDeleteGoal(g)}
                      >
                        <Feather name="trash-2" size={18} color={palette.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
                  </View>
                  <Text variant="caption" muted>
                    {t('planning.goals.remaining')}: {formatAmount(remaining, g.currency_code)}
                  </Text>
                  <View style={styles.inlineRow}>
                    <View style={styles.inlineField}>
                      <TextField
                        label={t('planning.goals.amountLabel')}
                        value={contribInputs[g.id] ?? ''}
                        onChangeText={(v) => setContribInputs((prev) => ({ ...prev, [g.id]: v }))}
                        keyboardType="numeric"
                      />
                    </View>
                    <Button label={t('planning.goals.contributeCta')} onPress={() => onContribute(g)} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('planning.goals.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('planning.goals.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.goals.currencyLabel')}
            value={currency}
            onChangeText={setCurrency}
            hint={t('household.currencyHint')}
            autoCapitalize="characters"
            error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('planning.goals.targetLabel')}
            value={target}
            onChangeText={setTarget}
            keyboardType="numeric"
            error={fieldErrors.targetMajor ? t('errors.validation') : undefined}
          />
          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}
          <Button
            label={submitting ? t('auth.processing') : t('planning.goals.createCta')}
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
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: palette.brandMuted, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: palette.brand },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  inlineField: { flex: 1 },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
