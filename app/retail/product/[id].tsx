/** A product's prices across branches: unit-price + freshness, cheapest-first.
 *  Link the product to retailers and record price snapshots. */

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, palette, radius, spacing } from '@/components/theme';
import { Button, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import {
  createPrice,
  createRetailerProduct,
  deletePrice,
  getProduct,
  listPricesForProduct,
  listRetailerProducts,
  listRetailers,
  listStores,
} from '@/features/retail/api';
import type { PriceWithRefs, RetailerProductWithRetailer } from '@/features/retail/api';
import { createPriceSchema, createRetailerProductSchema } from '@/features/retail/schemas';
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import { freshnessOf } from '@/features/retail/freshness';
import { unitPriceMinor } from '@/features/retail/unitPrice';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import type { ProductRow, RetailerRow, RetailerStoreRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

export default function ProductPricesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = String(id);
  const { active } = useActiveHousehold();

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [prices, setPrices] = useState<PriceWithRefs[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [links, setLinks] = useState<RetailerProductWithRetailer[]>([]);
  const [stores, setStores] = useState<RetailerStoreRow[]>([]);
  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  // Freshness reference time, captured when prices load (render must stay pure).
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [linkRetailerId, setLinkRetailerId] = useState<string | null>(null);
  const [rpId, setRpId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [regular, setRegular] = useState('');
  const [sale, setSale] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [p, pr, ls, rs, cs] = await Promise.all([
        getProduct(productId),
        listPricesForProduct(productId),
        listRetailerProducts(productId),
        listRetailers(active.id),
        listCouponsForProduct(productId),
      ]);
      setNow(Date.now());
      setProduct(p);
      setPrices(pr);
      setLinks(ls);
      setRetailers(rs);
      setCoupons(cs);
      const retailerIds = Array.from(new Set(ls.map((l) => l.retailer_id)));
      const allStores: RetailerStoreRow[] = [];
      for (const retId of retailerIds) allStores.push(...(await listStores(retId)));
      setStores(allStores);
      setRpId((prev) => prev ?? ls[0]?.id ?? null);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, productId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onLink() {
    if (!active || !linkRetailerId) return;
    const result = validate(createRetailerProductSchema, { productId, retailerId: linkRetailerId });
    if (!result.success) return;
    setBusy(true);
    try {
      await createRetailerProduct(active.id, result.data);
      setLinkRetailerId(null);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  async function onAddPrice() {
    if (!active || !rpId) return;
    const result = validate(createPriceSchema, {
      retailerProductId: rpId,
      storeId: storeId ?? undefined,
      regularMajor: regular,
      saleMajor: sale,
      currencyCode: active.reporting_currency_code,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    const store = stores.find((s) => s.id === storeId) ?? null;
    const ccy = store?.currency_code ?? result.data.currencyCode;
    setBusy(true);
    try {
      await createPrice(active.id, {
        retailerProductId: result.data.retailerProductId,
        storeId: result.data.storeId,
        regularMinor: toMinorUnits(result.data.regularMajor, ccy),
        saleMinor: result.data.saleMajor === undefined ? undefined : toMinorUnits(result.data.saleMajor, ccy),
        memberMinor: undefined,
        currencyCode: ccy,
      });
      setRegular(''); setSale('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setBusy(false);
    }
  }

  async function onDeletePrice(pid: string) {
    try {
      await deletePrice(pid);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  const freshLabel = (f: 'fresh' | 'recent' | 'stale'): string =>
    f === 'fresh' ? t('retail.fresh') : f === 'recent' ? t('retail.recent') : t('retail.stale');

  const sorted = [...prices].sort(
    (a, b) => (a.sale_price_minor ?? a.regular_price_minor) - (b.sale_price_minor ?? b.regular_price_minor),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}
        {product ? <Text variant="title">{product.name}</Text> : null}

        {sorted.length === 0 ? (
          <Text muted>{t('retail.noPrices')}</Text>
        ) : (
          <View style={styles.list}>
            {sorted.map((p) => {
              const effective = p.sale_price_minor ?? p.regular_price_minor;
              const up = product
                ? unitPriceMinor(effective, product.size_value, product.size_unit, product.pack_count)
                : null;
              const fresh = freshnessOf(new Date(p.observed_at).getTime(), now);
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text variant="heading">
                      {p.retailer_product?.retailer?.name ?? '—'}
                      {p.store ? ` ${t('retail.atStore', { store: p.store.name })}` : ` · ${t('retail.onlinePrice')}`}
                    </Text>
                    <Text variant="heading">{formatAmount(effective, p.currency_code)}</Text>
                  </View>
                  {up ? (
                    <Text variant="caption" muted>
                      {t('retail.perUnit', {
                        price: formatAmount(Math.round(up.perBaseMinor * 100) / 100, p.currency_code),
                        unit: up.unit,
                      })}
                    </Text>
                  ) : null}
                  <View style={styles.cardRow}>
                    <Text variant="caption" muted>{freshLabel(fresh)}</Text>
                    <Pressable onPress={() => onDeletePrice(p.id)}>
                      <Text variant="caption" style={{ color: palette.danger }}>{t('finance.delete')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {coupons.length > 0 && sorted[0] && (() => {
          const cheapest = sorted[0];
          const base = cheapest.sale_price_minor ?? cheapest.regular_price_minor;
          return (
            <View style={styles.list}>
              <Text variant="heading">{t('coupons.applicableTitle')}</Text>
              {coupons.map((c) => {
                const r = applyCoupon(c, base, cheapest.currency_code, now);
                return (
                  <View key={c.id} style={styles.card}>
                    <Text variant="heading">{c.title}</Text>
                    <Text variant="caption" muted>{c.retailer?.name ?? '—'}</Text>
                    {r.applicable ? (
                      <Text variant="caption" style={{ color: palette.brand }}>
                        {t('coupons.expectedFinal', { price: formatAmount(r.finalMinor, cheapest.currency_code) })}
                        {' · '}
                        {t('coupons.expectedSavings', { amount: formatAmount(r.savingsMinor, cheapest.currency_code) })}
                      </Text>
                    ) : (
                      <Text variant="caption" muted>{t('coupons.notApplicable')}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}

        <View style={styles.divider} />
        <Text variant="heading">{t('retail.linkRetailer')}</Text>
        <View style={styles.chips}>
          {retailers.map((r) => {
            const on = r.id === linkRetailerId;
            return (
              <Pressable key={r.id} onPress={() => setLinkRetailerId(r.id)}
                style={[styles.chip, on ? styles.chipActive : null]}>
                <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>{r.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button label={t('retail.linkRetailer')} onPress={onLink} loading={busy} />

        {links.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text variant="heading">{t('retail.addPrice')}</Text>
            <View style={styles.form}>
              <Text variant="caption" muted>{t('retail.chooseRetailer')}</Text>
              <View style={styles.chips}>
                {links.map((l) => {
                  const on = l.id === rpId;
                  return (
                    <Pressable key={l.id} onPress={() => setRpId(l.id)}
                      style={[styles.chip, on ? styles.chipActive : null]}>
                      <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>
                        {l.retailer?.name ?? '—'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text variant="caption" muted>{t('retail.chooseStore')}</Text>
              <View style={styles.chips}>
                <Pressable onPress={() => setStoreId(null)}
                  style={[styles.chip, storeId === null ? styles.chipActive : null]}>
                  <Text variant="caption" style={{ color: storeId === null ? palette.white : palette.text }}>
                    {t('retail.onlinePrice')}
                  </Text>
                </Pressable>
                {stores.map((s) => {
                  const on = s.id === storeId;
                  return (
                    <Pressable key={s.id} onPress={() => setStoreId(s.id)}
                      style={[styles.chip, on ? styles.chipActive : null]}>
                      <Text variant="caption" style={{ color: on ? palette.white : palette.text }}>
                        {s.name} ({s.currency_code})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField label={t('retail.regularPrice')} value={regular} onChangeText={setRegular}
                keyboardType="numeric" error={fieldErrors.regularMajor ? t('errors.validation') : undefined} />
              <TextField label={t('retail.salePrice')} value={sale} onChangeText={setSale} keyboardType="numeric" />
              <Button label={busy ? t('auth.processing') : t('retail.addPrice')} onPress={onAddPrice} loading={busy} />
            </View>
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
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    boxShadow: elevation.tile, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: palette.field,
  },
  chipActive: { backgroundColor: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
