/** Create-household modal (3c — fixes F13/F19/F25). Moves the create form out of
 *  the list screen: name, reporting currency (via the 3b picker), and the
 *  cross-border toggle with its explainer. Closes to the new household. */

import { getLocales } from 'expo-localization';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, CurrencyField, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createHousehold } from '@/features/household/api';
import { createHouseholdSchema } from '@/features/household/schemas';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(): string {
  try {
    return getLocales()[0]?.currencyCode ?? '';
  } catch {
    return '';
  }
}

export default function HouseholdNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(deviceCurrency());
  const [crossBorder, setCrossBorder] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      router.replace(`/household/${created.id}`);
    } catch (err) {
      setFormError(toAppError(err).messageKey);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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
          <View style={styles.switchText}>
            <Text>{t('household.crossBorderLabel')}</Text>
            <Text variant="caption" muted>
              {t('household.crossBorderExplainer')}
            </Text>
          </View>
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

        <Link href="/household/join" style={styles.joinLink}>
          <Text variant="caption" style={{ color: palette.brand }}>
            {t('household.joinInstead')}
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
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  joinLink: { marginTop: spacing.sm, alignSelf: 'center' },
});
