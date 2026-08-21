/** Retail hub: active-location switcher, retailers list + add, section links. */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Card, CONTENT_MAX_WIDTH, EmptyState, Text } from '@/components/ui';
import { listRetailers, listSavedLocations, setActiveLocation } from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';

export default function RetailHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();

  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

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

  const activeLoc = locations.find((l) => l.is_active) ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <Card>
          <Text variant="caption" muted>{t('retail.activeLocation')}</Text>
          <Text variant="subheading">
            {activeLoc ? `${activeLoc.label} — ${activeLoc.store?.name ?? ''}` : t('retail.noActiveLocation')}
          </Text>
          <Link href="/retail/locations" style={{ marginTop: spacing.xs }}>
            <Text style={{ color: palette.brand }}>{t('retail.savedLocations')}</Text>
          </Link>
        </Card>

        <View style={styles.rowLinks}>
          <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
          <Link href="/retail/coupons"><Text style={{ color: palette.brand }}>{t('coupons.title')}</Text></Link>
        </View>

        <Text variant="heading">{t('retail.retailers')}</Text>
        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : retailers.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            message={t('retail.noRetailers')}
            ctaLabel={t('retail.addRetailer')}
            onCta={() => router.push('/retail/new')}
          />
        ) : (
          <View style={styles.list}>
            {retailers.map((r) => (
              <Card key={r.id} onPress={() => router.push(`/retail/${r.id}`)}>
                <Text variant="subheading">{r.name}</Text>
                {r.country_code ? <Text variant="caption" muted>{r.country_code}</Text> : null}
              </Card>
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
  rowLinks: { flexDirection: 'row', gap: spacing.lg },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
