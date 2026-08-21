/** Retail hub as a segmented "Shop" view (2c, bounded): a Stores / Coupons /
 *  Locations segmented control over the active-location context. Stays within the
 *  retail domain — the full grocery+retail Shop-tab merge is a separate nav effort. */

import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Card, Chip, CONTENT_MAX_WIDTH, EmptyState, Text } from '@/components/ui';
import { listRetailers, listSavedLocations, setActiveLocation } from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import { listCoupons, type CouponWithRefs } from '@/features/retail/couponApi';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

type Segment = 'stores' | 'coupons' | 'locations';

export default function RetailHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const { has } = usePlan();

  const [segment, setSegment] = useState<Segment>('stores');
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [locations, setLocations] = useState<SavedLocationWithStore[]>([]);
  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canCoupons = has('coupons');

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [rs, ls, cs] = await Promise.all([
        listRetailers(active.id),
        listSavedLocations(active.id),
        canCoupons ? listCoupons(active.id) : Promise.resolve<CouponWithRefs[]>([]),
      ]);
      setRetailers(rs);
      setLocations(ls);
      setCoupons(cs);
      setNow(Date.now());
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, canCoupons]);

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
  const activeCoupons = coupons.filter((c) => couponStatus(c, now) !== 'expired');

  const describeCoupon = (c: CouponWithRefs): string =>
    c.discount_type === 'fixed' && c.discount_amount_minor != null && c.currency_code
      ? formatAmount(c.discount_amount_minor, c.currency_code)
      : `${c.discount_percent ?? 0}%`;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <Card>
          <Text variant="caption" muted>{t('retail.activeLocation')}</Text>
          <Text variant="subheading">
            {activeLoc ? `${activeLoc.label} — ${activeLoc.store?.name ?? ''}` : t('retail.noActiveLocation')}
          </Text>
        </Card>

        <View style={styles.segments}>
          <Chip label={t('retail.retailers')} selected={segment === 'stores'} role="radio" onPress={() => setSegment('stores')} />
          <Chip label={t('coupons.title')} selected={segment === 'coupons'} role="radio" onPress={() => setSegment('coupons')} />
          <Chip label={t('retail.savedLocations')} selected={segment === 'locations'} role="radio" onPress={() => setSegment('locations')} />
        </View>

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : segment === 'stores' ? (
          <>
            <View style={styles.rowLinks}>
              <Link href="/retail/products"><Text style={{ color: palette.brand }}>{t('retail.products')}</Text></Link>
            </View>
            {retailers.length === 0 ? (
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
          </>
        ) : segment === 'coupons' ? (
          !canCoupons ? (
            <Card>
              <Text variant="heading">{t('billing.lockedTitle')}</Text>
              <Text muted>{t('billing.lockedBody')}</Text>
              <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
            </Card>
          ) : (
            <>
              {activeCoupons.length === 0 ? (
                <EmptyState icon="tag" message={t('coupons.empty')} />
              ) : (
                <View style={styles.list}>
                  {activeCoupons.slice(0, 6).map((c) => (
                    <Card key={c.id}>
                      <View style={styles.cardRow}>
                        <Text variant="subheading" numberOfLines={1} style={styles.flex}>{c.title}</Text>
                        <Text variant="subheading">{describeCoupon(c)}</Text>
                      </View>
                      <Text variant="caption" muted numberOfLines={1}>{c.retailer?.name ?? '—'}</Text>
                    </Card>
                  ))}
                </View>
              )}
              <Pressable onPress={() => router.push('/retail/coupons')} accessibilityRole="button">
                <Text variant="caption" style={styles.manage}>{t('retail.manage')}</Text>
              </Pressable>
            </>
          )
        ) : (
          <>
            {locations.length === 0 ? (
              <EmptyState icon="map-pin" message={t('retail.noLocations')} />
            ) : (
              <View style={styles.list}>
                {locations.map((l) => (
                  <View key={l.id} style={styles.locRow}>
                    <Text style={styles.flex} numberOfLines={1}>{l.label} — {l.store?.name ?? ''}</Text>
                    {l.is_active ? (
                      <Text variant="caption" style={{ color: palette.brand }}>{t('retail.active')}</Text>
                    ) : (
                      <Button label={t('retail.setActive')} variant="secondary" onPress={() => onSetActive(l.id)} />
                    )}
                  </View>
                ))}
              </View>
            )}
            <Pressable onPress={() => router.push('/retail/locations')} accessibilityRole="button">
              <Text variant="caption" style={styles.manage}>{t('retail.manage')}</Text>
            </Pressable>
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
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  segments: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  list: { gap: spacing.sm },
  rowLinks: { flexDirection: 'row', gap: spacing.lg },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
  manage: { color: palette.brand, marginTop: spacing.xs },
});
