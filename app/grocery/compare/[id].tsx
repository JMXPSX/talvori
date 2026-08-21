/** Compare a grocery list's linked items across branches (reporting currency):
 *  ranked column totals + coverage, best-price floor, and potential coupon savings. */

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, spacing } from '@/components/theme';
import { Button, Card, CONTENT_MAX_WIDTH, Text } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { listItems } from '@/features/grocery/api';
import { bestFloorMinor, compareColumns } from '@/features/retail/basket';
import type { ColumnTotal } from '@/features/retail/basket';
import { getBasketPrices } from '@/features/retail/basketApi';
import { applyCoupon } from '@/features/retail/coupon';
import { listCouponsForProduct } from '@/features/retail/couponApi';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { toAppError } from '@/lib/errors';
import { formatAmount } from '@/lib/format';

export default function CompareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = String(id);
  const { active } = useActiveHousehold();
  const { has } = usePlan();
  const router = useRouter();

  const [columns, setColumns] = useState<ColumnTotal[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [floor, setFloor] = useState<{ totalMinor: number; pricedCount: number }>({ totalMinor: 0, pricedCount: 0 });
  const [itemCount, setItemCount] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const ccy = active?.reporting_currency_code ?? 'USD';

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const items = await listItems(listId);
      const productIds = Array.from(
        new Set(items.map((it) => it.product_id).filter((v): v is string => Boolean(v))),
      );
      setItemCount(productIds.length);
      if (productIds.length === 0) {
        setColumns([]);
        setFloor({ totalMinor: 0, pricedCount: 0 });
        setPotentialSavings(0);
        return;
      }
      const { prices, labels: lbls } = await getBasketPrices(productIds, ccy);
      const basketItems = productIds.map((productId) => ({ productId }));
      setColumns(compareColumns(basketItems, prices));
      setLabels(lbls);
      setFloor(bestFloorMinor(basketItems, prices));

      // Potential coupon savings: best applicable coupon per product vs its best price.
      const now = Date.now();
      const bestByProduct = new Map<string, number>();
      for (const p of prices) {
        const prev = bestByProduct.get(p.productId);
        if (prev === undefined || p.effectiveMinor < prev) bestByProduct.set(p.productId, p.effectiveMinor);
      }
      let savings = 0;
      for (const productId of productIds) {
        const base = bestByProduct.get(productId);
        if (base === undefined) continue;
        const coupons = await listCouponsForProduct(productId);
        let best = 0;
        for (const c of coupons) {
          const r = applyCoupon(c, base, ccy, now);
          if (r.applicable && r.savingsMinor > best) best = r.savingsMinor;
        }
        savings += best;
      }
      setPotentialSavings(savings);
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setLoading(false);
    }
  }, [active, listId, ccy]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!has('retail_comparison')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <Card>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </Card>
        </View>
      </SafeAreaView>
    );
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

        {itemCount === 0 ? (
          <Text muted>{t('grocery.compare.noLinked')}</Text>
        ) : columns.length === 0 ? (
          <Text muted>{t('retail.noPrices')}</Text>
        ) : (
          <>
            <View style={styles.list}>
              {columns.map((col, idx) => (
                <Card key={col.columnKey}>
                  <View style={styles.cardRow}>
                    <Text variant="subheading">{labels[col.columnKey] ?? col.columnKey}</Text>
                    <Text variant="heading">{formatAmount(col.totalMinor, ccy)}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text variant="caption" muted>
                      {t('grocery.compare.coverage', { priced: col.pricedCount, total: itemCount })}
                    </Text>
                    {idx === 0 ? (
                      <Text variant="caption" style={{ color: palette.brand }}>{t('grocery.compare.cheapest')}</Text>
                    ) : col.missingCount > 0 ? (
                      <Text variant="caption" muted>{t('grocery.compare.missing', { count: col.missingCount })}</Text>
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>

            <Card>
              <Text variant="moneyMin" muted>
                {t('grocery.compare.floor', {
                  total: formatAmount(floor.totalMinor, ccy),
                  priced: floor.pricedCount,
                  total_items: itemCount,
                })}
              </Text>
              {potentialSavings > 0 ? (
                <Text variant="moneyMin" style={{ color: palette.brand }}>
                  {t('grocery.compare.potentialSavings', { amount: formatAmount(potentialSavings, ccy) })}
                </Text>
              ) : null}
            </Card>
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
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
