/** A retailer's branches: list + add branch (name, address, currency, coords). */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import { createStore, getRetailer, listStores } from '@/features/retail/api';
import { createStoreSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow, RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailerBranchesScreen() {
  const { t } = useTranslation();
  const { retailerId } = useLocalSearchParams<{ retailerId: string }>();
  const rid = String(retailerId);
  const { active } = useActiveHousehold();

  const [retailer, setRetailer] = useState<RetailerRow | null>(null);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setErrorKey(null);
    try {
      const [r, ss] = await Promise.all([getRetailer(rid), listStores(rid)]);
      setRetailer(r);
      setStores(ss);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onAdd() {
    if (!active) return;
    const result = validate(createStoreSchema, {
      name, city, currencyCode: currency, latitude: lat, longitude: lng,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createStore(active.id, rid, result.data);
      setName(''); setCity(''); setLat(''); setLng('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {retailer ? <Text variant="title">{retailer.name}</Text> : null}

        {stores.length === 0 ? (
          <Text muted>{t('retail.noBranches')}</Text>
        ) : (
          <View style={styles.list}>
            {stores.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text variant="heading">{s.name}{s.is_online ? ` · ${t('retail.online')}` : ''}</Text>
                <Text variant="caption" muted>
                  {[s.city, s.region, s.country_code].filter(Boolean).join(', ')} · {s.currency_code}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addBranch')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.branchName')} value={name} onChangeText={setName}
            autoCapitalize="sentences" error={fieldErrors.name ? t('errors.validation') : undefined} />
          <TextField label={t('retail.city')} value={city} onChangeText={setCity} autoCapitalize="sentences" />
          <TextField label={t('retail.currency')} value={currency} onChangeText={setCurrency}
            autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
          <TextField label={t('retail.latitude')} value={lat} onChangeText={setLat} keyboardType="numeric" />
          <TextField label={t('retail.longitude')} value={lng} onChangeText={setLng} keyboardType="numeric" />
          <Button label={submitting ? t('auth.processing') : t('retail.addBranch')} onPress={onAdd} loading={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
