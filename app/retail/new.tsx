/** Add-retailer modal (5a): pick from the seeded directory for the device's
 *  country, or add a custom retailer as the fallback. "Add" copies the chosen
 *  name into the household's own retailers (existing createRetailer). Degrades to
 *  manual-only when the directory table isn't seeded yet. */

import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, FORM_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { createRetailer, listRetailerDirectory } from '@/features/retail/api';
import { createRetailerSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerDirectoryRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

function deviceCountry(): string {
  try {
    return getLocales()[0]?.regionCode ?? 'US';
  } catch {
    return 'US';
  }
}

export default function RetailNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const country = deviceCountry();

  const [directory, setDirectory] = useState<RetailerDirectoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setDirectory(await listRetailerDirectory(country));
    })();
  }, [country]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? directory.filter((r) => r.name.toLowerCase().includes(q)) : directory;
  }, [directory, query]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/retail');
  }

  async function addNamed(retailerName: string, countryCode: string) {
    if (!active) return;
    const result = validate(createRetailerSchema, { name: retailerName, countryCode });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return false;
    }
    setFieldErrors({});
    try {
      await createRetailer(active.id, result.data);
      return true;
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
      return false;
    }
  }

  async function onAddFromDirectory(row: RetailerDirectoryRow) {
    setAddingKey(row.brand_key);
    const ok = await addNamed(row.name, row.country_code);
    setAddingKey(null);
    if (ok) close();
  }

  async function onAddCustom() {
    setSubmitting(true);
    const ok = await addNamed(name, country);
    setSubmitting(false);
    if (ok) close();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {!active ? (
          <Text muted>{t('finance.noHousehold')}</Text>
        ) : (
          <>
            {directory.length > 0 ? (
              <>
                <Text variant="subheading">{t('retail.directoryTitle')}</Text>
                <TextField
                  label={t('retail.directorySearch')}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                />
                <View style={styles.list}>
                  {filtered.map((r) => (
                    <View key={r.brand_key} style={styles.row}>
                      <View style={styles.monogram}>
                        <Text variant="button" style={styles.monogramText}>
                          {r.name.charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.rowMid}>
                        <Text variant="subheading" numberOfLines={1}>{r.name}</Text>
                        {r.kind ? (
                          <Text variant="caption" muted numberOfLines={1}>{r.kind}</Text>
                        ) : null}
                      </View>
                      <Button
                        label={t('retail.add')}
                        variant="secondary"
                        onPress={() => onAddFromDirectory(r)}
                        loading={addingKey === r.brand_key}
                        style={styles.addBtn}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.divider} />
              </>
            ) : null}

            <Text variant="subheading">{t('retail.customTitle')}</Text>
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
              onPress={onAddCustom}
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
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  monogram: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: palette.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: palette.textMuted },
  rowMid: { flex: 1, gap: 2 },
  addBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
});
