/** Create-retailer modal (3c). Moves the add-retailer form out of the hub;
 *  closes back to the hub (which reloads on focus). The seeded directory (5a)
 *  will later replace free-typed names — this keeps the manual fallback. */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createRetailer } from '@/features/retail/api';
import { createRetailerSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onCreate() {
    if (!active) return;
    const result = validate(createRetailerSchema, { name });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createRetailer(active.id, result.data);
      if (router.canGoBack()) router.back();
      else router.replace('/retail');
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
              label={t('retail.retailerName')}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              error={fieldErrors.name ? t('errors.validation') : undefined}
            />
            {errorKey ? (
              <Text variant="caption" style={{ color: palette.danger }}>
                {t(errorKey)}
              </Text>
            ) : null}
            <Button
              label={submitting ? t('auth.processing') : t('retail.addRetailer')}
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
    gap: spacing.md,
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
});
