/** Create-budget modal (moved out of the budgets screen's inline bottom form).
 *  Same fields/validation/createBudget call; closes itself on success. */

import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, CurrencyField, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { setPendingBudgetSelect } from '@/features/finance/pendingBudgetSelect';
import { createBudget } from '@/features/finance/planningApi';
import { createBudgetSchema } from '@/features/finance/planningSchemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

export default function BudgetNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();
  const bounds = monthBounds();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [start, setStart] = useState(bounds.start);
  const [end, setEnd] = useState(bounds.end);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate() {
    if (!active) return;
    setFormError(null);
    const result = validate(createBudgetSchema, {
      name,
      currencyCode: currency,
      periodStart: start,
      periodEnd: end,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await createBudget(active.id, result.data);
      // Tell the Budget tab to select the month we just made (not keep the old one).
      setPendingBudgetSelect(created.id);
      if (router.canGoBack()) router.back();
      else router.replace('/finance/budgets');
    } catch (err) {
      setFormError(toAppError(err).messageKey);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {!active ? (
          <Text muted>{t('finance.noHousehold')}</Text>
        ) : (
          <>
            <TextField
              label={t('planning.budgets.nameLabel')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              error={fieldErrors.name ? t('errors.validation') : undefined}
            />
            <CurrencyField
              label={t('planning.budgets.currencyLabel')}
              value={currency}
              onChange={setCurrency}
              suggested={[deviceCurrency(), active.reporting_currency_code].filter(Boolean)}
              error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
            />
            <TextField
              label={t('planning.budgets.startLabel')}
              value={start}
              onChangeText={setStart}
              error={fieldErrors.periodStart ? t('errors.validation') : undefined}
            />
            <TextField
              label={t('planning.budgets.endLabel')}
              value={end}
              onChangeText={setEnd}
              error={fieldErrors.periodEnd ? t('errors.validation') : undefined}
            />
            {formError ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(formError)}
              </Text>
            ) : null}
            <Button
              label={submitting ? t('auth.processing') : t('planning.budgets.createCta')}
              onPress={onCreate}
              loading={submitting}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
});
