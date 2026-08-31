/** A retailer's branch picker (5b): search + nearest-first branches, pick one and
 *  "Save & set as my location", or add a branch manually and activate in one tap. */

import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import {
  createStore,
  getRetailer,
  listStores,
  saveAndActivateLocation,
} from '@/features/retail/api';
import { rankBranches } from '@/features/retail/branchRank';
import { createStoreSchema } from '@/features/retail/schemas';
import type { RetailerRow, RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { validate } from '@/lib/validation';

export default function RetailerBranchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { retailerId } = useLocalSearchParams<{ retailerId: string }>();
  const rid = String(retailerId);
  const { active } = useActiveHousehold();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [retailer, setRetailer] = useState<RetailerRow | null>(null);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState(false);

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

  function back() {
    router.replace('/retail');
  }

  async function onSaveActive() {
    if (!active || !selectedId) return;
    const s = stores.find((x) => x.id === selectedId);
    if (!s) return;
    setSaving(true);
    try {
      await saveAndActivateLocation(active.id, s.id, s.name);
      back();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
      setSaving(false);
    }
  }

  async function onAddAndActivate() {
    if (!active) return;
    const result = validate(createStoreSchema, {
      name,
      city,
      currencyCode: currency,
      latitude: lat,
      longitude: lng,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    setAdding(true);
    try {
      const created = await createStore(active.id, rid, result.data);
      await saveAndActivateLocation(active.id, created.id, created.name);
      back();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
      setAdding(false);
    }
  }

  const ranked = rankBranches(stores, coords, query);

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

        <View style={styles.explainer}>
          <Text variant="caption" style={{ color: palette.white }}>
            {t('retail.branchExplainer')}
          </Text>
        </View>

        <TextField
          label={t('retail.branchSearch')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        <Button
          label={t('retail.useCurrentLocation')}
          variant="secondary"
          onPress={onUseLocation}
        />

        {stores.length === 0 ? (
          <Text muted>{t('retail.noBranches')}</Text>
        ) : (
          <View style={styles.list}>
            {ranked.map(({ store: s, km }) => {
              const on = s.id === selectedId;
              const addr =
                [s.street, s.city, s.region, s.postal_code].filter(Boolean).join(', ') ||
                (s.is_online ? t('retail.online') : '');
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setSelectedId(s.id)}
                  style={[styles.branch, on ? styles.branchOn : styles.branchOff]}
                >
                  <View style={styles.flex}>
                    <Text variant="subheading" numberOfLines={1}>{s.name}</Text>
                    <Text variant="caption" muted numberOfLines={1}>
                      {addr}
                      {km != null ? ` · ${t('retail.distanceKm', { km: km.toFixed(1) })}` : ''}
                    </Text>
                  </View>
                  {on ? <Feather name="check" size={18} color={palette.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <Button
          label={saving ? t('auth.processing') : t('retail.saveAndSetActive')}
          onPress={onSaveActive}
          loading={saving}
          disabled={!selectedId}
        />

        <View style={styles.divider} />
        <Text variant="subheading">{t('retail.branchNotListed')}</Text>
        <View style={styles.form}>
          <TextField label={t('retail.branchName')} value={name} onChangeText={setName}
            autoCapitalize="sentences" error={fieldErrors.name ? t('errors.validation') : undefined} />
          <TextField label={t('retail.city')} value={city} onChangeText={setCity} autoCapitalize="sentences" />
          <TextField label={t('retail.currency')} value={currency} onChangeText={setCurrency}
            autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
          <TextField label={t('retail.latitude')} value={lat} onChangeText={setLat} keyboardType="numeric" />
          <TextField label={t('retail.longitude')} value={lng} onChangeText={setLng} keyboardType="numeric" />
          <Button label={adding ? t('auth.processing') : t('retail.addAndSetActive')} onPress={onAddAndActivate} loading={adding} />
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
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  explainer: {
    backgroundColor: c.text,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  list: { gap: spacing.sm },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  branchOff: { backgroundColor: c.surface, borderColor: c.border },
  branchOn: { backgroundColor: c.brandMuted, borderColor: c.brand },
  flex: { flex: 1 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
