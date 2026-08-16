/** Create-list modal (moved out of the grocery tab's inline form).
 *  Same fields/validation/createList call; closes itself on success. */

import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createList } from '@/features/grocery/api';
import { createListSchema } from '@/features/grocery/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCurrency(fallback: string): string {
  try {
    return getLocales()[0]?.currencyCode ?? fallback;
  } catch {
    return fallback;
  }
}

export default function GroceryNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [name, setName] = useState('');
  // Derived default: the household currency appears whenever the provider
  // resolves (even after mount, e.g. deep links) until the user edits.
  const [currencyInput, setCurrencyInput] = useState<string | null>(null);
  const currency = currencyInput ?? (active ? deviceCurrency(active.reporting_currency_code) : '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate() {
    if (!active) return;
    const result = validate(createListSchema, { name, currencyCode: currency });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createList(active.id, {
        name: result.data.name,
        currencyCode: result.data.currencyCode,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/grocery');
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
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
              label={t('grocery.nameLabel')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              error={fieldErrors.name ? t('errors.validation') : undefined}
            />
            <TextField
              label={t('grocery.currencyLabel')}
              value={currency}
              onChangeText={setCurrencyInput}
              hint={t('household.currencyHint')}
              autoCapitalize="characters"
              error={fieldErrors.currencyCode ? t('errors.validation') : undefined}
            />
            {errorKey ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(errorKey)}
              </Text>
            ) : null}
            <Button
              label={submitting ? t('auth.processing') : t('grocery.createCta')}
              onPress={onCreate}
              loading={submitting}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
