/** Retail hub: active-location switcher, retailers list + add, section links. */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import {
  createRetailer,
  listRetailers,
  listSavedLocations,
  setActiveLocation,
} from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { createRetailerSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [rs, ls] = await Promise.all([listRetailers(active.id), listSavedLocations(active.id)]);
      setRetailers(rs);
      setLocations(ls);
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

  async function onSetActive(id: string) {
    try {
      await setActiveLocation(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onAddRetailer() {
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
      setName('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const activeLoc = locations.find((l) => l.is_active) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.card}>
          <Text variant="caption" muted>{t('retail.activeLocation')}</Text>
          <Text variant="heading">
            {activeLoc ? `${activeLoc.label} — ${activeLoc.store?.name ?? ''}` : t('retail.noActiveLocation')}
          </Text>
          <Link href="/retail/locations" style={{ marginTop: spacing.xs }}>
            <Text style={{ color: palette.brand }}>{t('retail.savedLocations')}</Text>
          </Link>
        </View>

        <View style={styles.rowLinks}>
          <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
          <Link href="/retail/coupons"><Text style={{ color: palette.brand }}>{t('coupons.title')}</Text></Link>
        </View>

        <Text variant="heading">{t('retail.retailers')}</Text>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : retailers.length === 0 ? (
          <Text muted>{t('retail.noRetailers')}</Text>
        ) : (
          <View style={styles.list}>
            {retailers.map((r) => (
              <Pressable key={r.id} style={styles.card} onPress={() => router.push(`/retail/${r.id}`)}>
                <Text variant="heading">{r.name}</Text>
                {r.country_code ? <Text variant="caption" muted>{r.country_code}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}

        {locations.length > 0 && (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('retail.savedLocations')}</Text>
            {locations.map((l) => (
              <View key={l.id} style={styles.locRow}>
                <Text>{l.label} — {l.store?.name ?? ''}</Text>
                {l.is_active ? (
                  <Text variant="caption" style={{ color: palette.brand }}>{t('retail.active')}</Text>
                ) : (
                  <Button label={t('retail.setActive')} variant="secondary" onPress={() => onSetActive(l.id)} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addRetailer')}</Text>
        <View style={styles.form}>
          <TextField
            label={t('retail.retailerName')}
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            error={fieldErrors.name ? t('errors.validation') : undefined}
          />
          <Button
            label={submitting ? t('auth.processing') : t('retail.addRetailer')}
            onPress={onAddRetailer}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm },
  rowLinks: { flexDirection: 'row', gap: spacing.lg },
  card: {
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, backgroundColor: palette.surface, gap: spacing.xs,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
