/** Saved shopping locations: list, add (label + branch), set active, and sort
 *  branches by GPS proximity via expo-location (web falls back automatically). */

import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Text, TextField } from '@/components/ui';
import {
  createSavedLocation,
  listRetailers,
  listSavedLocations,
  listStores,
  setActiveLocation,
} from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { haversineKm } from '@/features/retail/distance';
import { createSavedLocationSchema } from '@/features/retail/schemas';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function SavedLocationsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();

  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [ls, retailers] = await Promise.all([
        listSavedLocations(active.id),
        listRetailers(active.id),
      ]);
      setLocations(ls);
      const all: RetailerStoreRow[] = [];
      for (const r of retailers) all.push(...(await listStores(r.id)));
      setStores(all);
      setStoreId((prev) => prev ?? all[0]?.id ?? null);
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

  async function onUseLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorKey('retail.locationDenied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setErrorKey('retail.locationDenied');
    }
  }

  async function onSetActive(id: string) {
    try {
      await setActiveLocation(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  async function onAdd() {
    if (!active || !storeId) return;
    const result = validate(createSavedLocationSchema, { label, storeId });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await createSavedLocation(active.id, result.data);
      setLabel('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  const storesByDistance = coords
    ? [...stores]
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          store: s,
          km: haversineKm(coords, { lat: s.latitude as number, lng: s.longitude as number }),
        }))
        .sort((a, b) => a.km - b.km)
    : [];

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

        {locations.length === 0 ? (
          <Text muted>{t('retail.noLocations')}</Text>
        ) : (
          <View style={styles.list}>
            {locations.map((l) => (
              <View key={l.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text variant="heading">{l.label}</Text>
                  {l.is_active ? (
                    <Text variant="caption" style={{ color: palette.brand }}>{t('retail.active')}</Text>
                  ) : (
                    <Button label={t('retail.setActive')} variant="secondary" onPress={() => onSetActive(l.id)} />
                  )}
                </View>
                <Text variant="caption" muted>
                  {l.store?.retailer?.name ?? ''} — {l.store?.name ?? ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Button label={t('retail.useCurrentLocation')} variant="secondary" onPress={onUseLocation} />
        {coords && storesByDistance.length > 0 && (
          <View style={styles.list}>
            <Text variant="caption" muted>{t('retail.nearestBranches')}</Text>
            {storesByDistance.slice(0, 5).map(({ store, km }) => (
              <Pressable key={store.id} style={styles.card} onPress={() => setStoreId(store.id)}>
                <Text>{store.name}</Text>
                <Text variant="caption" muted>{t('retail.distanceKm', { km: km.toFixed(1) })}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.addLocation')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.locationLabel')} value={label} onChangeText={setLabel}
            autoCapitalize="sentences" error={fieldErrors.label ? t('errors.validation') : undefined} />
          <Text variant="caption" muted>{t('retail.chooseStore')}</Text>
          <View style={styles.chips}>
            {stores.map((s) => {
              const on = s.id === storeId;
              return (
                <Pressable key={s.id} onPress={() => setStoreId(s.id)}
                  style={[styles.chip, on ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Button label={submitting ? t('auth.processing') : t('retail.addLocation')} onPress={onAdd} loading={submitting} />
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
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: palette.brand,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
