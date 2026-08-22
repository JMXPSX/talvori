/** Retail hub as a segmented "Shop" view (2c) with the 4d Stores upgrade: a
 *  location banner over Stores / Coupons / Locations segments. The Stores segment
 *  shows each retailer's reach ("N branches · N prices") and price freshness. */

import { Feather } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, spacing } from '@/components/theme';
import { Button, Card, Chip, CONTENT_MAX_WIDTH, EmptyState, Text } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listRetailers, listRetailerStats, listSavedLocations, setActiveLocation } from '@/features/retail/api';
import type { SavedLocationWithStore } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import { listCoupons, type CouponWithRefs } from '@/features/retail/couponApi';
import { freshnessOf } from '@/features/retail/freshness';
import { EMPTY_RETAILER_STAT, type RetailerStat } from '@/features/retail/retailerStats';
import type { RetailerRow } from '@/lib/database.types';
import { useIsWideLayout } from '@/lib/breakpoints';
import { toAppError } from '@/lib/errors';
import { formatAmount, formatDate } from '@/lib/format';

type Segment = 'stores' | 'coupons' | 'locations';

export default function RetailHubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { active } = useActiveHousehold();
  const { has } = usePlan();
  const isWide = useIsWideLayout();

  const [segment, setSegment] = useState<Segment>('stores');
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [stats, setStats] = useState<Map<string, RetailerStat>>(new Map());
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
      const [rs, ls, cs, st] = await Promise.all([
        listRetailers(active.id),
        listSavedLocations(active.id),
        canCoupons ? listCoupons(active.id) : Promise.resolve<CouponWithRefs[]>([]),
        listRetailerStats(active.id),
      ]);
      setRetailers(rs);
      setLocations(ls);
      setCoupons(cs);
      setStats(st);
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

        {/* Active-location banner (4d) */}
        <Card style={styles.banner}>
          <View style={styles.pinTile}>
            <Feather name="map-pin" size={18} color={palette.brand} />
          </View>
          <View style={styles.flex}>
            {activeLoc ? (
              <Text variant="caption" muted>
                {t('retail.shoppingNear')}
              </Text>
            ) : null}
            <Text variant="subheading" numberOfLines={1}>
              {activeLoc
                ? `${activeLoc.label} — ${activeLoc.store?.name ?? ''}`
                : t('retail.noActiveLocation')}
            </Text>
            <Text variant="caption" muted>
              {t('retail.locationWhy')}
            </Text>
          </View>
          <Button
            label={activeLoc ? t('retail.changeLocation') : t('retail.setLocation')}
            variant="secondary"
            onPress={() => setSegment('locations')}
          />
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
            <View style={styles.storesHeader}>
              <Link href="/retail/products">
                <Text style={{ color: palette.brand }}>{t('retail.products')}</Text>
              </Link>
              <Pressable onPress={() => router.push('/retail/new')} accessibilityRole="button">
                <Text style={{ color: palette.brand }}>＋ {t('retail.addRetailer')}</Text>
              </Pressable>
            </View>
            {retailers.length === 0 ? (
              <EmptyState
                icon="shopping-bag"
                message={t('retail.noRetailers')}
                ctaLabel={t('retail.addRetailer')}
                onCta={() => router.push('/retail/new')}
              />
            ) : (
              <View style={[styles.cards, isWide && styles.cardsWide]}>
                {retailers.map((r) => (
                  <RetailerCard
                    key={r.id}
                    retailer={r}
                    stat={stats.get(r.id) ?? EMPTY_RETAILER_STAT}
                    now={now}
                    wide={isWide}
                    onPress={() => router.push(`/retail/${r.id}`)}
                  />
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
                      <Text variant="caption" style={{ color: palette.brand }}>✓ {t('retail.active')}</Text>
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

/** A retailer tile: name, country, reach ("N branches · N prices"), freshness pill. */
function RetailerCard({
  retailer,
  stat,
  now,
  wide,
  onPress,
}: {
  retailer: RetailerRow;
  stat: RetailerStat;
  now: number;
  wide: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  let pill: { label: string; bg: string; fg: string };
  if (stat.lastObservedAt === null) {
    pill = { label: t('retail.noPricesYet'), bg: palette.field, fg: palette.textMuted };
  } else {
    const date = formatDate(stat.lastObservedAt);
    pill =
      freshnessOf(Date.parse(stat.lastObservedAt), now) === 'stale'
        ? { label: t('retail.stale', { date }), bg: palette.dangerMuted, fg: palette.danger }
        : { label: t('retail.updated', { date }), bg: palette.successMuted, fg: palette.success };
  }

  return (
    <Card onPress={onPress} accessibilityLabel={retailer.name} style={wide ? cardStyles.wide : undefined}>
      <Text variant="subheading" numberOfLines={1}>{retailer.name}</Text>
      {retailer.country_code ? (
        <Text variant="caption" muted>{retailer.country_code}</Text>
      ) : null}
      <Text variant="caption" muted>
        {t('retail.branchCount', { count: stat.branches })} · {t('retail.priceCount', { count: stat.prices })}
      </Text>
      <View style={[cardStyles.pill, { backgroundColor: pill.bg }]}>
        <Text variant="caption" style={{ color: pill.fg }}>{pill.label}</Text>
      </View>
    </Card>
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pinTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  storesHeader: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'space-between' },
  list: { gap: spacing.sm },
  cards: { gap: spacing.md },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  locRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
  manage: { color: palette.brand, marginTop: spacing.xs },
});

const cardStyles = StyleSheet.create({
  wide: { flexGrow: 1, flexBasis: 260, minWidth: 240 },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
});
