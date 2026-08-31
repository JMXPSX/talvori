/** Manage FX rates (manual). Each save is a new timestamped snapshot; the list
 *  shows the latest rate per currency pair. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createRate, listLatestRates } from '@/features/finance/fxApi';
import { createRateSchema } from '@/features/finance/planningSchemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { LatestFxRateRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { validate } from '@/lib/validation';

export default function RatesScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [rates, setRates] = useState<LatestFxRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [base, setBase] = useState(active?.reporting_currency_code ?? '');
  const [quote, setQuote] = useState('');
  const [rate, setRate] = useState('');
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
      setRates(await listLatestRates(active.id));
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
    const result = validate(createRateSchema, {
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createRate(active.id, {
        baseCurrency: result.data.baseCurrency,
        quoteCurrency: result.data.quoteCurrency,
        rate: result.data.rate,
      });
      setRate('');
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
        ) : rates.length === 0 ? (
          <Text muted>{t('fx.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {rates.map((r) => (
              <View key={`${r.base_currency}>${r.quote_currency}`} style={styles.card}>
                <Text>
                  1 {r.base_currency} = {r.rate} {r.quote_currency}
                </Text>
                <Text variant="caption" muted>
                  {formatDate(r.as_of)} · {r.source}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('fx.addTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('fx.baseLabel')}
            value={base}
            onChangeText={setBase}
            autoCapitalize="characters"
            error={fieldErrors.baseCurrency ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('fx.quoteLabel')}
            value={quote}
            onChangeText={setQuote}
            autoCapitalize="characters"
            error={fieldErrors.quoteCurrency ? t('errors.validation') : undefined}
          />
          <TextField
            label={t('fx.rateLabel')}
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            error={fieldErrors.rate ? t('errors.validation') : undefined}
          />
          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}
          <Button
            label={submitting ? t('auth.processing') : t('fx.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    boxShadow: elevation.tile,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
