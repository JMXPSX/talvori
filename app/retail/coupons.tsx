/** Coupons discovery: active/expired sections + add coupon (fixed or percent). */

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { elevation, radius, spacing } from '@/components/theme';
import { useThemedStyles, useTheme, type Palette } from '@/components/ThemeProvider';
import { Button, Chip, CONTENT_MAX_WIDTH, Text, TextField } from '@/components/ui';
import { usePlan } from '@/features/billing/EntitlementsProvider';
import { listItems, listLists } from '@/features/grocery/api';
import { useActiveHousehold } from '@/features/household/ActiveHouseholdProvider';
import { listRetailers } from '@/features/retail/api';
import { couponStatus } from '@/features/retail/coupon';
import { createCoupon, deleteCoupon, listCoupons } from '@/features/retail/couponApi';
import type { CouponWithRefs } from '@/features/retail/couponApi';
import { computeListCouponSavings, type ListItemForMatch } from '@/features/retail/couponMatch';
import { createCouponSchema } from '@/features/retail/schemas';
import type { GroceryItemRow, GroceryListRow, RetailerRow } from '@/lib/database.types';
import { toAppError } from '@/lib/errors';
import { formatAmount, formatDate } from '@/lib/format';
import { toMinorUnits } from '@/lib/money';
import { validate } from '@/lib/validation';

/** Whole days until an ISO instant (ceil); negative if already past. */
function daysUntil(iso: string, nowMs: number): number {
  return Math.ceil((new Date(iso).getTime() - nowMs) / (24 * 3600 * 1000));
}

export default function CouponsScreen() {
  const { t } = useTranslation();
  const { active } = useActiveHousehold();
  const { has } = usePlan();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { palette } = useTheme();

  const [coupons, setCoupons] = useState<CouponWithRefs[]>([]);
  // Expiry reference time, captured when coupons load (render must stay pure).
  const [now, setNow] = useState(0);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [list, setList] = useState<GroceryListRow | null>(null);
  const [items, setItems] = useState<GroceryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'fixed' | 'percent'>('fixed');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(active?.reporting_currency_code ?? '');
  const [percent, setPercent] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [code, setCode] = useState('');
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      return;
    }
    setErrorKey(null);
    try {
      const [cs, rs, lists] = await Promise.all([
        listCoupons(active.id),
        listRetailers(active.id),
        listLists(active.id),
      ]);
      const latest = lists[0] ?? null;
      const its = latest ? await listItems(latest.id) : [];
      setNow(Date.now());
      setCoupons(cs);
      setRetailers(rs);
      setList(latest);
      setItems(its);
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

  async function onAdd() {
    if (!active || !retailerId) {
      setErrorKey('coupons.errors.saveFailed');
      return;
    }
    const result = validate(createCouponSchema, {
      retailerId,
      title,
      code,
      sourceUrl: url,
      discountType: type,
      amountMajor: type === 'fixed' ? amount : undefined,
      currencyCode: type === 'fixed' ? currency : undefined,
      percent: type === 'percent' ? percent : undefined,
      minPurchaseMajor: minPurchase,
      maxDiscountMajor: maxDiscount,
      expiresAt: expires,
    });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    setFieldErrors({});
    const ccy = type === 'fixed' ? (result.data.currencyCode as string) : active.reporting_currency_code;
    setSubmitting(true);
    try {
      await createCoupon(active.id, {
        retailerId: result.data.retailerId,
        title: result.data.title,
        code: result.data.code,
        sourceUrl: result.data.sourceUrl,
        discountType: result.data.discountType,
        discountAmountMinor:
          result.data.discountType === 'fixed' && result.data.amountMajor !== undefined
            ? toMinorUnits(result.data.amountMajor, ccy)
            : undefined,
        currencyCode: result.data.discountType === 'fixed' ? result.data.currencyCode : undefined,
        discountPercent: result.data.discountType === 'percent' ? result.data.percent : undefined,
        minPurchaseMinor:
          result.data.minPurchaseMajor === undefined ? undefined : toMinorUnits(result.data.minPurchaseMajor, ccy),
        maxDiscountMinor:
          result.data.maxDiscountMajor === undefined ? undefined : toMinorUnits(result.data.maxDiscountMajor, ccy),
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt).toISOString() : undefined,
      });
      setTitle(''); setAmount(''); setPercent(''); setMinPurchase(''); setMaxDiscount('');
      setCode(''); setUrl(''); setExpires('');
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteCoupon(id);
      await load();
    } catch (err) {
      setErrorKey(toAppError(err).messageKey);
    }
  }

  if (!has('coupons')) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text variant="heading">{t('billing.lockedTitle')}</Text>
            <Text muted>{t('billing.lockedBody')}</Text>
            <Button label={t('billing.manageCta')} onPress={() => router.push('/subscription')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const activeCoupons = coupons.filter((c) => couponStatus(c, now) !== 'expired');
  const expiredCoupons = coupons.filter((c) => couponStatus(c, now) === 'expired');

  // Tie coupons to the current list: match by product, total the best-per-item
  // savings against each item's estimated price in the list currency.
  const listCurrency = list?.currency_code ?? active?.reporting_currency_code ?? 'USD';
  const listItemsForMatch: ListItemForMatch[] = items.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    estimatedPriceMinor: i.estimated_price_minor,
  }));
  const summary = computeListCouponSavings(coupons, listItemsForMatch, listCurrency, now);
  const matchByCoupon = new Map(summary.matches.map((m) => [m.coupon.id, m]));
  const matchedName = (c: CouponWithRefs): string | null =>
    matchByCoupon.get(c.id)?.matchedItemName ?? null;
  // Coupons that hit something on the list float to the top.
  const orderedActive = [...activeCoupons].sort(
    (a, b) => (matchedName(b) ? 1 : 0) - (matchedName(a) ? 1 : 0),
  );

  function describe(c: CouponWithRefs): string {
    if (c.discount_type === 'fixed' && c.discount_amount_minor != null && c.currency_code) {
      return formatAmount(c.discount_amount_minor, c.currency_code);
    }
    return `${c.discount_percent ?? 0}%`;
  }

  function renderCoupon(c: CouponWithRefs) {
    const name = matchedName(c);
    const days = c.expires_at ? daysUntil(c.expires_at, now) : null;
    const soon = days !== null && days < 7 && couponStatus(c, now) !== 'expired';
    return (
      <View key={c.id} style={[styles.coupon, name ? null : styles.dim]}>
        <View style={styles.accentBar} />
        <View style={styles.couponBody}>
          <View style={styles.cardRow}>
            <Text variant="subheading" style={styles.flex} numberOfLines={2}>{c.title}</Text>
            <Text variant="subheading" style={{ color: palette.accent }}>{describe(c)}</Text>
          </View>
          <Text variant="caption" muted numberOfLines={1}>
            {c.retailer?.name ?? '—'}
            {c.retailer_product?.display_name ? ` · ${c.retailer_product.display_name}` : ''}
            {c.code ? ` · ${c.code}` : ''}
          </Text>
          {c.expires_at ? (
            <Text variant="caption" style={{ color: soon ? palette.danger : palette.textMuted }}>
              {t('coupons.until', { date: formatDate(c.expires_at) })}
            </Text>
          ) : null}
          {name ? (
            <Text variant="caption" style={{ color: palette.brand }}>
              {t('coupons.onYourList', { item: name })}
            </Text>
          ) : null}
          <View style={styles.cardRow}>
            {c.source_url ? (
              <Pressable onPress={() => void Linking.openURL(c.source_url as string)}>
                <Text variant="caption" style={{ color: palette.brand }}>{t('coupons.openLink')}</Text>
              </Pressable>
            ) : <View />}
            <Pressable onPress={() => onDelete(c.id)}>
              <Text variant="caption" style={{ color: palette.danger }}>{t('coupons.delete')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {errorKey ? <Text style={{ color: palette.danger }}>{t(errorKey)}</Text> : null}

        <View style={styles.headerRow}>
          <View style={styles.premiumPill}>
            <Text variant="caption" style={{ color: palette.accent }}>{t('coupons.premium')}</Text>
          </View>
        </View>
        {summary.totalSavingsMinor > 0 && list ? (
          <View style={styles.banner}>
            <Text style={{ color: palette.accent }}>
              {t('coupons.savingsBanner', {
                amount: formatAmount(summary.totalSavingsMinor, listCurrency),
                list: list.name,
              })}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={palette.brand} />
        ) : coupons.length === 0 ? (
          <Text muted>{t('coupons.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {activeCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.active')}</Text>
                {orderedActive.map(renderCoupon)}
              </>
            )}
            {expiredCoupons.length > 0 && (
              <>
                <Text variant="caption" muted>{t('coupons.expired')}</Text>
                {expiredCoupons.map(renderCoupon)}
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <Text variant="heading">{t('coupons.addTitle')}</Text>
        <View style={styles.form}>
          <Text variant="caption" muted>{t('coupons.chooseRetailer')}</Text>
          <View style={styles.chips}>
            {retailers.map((r) => (
              <Chip
                key={r.id}
                label={r.name}
                selected={r.id === retailerId}
                role="radio"
                onPress={() => setRetailerId(r.id)}
              />
            ))}
          </View>

          <TextField label={t('coupons.couponTitle')} value={title} onChangeText={setTitle}
            autoCapitalize="sentences" error={fieldErrors.title ? t('errors.validation') : undefined} />

          <Text variant="caption" muted>{t('coupons.discountType')}</Text>
          <View style={styles.chips}>
            <Chip label={t('coupons.fixed')} selected={type === 'fixed'} role="radio" onPress={() => setType('fixed')} />
            <Chip label={t('coupons.percent')} selected={type === 'percent'} role="radio" onPress={() => setType('percent')} />
          </View>

          {type === 'fixed' ? (
            <>
              <TextField label={t('coupons.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric"
                error={fieldErrors.amountMajor ? t('errors.validation') : undefined} />
              <TextField label={t('coupons.currency')} value={currency} onChangeText={setCurrency}
                autoCapitalize="characters" error={fieldErrors.currencyCode ? t('errors.validation') : undefined} />
            </>
          ) : (
            <TextField label={t('coupons.percentValue')} value={percent} onChangeText={setPercent} keyboardType="numeric"
              error={fieldErrors.percent ? t('errors.validation') : undefined} />
          )}

          <TextField label={t('coupons.minPurchase')} value={minPurchase} onChangeText={setMinPurchase} keyboardType="numeric" />
          <TextField label={t('coupons.maxDiscount')} value={maxDiscount} onChangeText={setMaxDiscount} keyboardType="numeric" />
          <TextField label={t('coupons.code')} value={code} onChangeText={setCode} />
          <TextField label={t('coupons.sourceUrl')} value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TextField label={t('coupons.expiresAt')} value={expires} onChangeText={setExpires} autoCapitalize="none" />
          <Button label={submitting ? t('auth.processing') : t('coupons.addCta')} onPress={onAdd} loading={submitting} />
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
    // Cap + centre so the screen does not stretch edge to edge on a monitor.
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: { gap: spacing.sm },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row' },
  premiumPill: {
    alignSelf: 'flex-start',
    backgroundColor: c.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  banner: {
    backgroundColor: c.accentMuted,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  coupon: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    boxShadow: elevation.tile,
    overflow: 'hidden',
  },
  accentBar: { width: 4, backgroundColor: c.accent },
  couponBody: { flex: 1, padding: spacing.lg, gap: spacing.xs },
  dim: { opacity: 0.85 },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    boxShadow: elevation.tile, gap: spacing.xs,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  form: { gap: spacing.sm },
});
