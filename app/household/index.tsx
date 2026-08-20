/**
 * Households home: list the households you belong to (RLS returns only yours),
 * create a new one, or jump to the Join screen to accept an invitation.
 */

import { getLocales } from 'expo-localization';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Card, CONTENT_MAX_WIDTH, CurrencyField, EmptyState, Text, TextField } from '@/components/ui';
import { createHousehold, listMyHouseholds } from '@/features/household/api';
import { createHouseholdSchema } from '@/features/household/schemas';
import type { HouseholdRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

export default function HouseholdsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [crossBorder, setCrossBorder] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setHouseholds(await listMyHouseholds());
    } catch (err) {
      setLoadError(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCreate() {
    setFormError(null);
    const result = validate(createHouseholdSchema, {
      name,
      reportingCurrencyCode: currency,
      isCrossBorder: crossBorder,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await createHousehold(result.data);
      setName('');
      await load();
      router.push(`/household/${created.id}`);
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
        ) : loadError ? (
          <Text style={{ color: palette.danger }}>{t(loadError)}</Text>
        ) : households.length === 0 ? (
          <EmptyState
            icon="home"
            message={t('household.empty')}
            ctaLabel={t('household.joinTitle')}
            onCta={() => router.push('/household/join')}
          />
        ) : (
          <View style={styles.list}>
            {households.map((h) => (
              <Card key={h.id} onPress={() => router.push(`/household/${h.id}`)}>
                <Text variant="subheading">{h.name}</Text>
                <Text variant="caption" muted>
                  {h.reporting_currency_code}
                  {h.is_cross_border ? ' · 🌍' : ''}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text variant="heading">{t('household.createTitle')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('household.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <CurrencyField
            label={t('household.currencyLabel')}
            value={currency}
            onChange={setCurrency}
            suggested={[deviceCurrency()].filter(Boolean)}
            error={fieldErrors.reportingCurrencyCode ? t('errors.validation') : undefined}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('household.crossBorderLabel')}</Text>
            <Switch value={crossBorder} onValueChange={setCrossBorder} />
          </View>

          {formError ? (
            <Text variant="caption" style={{ color: palette.danger }}>
              {t(formError)}
            </Text>
          ) : null}

          <Button
            label={submitting ? t('auth.processing') : t('household.createCta')}
            onPress={onCreate}
            loading={submitting}
          />
        </View>

        <Link href="/household/join" style={styles.joinLink}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('household.joinTitle')}
          </Text>
        </Link>
      </ScrollView>
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
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { flex: 1 },
  joinLink: { marginTop: spacing.lg, alignSelf: 'center' },
});
